# Wire contract — sidebar quota widget

Two halves in one bundle:

| File | Half | Run by |
|---|---|---|
| `index.js` (+ `providers.mjs`) | Host | DSH Host process, one row `sidebar-quota-widget` |
| `client.js` | Client | Web page, `window.__ModuleLoader__` factory, id `dsh-sidebar-quota-widget` |

## Host HTTP route (the only transport)

The Host half registers one `webServer` prefix route: `kind: 'prefix'`, `path: '/quota-widget'`.
The Client half fetches **document-relative** paths (no leading slash — the GUI is served with
`<base href="./">`), i.e. `quota-widget/snapshot`, same-origin, `credentials: 'same-origin'`,
`cache: 'no-store'`.

### `GET quota-widget/snapshot`

Returns `200 application/json`:

```jsonc
{
  "ok": true,
  "value": {
    "generatedAt": 1762300000000,      // epoch ms of the newest data in this payload
    "refreshAfterMs": 60000,           // client polling hint
    "official": {
      "label": "DeepSeek 官方",         // display name; client may localize
      "status": "ok",                  // "ok" | "signed-out" | "unavailable" | "error"
      "wallets": [                     // empty unless status === "ok"
        { "currency": "CNY", "balance": "123.4512", "display": "¥123.45" }
      ],
      "bonusWallets": [],              // same shape; granted-bonus wallet balances
      "display": "¥123.45",            // host-formatted primary text, or null
      "detail": null                   // optional failure text, never a secret
    },
    "providers": [
      {
        "id": "kimi-coding",
        "name": "Kimi For Coding",
        "mark": "K",                   // one or two characters for the center glyph
        "state": "ok",                 // "ok" | "no-credential" | "unsupported" | "error"
        "fiveHour": {                  // 5-hour rolling window; null when the provider/source has none
          "remainingPct": 42.5,        // 0..100, clamped; null when unknown
          "resetsAt": 1762303600000,   // epoch ms or null
          "label": "42.5%"
        },
        "sevenDay": {                  // 7-day window; null when none for this provider
          "remainingPct": 88,
          "resetsAt": null,
          "label": "88%"
        },
        "detail": null                 // optional short failure text (user-facing, no secrets)
      }
    ]
  }
}
```

Failures are a top-level envelope instead of `value` (status 200 so the client can render them):
`{ "ok": false, "error": { "code": "snapshot-failed", "message": "..." } }`.

Query parameters (optional, for diagnostics): none required.

### `POST quota-widget/refresh`

Forces at most one cache invalidation per snapshot-TTL window and answers the same envelope as
`GET /quota-widget/snapshot`; earlier calls answer from the warm cache. (The client does not need
it in v1; it exists so a later refresh control stays one round trip.)

Both methods are served only to a loopback request or a device paired with this Harness (the same
trust fence as the shipped remote surfaces); other requests get `403 {"ok":false,...}`.

## Host internals

- Snapshot cache TTL ≈ 45 s; concurrent readers share one in-flight refresh.
- Official balance: `ctx.get('deepseekAccount')?.getBalance(meta)` with
  `AccountClientMetadata { version, locale, timezoneOffsetSeconds }`; `null` result = signed out.
- Providers: `ctx.get('llm')?.listProviders()` minus official DeepSeek routes. Credentials come
  from `ctx.credentials.resolve('<ENV_NAME>')` (per-call resolution, never cached beyond one probe).
- `providers.mjs` exports:

```js
/** provider id -> candidate credential env names, most specific first */
export const PROVIDER_CREDENTIAL_CANDIDATES = { 'kimi-coding': ['KIMI_CODING_API_KEY', 'KIMI_API_KEY'], ... }
/** center glyph, display name, and whether the provider has 5h/7d windows at all */
export const PROVIDER_PRESENTATION = { 'kimi-coding': { name: 'Kimi For Coding', mark: 'K' }, ... }
/**
 * Probe one provider's subscription usage. Never throws; every failure is a state.
 * @param {string} providerId
 * @param {{ credential: string | undefined, fetchImpl: typeof fetch, signal: AbortSignal }} input
 * @returns {Promise<{
 *   state: 'ok' | 'no-credential' | 'unsupported' | 'error',
 *   fiveHour: { remainingPct: number | null, resetsAt: number | null } | null,
 *   sevenDay: { remainingPct: number | null, resetsAt: number | null } | null,
 *   detail: string | null,
 * }>}
 */
export async function probeProviderQuota(providerId, input)
```

The Host composes `label` strings and never trusts provider payloads beyond
`{ remainingPct, resetsAt }`.

## Client half

- `inject: ['slots', 'locale']`; `ctx.locale.register('quota-widget', 'zh'|'en', dict)` then
  `ctx.locale.bind('quota-widget')` for copy.
- Registers one `sidebar.footer.action` entry (`id: 'sidebar-quota-widget'`), which renders in
  the sidebar foot directly above the account row. Owner prop: `wide`. When `wide === false`
  (56 px rail) the entry renders nothing.
- The footer entry now holds ONLY the third-party gauges (up to five 46 px circles per row,
  wrapping beyond five). The official balance is rendered as a `pointer-events: none` overlay
  positioned on the shipped account row directly below (`top: 100% + 4 px`, 44 px row) so the
  shipped menu row keeps its own hover/click behavior and the number cannot steal its clicks.
- Interaction matches the shipped Mac UI: row/ring hover uses `--dsw-alias-interactive-bg-hover`
  with no lift or custom shadow; the hover card is an opaque shipped-menu surface —
  `--dsw-specific-menu` fill (no backdrop blur, so text never washes out), a `border-l1` hairline,
  a soft popover shadow, `--dsw-radius-lg` radius — with menu-item padding/type and a short fade-in.
  The provider marks sit directly in the ring center: no white disc or background plate behind them.
- Polls `quota-widget/snapshot` on mount and every `refreshAfterMs`; cleans the timer up on unload.
- Rings: center glyph, inner ring = 7-day remaining, outer ring = 5-hour remaining. Arc length =
  remaining percentage; color is the remaining-quota scale — 100% green (`state-success`), 50%
  amber (`state-warn`), 0% red (`state-error`) — blended with `color-mix(in oklab, …)` over those
  tokens, with the band token as the always-valid `stroke` fallback. Track = `border-l2`.
- Center marks are the providers' own logo silhouettes (OpenCode / Kimi / DeepSeek from Simple
  Icons, CC0; the Z.AI two-arm mark clipped from z.ai's own favicon), drawn monochrome with
  `currentColor` so they follow the theme; an unknown provider falls back to its letter mark.
- Hover or keyboard focus on the balance row or a ring opens ONE tooltip card anchored to the whole
  widget (left/right = 0, so it can never overflow the sidebar and the rightmost ring cannot clip
  it), with a strong raised-surface shadow and a head row; content is every wallet (recharge and
  bonus) for the official account, and both windows plus relative reset times for a provider.
  Chrome copy goes through `ctx.locale.register('quota-widget', …)`; raw Host failure details are
  mapped onto localized categories instead of shown as English text.
- Polling starts only while the sidebar is expanded (the 56 px rail renders nothing); the read
  carries a 15 s deadline and is aborted on unmount.
- The widget blends into the sidebar: transparent background, one `border-l1` top separator,
  `label-secondary` chrome, no card fill. All chrome colors come from `--dsw-alias-*` tokens; no
  Harness Client package imports.
