/**
 * Host half of the sidebar quota widget bundle.
 *
 * The single row `sidebar-quota-widget` mounts this module in the Host process.
 * It owns two facts and serves them as one JSON snapshot over a same-origin
 * read-only route:
 *
 *   - the official DeepSeek account balance, read through the Host account
 *     service (only a Host consumer may obtain the Platform credential);
 *   - for every other provider route registered with the Harness LLM service,
 *     the remaining 5-hour and 7-day subscription quota, read from that
 *     provider's own usage endpoint with the provider credential resolved from
 *     the Harness credential seam.
 *
 * The Client half only renders the payload; all secrets, provider hosts and
 * payload parsing stay in this process.
 */
import {
  PROVIDER_CREDENTIAL_CANDIDATES,
  PROVIDER_PRESENTATION,
  probeProviderQuota,
} from './providers.mjs'

/** Services this row cannot run without: the HTTP carrier and the credential seam. */
export const inject = ['webServer', 'credentials']

/** Route prefix claimed on the browser HTTP carrier. */
const ROUTE_PATH = '/quota-widget'
/** How long one composed snapshot stays fresh for every browser tab. */
const SNAPSHOT_TTL_MS = 45_000
/** Polling hint the Client half honors between snapshots. */
const CLIENT_REFRESH_MS = 60_000
/** Provider routes the official account balance already covers. */
const OFFICIAL_PROVIDER = /^(deepseek|deepseek-)/i

/** Envelope used by every answer on this route. */
function ok(value) {
  return { ok: true, value }
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

/** Write one JSON answer without leaking Host objects into the response. */
function writeJson(res, status, body) {
  let payload
  try {
    payload = JSON.stringify(body)
  } catch {
    status = 500
    payload = JSON.stringify(fail('internal', 'snapshot serialization failed'))
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

/** Whether the request originates from this machine's own loopback page. */
function isLoopbackRequest(req) {
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  const name = hostUrl.hostname
  const loopback =
    name === '127.0.0.1' ||
    name === 'localhost' ||
    name === '[::1]' ||
    name === '::1'
  if (!loopback) return false
  // A cross-site page may reach this port; only first-party page fetches pass.
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Format one wallet amount for the compact top line. */
function money(currency, balance) {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency + ' '
  const numeric = Number(balance)
  if (!Number.isFinite(numeric)) return symbol + balance
  const [whole, fraction] = numeric.toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${symbol}${grouped}.${fraction}`
}

/** Clamp a computed percentage into a JSON-safe range. */
function clampPct(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

/** Normalize one window produced by a provider adapter. */
function windowView(window) {
  if (window === null || window === undefined) return null
  return {
    remainingPct: clampPct(window.remainingPct),
    resetsAt: typeof window.resetsAt === 'number' ? window.resetsAt : null,
    label:
      typeof window.label === 'string'
        ? window.label
        : clampPct(window.remainingPct) === null
          ? null
          : `${Math.round(clampPct(window.remainingPct) * 10) / 10}%`,
  }
}

/**
 * Mount the account balance reader and the provider quota probes behind one
 * cached snapshot, then serve it on the browser HTTP carrier.
 *
 * @param {import('cordis').Context} ctx - the row's Host context.
 */
export function apply(ctx) {
  /** @type {{ at: number, value: unknown } | null} */
  let cache = null
  /** @type {Promise<unknown> | null} */
  let inflight = null

  const timezoneOffsetSeconds = -new Date().getTimezoneOffset() * 60

  /** Read the official DeepSeek account balance. Never throws. */
  async function readOfficial() {
    const account = ctx.get('deepseekAccount')
    if (account === undefined || account === null) {
      return {
        label: 'DeepSeek 官方',
        status: 'unavailable',
        wallets: [],
        bonusWallets: [],
        display: null,
        detail: 'account service unavailable',
      }
    }
    try {
      const balance = await account.getBalance({
        version: '1.0.0',
        locale: 'zh',
        timezoneOffsetSeconds,
      })
      if (balance === null) {
        return {
          label: 'DeepSeek 官方',
          status: 'signed-out',
          wallets: [],
          bonusWallets: [],
          display: null,
          detail: null,
        }
      }
      if (balance.status !== 'ready') {
        return {
          label: 'DeepSeek 官方',
          status: 'error',
          wallets: [],
          bonusWallets: [],
          display: null,
          detail: 'balance request failed',
        }
      }
      const mapWallet = (wallet) => ({
        currency: wallet.currency === 'USD' ? 'USD' : 'CNY',
        balance: wallet.balance,
        display: money(wallet.currency === 'USD' ? 'USD' : 'CNY', wallet.balance),
      })
      const wallets = Array.isArray(balance.value)
        ? balance.value
            .filter((wallet) => wallet && typeof wallet.balance === 'string')
            .map(mapWallet)
        : []
      const bonusWallets = Array.isArray(balance.bonusWallets)
        ? balance.bonusWallets
            .filter((wallet) => wallet && typeof wallet.balance === 'string')
            .map(mapWallet)
        : []
      return {
        label: 'DeepSeek 官方',
        status: 'ok',
        wallets,
        bonusWallets,
        display: wallets.length === 0 ? null : wallets.map((w) => w.display).join(' · '),
        detail: null,
      }
    } catch (error) {
      return {
        label: 'DeepSeek 官方',
        status: 'error',
        wallets: [],
        bonusWallets: [],
        display: null,
        detail: error instanceof Error ? error.message : 'balance request failed',
      }
    }
  }

  /** Resolve the first configured credential for one provider id. */
  async function credentialOf(providerId) {
    const candidates = PROVIDER_CREDENTIAL_CANDIDATES[providerId]
    if (!Array.isArray(candidates) || candidates.length === 0) return undefined
    for (const name of candidates) {
      try {
        const resolved = await ctx.credentials.resolve(name)
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value !== '') {
          return resolved.value
        }
      } catch {
        // A missing or unreadable reference just means this candidate is absent.
      }
    }
    return undefined
  }

  /** List the non-official provider routes the Host currently serves. */
  async function providerRoutes() {
    const llm = ctx.get('llm')
    if (llm !== undefined && llm !== null) {
      try {
        const providers = await llm.listProviders()
        if (Array.isArray(providers)) {
          // The live LLM registry is authoritative, including "no routes".
          return providers
            .filter((provider) => provider && typeof provider.id === 'string' && !OFFICIAL_PROVIDER.test(provider.id))
            .map((provider) => ({
              id: provider.id,
              name: typeof provider.name === 'string' && provider.name !== '' ? provider.name : provider.id,
            }))
        }
      } catch {
        // Fall through to the known provider ids below.
      }
    }
    return Object.keys(PROVIDER_CREDENTIAL_CANDIDATES).map((id) => ({
      id,
      name: PROVIDER_PRESENTATION[id]?.name ?? id,
    }))
  }

  /** Probe one provider route without ever throwing. */
  async function readProvider(route, signal) {
    const presentation = PROVIDER_PRESENTATION[route.id]
    const base = {
      id: route.id,
      name:
        typeof presentation?.name === 'string' && presentation.name !== '' ? presentation.name : route.name,
      mark: typeof presentation?.mark === 'string' && presentation.mark !== '' ? presentation.mark : route.id.slice(0, 1).toUpperCase(),
      state: 'error',
      fiveHour: null,
      sevenDay: null,
      detail: null,
    }
    if (!Array.isArray(PROVIDER_CREDENTIAL_CANDIDATES[route.id])) {
      // A connected route with no quota adapter: honest empty gauge, no probe.
      return { ...base, state: 'unsupported', detail: 'no usage endpoint yet' }
    }
    const credential = await credentialOf(route.id)
    if (credential === undefined) {
      return { ...base, state: 'no-credential' }
    }
    let result
    try {
      result = await probeProviderQuota(route.id, { credential, fetchImpl: fetch, signal })
    } catch (error) {
      return {
        ...base,
        state: 'error',
        detail: error instanceof Error ? error.message : 'quota probe failed',
      }
    }
    if (result === null || typeof result !== 'object') {
      return { ...base, state: 'error', detail: 'quota probe returned no result' }
    }
    const state =
      result.state === 'ok' || result.state === 'no-credential' || result.state === 'unsupported'
        ? result.state
        : 'error'
    return {
      ...base,
      state,
      fiveHour: windowView(result.fiveHour),
      sevenDay: windowView(result.sevenDay),
      detail: typeof result.detail === 'string' ? result.detail : null,
    }
  }

  /** Compose one complete snapshot. */
  async function compose(signal) {
    const official = await readOfficial()
    const routes = await providerRoutes()
    const providers = await Promise.all(routes.map((route) => readProvider(route, signal)))
    return {
      generatedAt: Date.now(),
      refreshAfterMs: CLIENT_REFRESH_MS,
      official,
      providers,
    }
  }

  /**
   * Answer with the cached snapshot, composing one when the cache is stale.
   * Concurrent callers share one in-flight composition.
   */
  async function snapshot() {
    const now = Date.now()
    if (cache !== null && now - cache.at < SNAPSHOT_TTL_MS) return cache.value
    if (inflight !== null) return inflight
    const signal = AbortSignal.timeout(20_000)
    inflight = compose(signal)
      .then((value) => {
        cache = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  /** One route handler for both read and refresh. */
  async function handle(req, res) {
    if (!isLoopbackRequest(req) && !isPairedDeviceRequest(req)) {
      writeJson(res, 403, fail('forbidden', 'this route requires a loopback or paired-device request'))
      return
    }
    let pathname
    try {
      pathname = new URL(req.url ?? ROUTE_PATH, 'http://localhost').pathname
    } catch {
      pathname = ROUTE_PATH
    }
    const sub = pathname.startsWith(ROUTE_PATH) ? pathname.slice(ROUTE_PATH.length) : pathname
    try {
      if (req.method === 'GET' && (sub === '/snapshot' || sub === '' || sub === '/')) {
        writeJson(res, 200, ok(await snapshot()))
        return
      }
      if (req.method === 'POST' && sub === '/refresh') {
        // One forced refresh per TTL window; earlier calls answer from the cache.
        if (cache === null || Date.now() - cache.at >= SNAPSHOT_TTL_MS) cache = null
        writeJson(res, 200, ok(await snapshot()))
        return
      }
      writeJson(res, 404, fail('not-found', 'unknown quota widget endpoint'))
    } catch (error) {
      writeJson(res, 500, fail('snapshot-failed', error instanceof Error ? error.message : 'snapshot failed'))
    }
  }

  /**
   * Whether this request comes from a device paired to this Harness, the same
   * trust fence the shipped remote surfaces use. Optional service: profiles
   * without remote access simply answer false and stay loopback-only.
   */
  function isPairedDeviceRequest(request) {
    let pairing
    try {
      pairing = ctx.get('remoteWebUiPairing')
    } catch {
      return false
    }
    if (pairing === undefined || pairing === null || typeof pairing.isPairedDevice !== 'function') return false
    try {
      return pairing.isPairedDevice(request) === true
    } catch {
      return false
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PATH, handler: handle }),
    'sidebar-quota-widget: /quota-widget route',
  )
}
