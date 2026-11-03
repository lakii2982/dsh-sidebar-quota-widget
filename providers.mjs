/**
 * providers.mjs — subscription-quota probes for the locally connected
 * (non-DeepSeek) LLM providers used by the `dsh-sidebar-quota-widget` Host half.
 *
 * Surveyed and live-verified on 2026-11-03 (~16:40 Asia/Shanghai, epoch
 * 1793695000) with the real keys from the local DSH credential store:
 *
 *   provider        endpoint                                              live status
 *   opencode-go     GET https://opencode.ai/zen/go/v1/usage                200
 *   kimi-coding     GET https://api.kimi.com/coding/v1/usages             200
 *   zai-coding-cn   GET https://open.bigmodel.cn/api/monitor/usage/quota/limit  200
 *   (cross-check)   GET https://api.z.ai/api/monitor/usage/quota/limit    200
 *
 * These are the "official usage" endpoints used by the vendors' own consoles /
 * CLIs; none of them consumes paid model quota (pure GET reads). No CLI path is
 * used: neither the local `opencode` nor `kimi` CLI exposes a quota/usage
 * subcommand (`opencode stats` is local session statistics only), so HTTP is
 * the only source. Field-by-field mapping and redacted payloads are documented
 * in `RESEARCH-providers.md` next to this file.
 *
 * No npm dependencies, no Node built-ins beyond fetch / AbortSignal.
 * This module never logs, never echoes a credential, and never throws out of
 * `probeProviderQuota`.
 */

/** How long a single provider probe may take before it is reported as a timeout. */
const PROBE_TIMEOUT_MS = 10_000;

/** The provider ids this module knows how to probe. */
export const PROVIDER_IDS = /** @type {const} */ ([
  'opencode-go',
  'kimi-coding',
  'zai-coding-cn',
]);

/**
 * Provider id -> credential env/ref names, most specific first.
 * The Host resolves these per call (first one that yields a value wins).
 *
 * @type {Record<string, string[]>}
 */
export const PROVIDER_CREDENTIAL_CANDIDATES = {
  'opencode-go': ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'],
  'kimi-coding': ['KIMI_CODING_API_KEY', 'KIMI_API_KEY'],
  'zai-coding-cn': ['ZAI_CODING_CN_API_KEY', 'ZAI_API_KEY'],
};

/**
 * Provider id -> display name + one/two character center glyph.
 *
 * @type {Record<string, { name: string, mark: string }>}
 */
export const PROVIDER_PRESENTATION = {
  'opencode-go': { name: 'OpenCode Go', mark: 'O' },
  'kimi-coding': { name: 'Kimi For Coding', mark: 'K' },
  'zai-coding-cn': { name: 'Z.AI GLM Coding', mark: 'Z' },
};

/**
 * A single quota window.
 * @typedef {{
 *   remainingPct: number | null,
 *   resetsAt: number | null,
 * }} QuotaWindow
 */

/**
 * Result of one provider probe.
 * @typedef {{
 *   state: 'ok' | 'no-credential' | 'unsupported' | 'error',
 *   fiveHour: QuotaWindow | null,
 *   sevenDay: QuotaWindow | null,
 *   detail: string | null,
 * }} QuotaProbe
 */

/** @param {unknown} value @returns {number | null} */
function finiteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Clamp an already-ascertained percentage into 0..100; non-finite -> null. */
/** @param {unknown} value @returns {number | null} */
function clampPct(value) {
  const n = finiteNumber(value);
  if (n === null) return null;
  return Math.min(100, Math.max(0, n));
}

/**
 * Normalize an epoch-ish timestamp into epoch milliseconds.
 * Accepts `number` (ms, or seconds when < 1e12), numeric strings, and ISO-8601.
 * @param {unknown} value
 * @returns {number | null}
 */
function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return toEpochMs(Number(trimmed));
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * @param {number | null} remainingPct
 * @param {number | null} resetsAt
 * @returns {QuotaWindow | null}
 */
function windowOf(remainingPct, resetsAt) {
  if (remainingPct === null && resetsAt === null) return null;
  return { remainingPct: clampPct(remainingPct), resetsAt: resetsAt ?? null };
}

/** Percent consumed (0..100) -> percent remaining (0..100). */
/** @param {unknown} usedPct @returns {number | null} */
function remainingFromUsed(usedPct) {
  const used = finiteNumber(usedPct);
  if (used === null) return null;
  return clampPct(100 - used);
}

/**
 * Percent consumed expressed as `used / limit`. Handles string-typed numbers
 * (Kimi sends decimal strings) and both directions of rounding.
 * @param {unknown} used
 * @param {unknown} limit
 * @returns {number | null}
 */
function remainingFromUsedOverLimit(used, limit) {
  const u = finiteNumber(used);
  const l = finiteNumber(limit);
  if (u === null || l === null || l <= 0) return null;
  return clampPct(100 - (u / l) * 100);
}

/**
 * Percent remaining from an explicit `remaining` / `limit` pair.
 * @param {unknown} remaining
 * @param {unknown} limit
 * @returns {number | null}
 */
function remainingFromRemainingOverLimit(remaining, limit) {
  const r = finiteNumber(remaining);
  const l = finiteNumber(limit);
  if (r === null || l === null || l <= 0) return null;
  return clampPct((r / l) * 100);
}

/* ------------------------------------------------------------------ *
 * Signal composition: ~10 s per probe, honoring a caller-supplied signal.
 * ------------------------------------------------------------------ */

/**
 * @param {AbortSignal | undefined} external
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
function composeSignal(external) {
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(PROBE_TIMEOUT_MS)
      : null;

  if (timeoutSignal && external && typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any([external, timeoutSignal]), cleanup: () => {} };
  }
  if (timeoutSignal && !external) {
    return { signal: timeoutSignal, cleanup: () => {} };
  }

  // Fallback for runtimes without AbortSignal.timeout/any: one controller that
  // fires on timeout or on the caller's abort.
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error('probe-timeout'));
  }, PROBE_TIMEOUT_MS);
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    /** @type {{ unref?: () => void }} */ (timer).unref?.();
  }
  const onExternalAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */

/**
 * @typedef {{
 *   status: number,
 *   ok: boolean,
 *   json: any,
 * }} HttpResponse
 */

/**
 * GET a JSON document. Throws nothing itself — errors propagate to the caller
 * (which converts them into a probe state). The raw body is parsed in-memory
 * only and never logged.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {AbortSignal} signal
 * @returns {Promise<HttpResponse>}
 */
async function getJson(fetchImpl, url, headers, signal) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
    signal,
    redirect: 'follow',
    cache: 'no-store',
  });
  let json = null;
  try {
    const text = await response.text();
    if (text) json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json };
}

/**
 * Map an HTTP status onto a user-facing (secret-free) failure detail.
 * @param {string} label
 * @param {number} status
 * @returns {string}
 */
function httpDetail(label, status) {
  if (status === 401 || status === 403) {
    return `${label} rejected the API key (HTTP ${status})`;
  }
  if (status === 429) {
    return `${label} is rate-limiting usage requests (HTTP 429)`;
  }
  if (status >= 500) {
    return `${label} usage service is unavailable (HTTP ${status})`;
  }
  return `${label} usage request failed (HTTP ${status})`;
}

/** Thrown inside adapters only; converted into `state: 'error'` by the probe. */
class ProbeFailure extends Error {
  /** @param {string} detail */
  constructor(detail) {
    super(detail);
    this.name = 'ProbeFailure';
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ *
 * Adapters
 * ------------------------------------------------------------------ */

/**
 * OpenCode Go: `GET https://opencode.ai/zen/go/v1/usage`
 * Payload: `{ usage: { rolling|weekly|monthly: { status, percent, resetsAt } } }`
 * `percent` = percent of the window *used* (0..100); `status: 'rate-limited'`
 * means the window is exhausted regardless of the numeric percent.
 *
 * @param {HttpResponse} response
 * @returns {{ fiveHour: QuotaWindow | null, sevenDay: QuotaWindow | null }}
 */
function parseOpenCodeGo(response) {
  const label = 'OpenCode Go';
  if (!response.ok) throw new ProbeFailure(httpDetail(label, response.status));
  const usage = response.json?.usage;
  if (!usage || typeof usage !== 'object') {
    throw new ProbeFailure('OpenCode Go usage response has no `usage` object');
  }

  /** @param {string} name @returns {QuotaWindow | null} */
  const readWindow = (name) => {
    const entry = usage[name];
    if (!entry || typeof entry !== 'object') return null;
    const status = typeof entry.status === 'string' ? entry.status : '';
    const percent = finiteNumber(entry.percent);
    let remainingPct = null;
    if (status === 'rate-limited') remainingPct = 0;
    else if (percent !== null) remainingPct = remainingFromUsed(percent);
    const resetsAt = toEpochMs(entry.resetsAt);
    return windowOf(remainingPct, resetsAt);
  };

  const fiveHour = readWindow('rolling');
  const sevenDay = readWindow('weekly');
  if (!fiveHour && !sevenDay) {
    throw new ProbeFailure('OpenCode Go usage response has no rolling/weekly windows');
  }
  return { fiveHour, sevenDay };
}

/**
 * Kimi For Coding: `GET https://api.kimi.com/coding/v1/usages`
 *
 * Two layouts are handled, newest first:
 * 1. `usages: { limit_5h: { used_ratio, reset_time }, limit_7d: {...} }`
 *    (`used_ratio` is a 0..1 *used* fraction, 4 decimal places). Live-verified.
 * 2. Legacy: `limits[]` with `window.duration === 300` + `TIME_UNIT_MINUTE`
 *    (5-hour burst) carrying `detail { limit, remaining, resetTime }`, and the
 *    top-level `usage` block (`limit` / `used` / `remaining`) = 7-day quota.
 *
 * Plans without a 7-day window (monthly shared-credit plans) legitimately
 * return no weekly source here; the result is then `sevenDay: null`, never a
 * fabricated 100%.
 *
 * @param {HttpResponse} response
 * @returns {{ fiveHour: QuotaWindow | null, sevenDay: QuotaWindow | null }}
 */
function parseKimi(response) {
  const label = 'Kimi For Coding';
  if (!response.ok) throw new ProbeFailure(httpDetail(label, response.status));
  const body = response.json;
  if (!body || typeof body !== 'object') {
    throw new ProbeFailure('Kimi usage response is not a JSON object');
  }

  /** @param {any} entry @returns {QuotaWindow | null} */
  const fromRatio = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const ratio = finiteNumber(entry.used_ratio);
    const resetsAt = toEpochMs(
      entry.reset_time ?? entry.resetTime ?? entry.reset_at ?? entry.resetAt,
    );
    const remainingPct = ratio === null ? null : clampPct((1 - ratio) * 100);
    return windowOf(remainingPct, resetsAt);
  };

  /** @param {any} block @returns {QuotaWindow | null} */
  const fromCounts = (block) => {
    if (!block || typeof block !== 'object') return null;
    const limit = finiteNumber(block.limit);
    const remainingRaw = finiteNumber(block.remaining);
    const used = finiteNumber(block.used);
    const resetsAt = toEpochMs(
      block.resetTime ?? block.reset_time ?? block.resetAt ?? block.reset_at,
    );
    let remainingPct = remainingFromRemainingOverLimit(remainingRaw, limit);
    if (remainingPct === null) remainingPct = remainingFromUsedOverLimit(used, limit);
    if (remainingPct === null && used === null && remainingRaw !== null && limit === null) {
      // No denominator at all: a bare remaining count cannot become a percent.
      remainingPct = null;
    }
    return windowOf(remainingPct, resetsAt);
  };

  // 1) Newest documented layout: named ratio windows.
  let fiveHour = null;
  let sevenDay = null;
  const usages = body.usages && typeof body.usages === 'object' ? body.usages : null;
  if (usages) {
    fiveHour = fromRatio(usages.limit_5h);
    sevenDay = fromRatio(usages.limit_7d);
  }

  // Monthly-credit plans expose `limit_month_total` / `limit_month_code` instead
  // of a 7-day window. Their top-level `usage` block is then a monthly pool, so
  // it must NOT be relabeled as a 7-day window: leave `sevenDay` null instead.
  const hasMonthlyPool =
    usages !== null &&
    !Object.prototype.hasOwnProperty.call(usages, 'limit_7d') &&
    Object.keys(usages).some((key) => /^limit_month/i.test(key));

  // 2) Legacy burst row in `limits[]` (5-hour = duration 300 minutes).
  if (!fiveHour && Array.isArray(body.limits)) {
    for (const entry of body.limits) {
      const window = entry?.window;
      if (!window || typeof window !== 'object') continue;
      const duration = finiteNumber(window.duration);
      const unit = typeof window.timeUnit === 'string' ? window.timeUnit : '';
      const isMinutes = /MINUTE/i.test(unit) || unit === '';
      if (duration === 300 && isMinutes) {
        fiveHour = fromCounts(entry.detail);
        break;
      }
    }
  }

  // 3) Legacy top-level `usage` block = 7-day quota (only when the payload does
  // not describe a monthly credit pool instead).
  if (!sevenDay && !hasMonthlyPool) sevenDay = fromCounts(body.usage);

  if (!fiveHour && !sevenDay) {
    throw new ProbeFailure('Kimi usage response has no 5h or 7d window');
  }
  return { fiveHour, sevenDay };
}

/**
 * Z.AI / BigModel GLM Coding: `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit`
 * (the international host `https://api.z.ai/api/monitor/usage/quota/limit` serves
 * the same payload; both were live-verified 200 on 2026-11-03).
 *
 * Payload: `{ code, msg, success, data: { level, limits: [...] } }` where the
 * bucket type is `TOKENS_LIMIT` (older captures) or `CREDIT_LIMIT` (current),
 * and the window identity comes from `unit`:
 *   unit 3 -> 5-hour rolling window,  unit 6 -> 7-day window
 *   (`unit 5` TIME_LIMIT is the monthly MCP/tools ceiling — ignored here).
 * `percentage` is percent *used*; rows may also carry `usage` (limit),
 * `currentValue` (used), `remaining`, and `nextResetTime` (epoch ms).
 *
 * @param {HttpResponse} response
 * @returns {{ fiveHour: QuotaWindow | null, sevenDay: QuotaWindow | null }}
 */
function parseZai(response) {
  const label = 'Z.AI';
  if (!response.ok) throw new ProbeFailure(httpDetail(label, response.status));
  const body = response.json;
  if (!body || typeof body !== 'object') {
    throw new ProbeFailure('Z.AI quota response is not a JSON object');
  }
  if (body.success === false) {
    const code = finiteNumber(body.code);
    throw new ProbeFailure(
      code === null ? 'Z.AI quota request was rejected' : `Z.AI quota request was rejected (code ${code})`,
    );
  }
  const data = body.data;
  const limits = Array.isArray(data?.limits) ? data.limits : [];
  if (limits.length === 0) {
    throw new ProbeFailure('Z.AI quota response reported no limits');
  }

  /** @type {any} */ let sessionRow = null;
  /** @type {any} */ let weeklyRow = null;

  const isUsageBucket = (row) => row.type === 'TOKENS_LIMIT' || row.type === 'CREDIT_LIMIT';

  // Primary discriminator: `unit` (3 = 5h, 6 = 7d).
  for (const row of limits) {
    if (!row || typeof row !== 'object' || !isUsageBucket(row)) continue;
    const unit = finiteNumber(row.unit);
    if (unit === 3 && !sessionRow) sessionRow = row;
    else if (unit === 6 && !weeklyRow) weeklyRow = row;
  }
  // Last-resort fallback if Z.AI ever renumbers `unit`: `number` still reads as
  // "5 hours" / "1 week" in every captured payload.
  if (!sessionRow && !weeklyRow) {
    for (const row of limits) {
      if (!row || typeof row !== 'object' || !isUsageBucket(row)) continue;
      const number = finiteNumber(row.number);
      if (number === 5 && !sessionRow) sessionRow = row;
      else if (number === 1 && !weeklyRow) weeklyRow = row;
    }
  }

  /** @param {any} row @returns {QuotaWindow | null} */
  const toWindow = (row) => {
    if (!row) return null;
    const percentage = finiteNumber(row.percentage);
    const limit = finiteNumber(row.usage);
    const used = finiteNumber(row.currentValue);
    const remaining = finiteNumber(row.remaining);
    let remainingPct = remainingFromUsed(percentage);
    if (remainingPct === null) remainingPct = remainingFromRemainingOverLimit(remaining, limit);
    if (remainingPct === null) remainingPct = remainingFromUsedOverLimit(used, limit);
    return windowOf(remainingPct, toEpochMs(row.nextResetTime));
  };

  const fiveHour = toWindow(sessionRow);
  const sevenDay = toWindow(weeklyRow);
  if (!fiveHour && !sevenDay) {
    throw new ProbeFailure('Z.AI quota response carried no recognizable 5h/7d bucket');
  }
  return { fiveHour, sevenDay };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * @typedef {{
 *   credential?: string | undefined,
 *   fetchImpl?: typeof fetch | undefined,
 *   signal?: AbortSignal | undefined,
 * }} ProbeInput
 */

/**
 * Probe one provider's subscription usage. Never throws.
 *
 * Behaviour:
 * - unknown provider id            -> `{ state: 'unsupported', fiveHour: null, sevenDay: null, detail }`
 * - empty/blank credential         -> `{ state: 'no-credential', ... }`
 * - a window the plan lacks        -> that window is `null` (never 100%)
 * - HTTP/auth/schema/timeout errors -> `{ state: 'error', fiveHour: null, sevenDay: null, detail }`
 * - success                        -> `{ state: 'ok', fiveHour, sevenDay, detail: null }`
 *
 * `remainingPct` is always 0..100 clamped; `resetsAt` is epoch milliseconds when
 * the API reports a reset/end time.
 *
 * @param {string} providerId
 * @param {ProbeInput} [input]
 * @returns {Promise<QuotaProbe>}
 */
export async function probeProviderQuota(providerId, input = {}) {
  const { credential, fetchImpl, signal } = input ?? {};

  const adapter = ADAPTERS[providerId];
  if (!adapter) {
    return {
      state: 'unsupported',
      fiveHour: null,
      sevenDay: null,
      detail: `No quota source is known for provider "${String(providerId)}"`,
    };
  }

  const key = typeof credential === 'string' ? credential.trim() : '';
  if (!key) {
    return {
      state: 'no-credential',
      fiveHour: null,
      sevenDay: null,
      detail: 'No API key is configured for this provider',
    };
  }

  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;
  if (typeof doFetch !== 'function') {
    return {
      state: 'error',
      fiveHour: null,
      sevenDay: null,
      detail: 'This runtime has no fetch implementation',
    };
  }

  const { signal: combinedSignal, cleanup } = composeSignal(signal);
  try {
    const { fiveHour, sevenDay } = await adapter(doFetch, key, combinedSignal);
    return { state: 'ok', fiveHour, sevenDay, detail: null };
  } catch (error) {
    if (error instanceof ProbeFailure) {
      return { state: 'error', fiveHour: null, sevenDay: null, detail: error.detail };
    }
    const aborted = combinedSignal.aborted === true;
    let detail;
    if (aborted) {
      const externallyAborted = signal?.aborted === true;
      detail = externallyAborted
        ? 'Quota request was cancelled'
        : 'Quota request timed out after 10s';
    } else {
      const code = /** @type {any} */ (error)?.cause?.code ?? /** @type {any} */ (error)?.code;
      detail =
        typeof code === 'string' && /^[A-Z_]+$/.test(code)
          ? `Quota request failed (${code})`
          : 'Quota request failed (network error)';
    }
    return { state: 'error', fiveHour: null, sevenDay: null, detail };
  } finally {
    cleanup();
  }
}

/* ------------------------------------------------------------------ *
 * Adapter registry (HTTP only; no child_process path is needed because all
 * three providers expose a live usage endpoint — see header note).
 * ------------------------------------------------------------------ */

/**
 * @typedef {(
 *   fetchImpl: typeof fetch,
 *   credential: string,
 *   signal: AbortSignal,
 * ) => Promise<{ fiveHour: QuotaWindow | null, sevenDay: QuotaWindow | null }>} Adapter
 */

/** @type {Record<string, Adapter>} */
const ADAPTERS = {
  /** @type {Adapter} */
  'opencode-go': async (fetchImpl, credential, signal) => {
    const response = await getJson(
      fetchImpl,
      'https://opencode.ai/zen/go/v1/usage',
      {
        Authorization: `Bearer ${credential}`,
        Accept: 'application/json',
      },
      signal,
    );
    return parseOpenCodeGo(response);
  },

  /** @type {Adapter} */
  'kimi-coding': async (fetchImpl, credential, signal) => {
    const response = await getJson(
      fetchImpl,
      'https://api.kimi.com/coding/v1/usages',
      {
        Authorization: `Bearer ${credential}`,
        Accept: 'application/json',
      },
      signal,
    );
    return parseKimi(response);
  },

  /** @type {Adapter} */
  'zai-coding-cn': async (fetchImpl, credential, signal) => {
    const url = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
    const headers = {
      Authorization: `Bearer ${credential}`,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en',
    };
    let response = await getJson(fetchImpl, url, headers, signal);
    // Auth-header quirk: older docs/packages claim this endpoint wants the key
    // without the `Bearer ` prefix. Both forms were observed 200 on
    // 2026-11-03, but retry raw-key once on 401/403 so a future tightening of
    // the endpoint does not read as "bad key".
    if (response.status === 401 || response.status === 403) {
      response = await getJson(
        fetchImpl,
        url,
        { Accept: 'application/json', 'Accept-Language': 'en-US,en', Authorization: credential },
        signal,
      );
    }
    return parseZai(response);
  },
};
