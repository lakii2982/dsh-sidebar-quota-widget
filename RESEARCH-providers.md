# Provider quota research — OpenCode Go / Kimi For Coding / Z.AI GLM Coding

Research for the Host half of `dsh-sidebar-quota-widget` (`providers.mjs`).

> 说明：下文所有响应数值、百分比与时间戳均为**示例值**（已脱敏），接口路径与字段结构是实测的。

- **Tested at:** 2026-11-03, 16:29–16:37 Asia/Shanghai (08:29–08:37 UTC). Every "live" number below was
  produced in that window.
- **Method:** read the three API keys from the local DSH credential store
  `~/.dsh/.credentials.yaml` (`refs.OPENCODE_GO_API_KEY`,
  `refs.KIMI_CODING_API_KEY`, `refs.ZAI_CODING_CN_API_KEY`) inside a script, pass each
  key **only** into the `Authorization` request header, GET only, 12 s hard timeout.
  No key, token, account id or response body that could echo one is reproduced here.
  No chat/completions or other paid endpoint was called.
- **Runner:** Node v24.18.1 on macOS (this machine), built-in `fetch` / `AbortSignal.any`.
- **Scratch scripts:** `/tmp/quota-research/` (`probe.mjs`, `probe2.mjs`, `verify.mjs`,
  `shapes.mjs`, downloaded prior-art sources in `pkgs/`).
- **Implementation:** `dsh-sidebar-quota-widget/providers.mjs`; exports are exercised by
  `/tmp/quota-research/verify.mjs` against the real keys (results in §5) and by
  `/tmp/quota-research/shapes.mjs` against documented legacy payload variants.

**Bottom line:** all three providers expose a real HTTP usage endpoint that accepts the
provider's API key, and all three were answered **HTTP 200 with the real keys**. No CLI
fallback is needed or used.

---

## 1. Summary

| provider id | endpoint (confirmed live) | auth | HTTP (real key) | 5 h source | 7 d source |
|---|---|---|---|---|---|
| `opencode-go` | `GET https://opencode.ai/zen/go/v1/usage` | `Authorization: Bearer <key>` | **200** | `usage.rolling` | `usage.weekly` |
| `kimi-coding` | `GET https://api.kimi.com/coding/v1/usages` | `Authorization: Bearer <key>` | **200** | `usages.limit_5h` (legacy: `limits[].window.duration=300`) | `usages.limit_7d` (legacy: top-level `usage`) |
| `zai-coding-cn` | `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit` | `Authorization: Bearer <key>` (raw key also accepted) | **200** | `limits[type=TOKENS_LIMIT\|CREDIT_LIMIT, unit=3]` | `limits[…, unit=6]` |
| `zai-coding-cn` (cross-check) | `GET https://api.z.ai/api/monitor/usage/quota/limit` | same | **200**, identical payload | same | same |

All four requests above were actually performed with the real credentials; see §2–§4 for
the redacted bodies and §5 for the normalized probe output.

---

## 2. `opencode-go` — OpenCode Go subscription

### Confirmed endpoint

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <OPENCODE_GO_API_KEY>
Accept: application/json
```

Host/path audited against two independent sources before testing:

- OmniRoute PR “use official OpenCode Go usage API” — states the endpoint is
  `GET https://opencode.ai/zen/go/v1/usage`, API-key authenticated, replacing the older
  dashboard/workspace-cookie scraping path
  (<https://github.com/cheaper-inference/OmniRoute/pull/12124>).
- `ai-usagebar` crate v1.12.0, `src/opencode_go/fetch.rs`: `BASE_URL = "https://opencode.ai/zen/go/v1/usage"`,
  `Authorization: Bearer <key>` (verified in its own tests), `Accept: application/json`.

### HTTP result with the real key

`HTTP 200` in 0.9–1.7 s (three calls during the window).

### Redacted live payload

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 20, "resetsAt": "2026-01-01T00:00:00.000Z" },
    "weekly":  { "status": "ok", "percent": 30, "resetsAt": "2026-01-08T00:00:00.000Z" },
    "monthly": { "status": "ok", "percent": 20, "resetsAt": "2026-02-01T00:00:00.000Z" }
  }
}
```

(A later probe the same minute returned `rolling.percent: 21`; the endpoint is live and
near-real-time, not a snapshot.)

### Mapping to `remainingPct` / `resetsAt`

| payload field | meaning | mapped to |
|---|---|---|
| `usage.rolling` | 5-hour rolling window | `fiveHour` |
| `usage.weekly` | 7-day window | `sevenDay` |
| `usage.monthly` | calendar-month window | **ignored** (widget has no monthly ring) |
| `percent` | percent of the window **used**, 0..100 | `remainingPct = clamp(100 - percent)` |
| `status` | `"ok"` or `"rate-limited"` | `"rate-limited"` ⇒ `remainingPct = 0` regardless of `percent` |
| `resetsAt` | RFC 3339 string | `resetsAt = Date.parse(...)` epoch ms |

`percent = used` (not remaining) is settled by the OmniRoute PR wording (“normalize
percent … `status: rate-limited` is treated as effective 100% usage, so Provider Limits
shows 0% remaining”) and by `ai-usagebar`’s `opencode_go/types.rs` doc comments
(“Percentage … consumed”). Live values are consistent: `rolling.percent: 20` with a reset
≈ 4.6 h ahead.

`usage.monthly` is real but deliberately not mapped; like the current monthly figures it
will not appear in the widget.

### What failed / open questions

- `GET https://opencode.ai/zen/go/usage` → **404** (Next.js HTML page, not the API).
- `GET https://opencode.ai/zen/go/v1/key` (a guessed key-info endpoint) → **404**, empty body.
- No documented public rate limit. The OmniRoute PR uses a 60 s success TTL and a
  throttle; the widget’s 45 s Host cache is within the same order of magnitude.
- Assuming the plan has all three windows; if a plan omits `rolling`/`weekly` the
  adapter returns `state: 'error'` instead of inventing data (tested, §5).
- The response does **not** expose absolute dollars or a limit amount, only percentages;
  that is exactly what the ring needs.

---

## 3. `kimi-coding` — Kimi For Coding subscription

### Confirmed endpoint

```
GET https://api.kimi.com/coding/v1/usages
Authorization: Bearer <KIMI_CODING_API_KEY>
Accept: application/json
```

Path `<base>/coding/v1/usages` where the provider base is `https://api.kimi.com/coding`
(the same base the local Kimi Code CLI uses in `~/.kimi-code/config.toml`). Corroborated by
`ai-usagebar` v1.12.0 `src/kimi/{fetch,types}.rs` (`BASE_URL = "https://api.kimi.com"`,
`{base}/usages`), the oh-my-pi PR that documents the 5 h row shape
(<https://github.com/can1357/oh-my-pi/pull/5953>), and the response fields observed live.

### HTTP result with the real key

`HTTP 200` in ~0.25 s. A second call 8 min later returned the same shape.

### Redacted live payload (irrelevant/account fields dropped)

```json
{
  "usage": { "limit": "100", "used": "58", "remaining": "42",
             "resetTime": "2026-01-03T00:00:00.000000Z" },
  "limits": [
    { "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" },
      "detail": { "limit": "100", "remaining": "100",
                  "resetTime": "2026-01-01T00:00:00.000000Z" } }
  ],
  "usages": {
    "limit_5h": { "used_ratio": 0,      "reset_time": "2026-01-01T00:00:00Z" },
    "limit_7d": { "used_ratio": 0.578, "reset_time": "2026-01-03T00:00:00Z" }
  }
}
```

(`booster_wallet` and `user_id`-bearing objects were present; omitted here because they
carry account identifiers and are not quota data.)

**This account does have both a 5-hour and a 7-day window.** The 7-day window is 57.8 %
used at test time, so `sevenDay.remainingPct ≈ 42.2`, not `null`. There is no monthly
credit pool on this key.

### Mapping to `remainingPct` / `resetsAt` (newest layout, live-verified)

| payload field | meaning | mapped to |
|---|---|---|
| `usages.limit_5h` | 5-hour rolling window | `fiveHour` |
| `usages.limit_5h.used_ratio` | fraction of the window **used**, 0..1 (4 dp) | `remainingPct = clamp((1 - used_ratio) * 100)` |
| `usages.limit_5h.reset_time` | RFC 3339 | `resetsAt` epoch ms |
| `usages.limit_7d` / `.used_ratio` / `.reset_time` | 7-day window | `sevenDay` |
| `usages.limit_month_total`, `limit_month_code` | monthly shared pool (other plans) | **ignored**; see below |

### Legacy layout (still handled as fallback)

Older plans/payloads (documented in the oh-my-pi PR and in `ai-usagebar/kimi/types.rs`)
carry the 5 h burst as:

```json
{ "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" },
  "detail": { "limit": "100", "remaining": "100", "resetTime": "…" } }
```

and the 7-day quota as the top-level `usage` block (`limit` / `used` / `remaining`).
Adapter order: `usages.limit_5h/limit_7d` first → `limits[]` duration-300 row for 5 h →
top-level `usage` for 7 d. Verified with stubs in `/tmp/quota-research/shapes.mjs`.

### Monthly-credit plans (`sevenDay: null`, never 100 %)

Some newer Kimi plans replaced the weekly window with a monthly shared credit pool
(`usage.limit_month_total`, `limit_month_code`; see also the public note that
`/coding/v1/usages` returns `limit_5h`, `limit_7d`, `limit_month_total`,
`limit_month_code`). If `usages` advertises a `limit_month_*` window and no `limit_7d`,
the top-level `usage` block is a **monthly** pool: the adapter returns `sevenDay: null`
and does not relabel it as a 7-day window. Stub-tested
(`kimi monthly-credit plan => sevenDay: null`, see §5).

### Precision note

The legacy integer fields say `used: 94 / limit: 100` (58.00 %) while
`limit_7d.used_ratio` says `0.578` (57.8 %). The ratio is the finer source and is
preferred, so the reported `remainingPct` is `42.2`, not `43`. Both were consistent in
direction; no contradictory-ratio bug was observed on this key (contrast the public
“contradictory legacy/ratio response” report, which the ratio-first rule also survives —
stub-tested).

### What failed / open questions

- `GET https://api.kimi.com/coding/v1/usage` (singular) → **404**
  `{"error":{"message":"The requested resource was not found",…}}`.
- `GET https://api.kimi.com/coding/v1/me` → **200**; returns the profile (email/phone/
  nickname are personal data) and `user_level_name: "Allegretto"` (the plan tier). Not
  needed for quota; the adapter does not call it, and nothing personal is stored.
- Kimi also supports an OAuth session credential (Kimi Code CLI login) for the same
  endpoint. We deliberately use the **API key** only: no OAuth rotation/refresh logic in
  the Host, no reading of `~/.kimi-code` credentials.
- Not verified: whether a plan can advertise a 5 h window with a non-300-minute
  `window.duration`. Adapter only accepts `duration === 300` + `*MINUTE*` (or missing
  unit) for the legacy row; unknown windows fall through to `fiveHour: null` rather than
  a guess.

---

## 4. `zai-coding-cn` — Z.AI / BigModel GLM Coding plan (CN)

### Confirmed endpoint

```
GET https://open.bigmodel.cn/api/monitor/usage/quota/limit
Authorization: Bearer <ZAI_CODING_CN_API_KEY>
Accept: application/json
Accept-Language: en-US,en
```

Note the endpoint sits at the **host root**, not under the provider’s OpenAI-compatible
base path: `https://open.bigmodel.cn/api/coding/paas/v4/monitor/usage/quota/limit` → **404**
(`{"timestamp":…,"status":404,"error":"Not Found","path":"/v4/monitor/usage/quota/limit"}`).
Confirmed against `pi-zai-usage` README/code (`GET {base}/api/monitor/usage/quota/limit`,
`base` = `open.bigmodel.cn` for `zai-coding-cn`/bigmodel, else `api.z.ai`) and
`ai-usagebar` v1.12.0 `src/zai/fetch.rs`
(`QUOTA_URL = "https://api.z.ai/api/monitor/usage/quota/limit"`).

### HTTP result with the real key

| request | status | elapsed |
|---|---|---|
| `open.bigmodel.cn/api/monitor/usage/quota/limit` with `Authorization: Bearer <key>` | **200** | 276 ms |
| same URL with raw key (no `Bearer `) | **200** | ~280 ms |
| `api.z.ai/api/monitor/usage/quota/limit` with `Authorization: Bearer <key>` | **200** | 2.8 s |
| `open.bigmodel.cn/api/coding/paas/v4/monitor/usage/quota/limit` | **404** | 73 ms |

The CN and international hosts returned **byte-identical quota content** for this key.

### Redacted live payload

```json
{
  "code": 200, "msg": "操作成功", "success": true,
  "data": {
    "level": "lite",
    "limits": [
      { "type": "CREDIT_LIMIT", "unit": 3, "number": 5,
        "usage": 2000, "currentValue": 0, "remaining": 2000, "percentage": 0 },
      { "type": "CREDIT_LIMIT", "unit": 6, "number": 1,
        "usage": 10000, "currentValue": 0, "remaining": 10000, "percentage": 0,
        "nextResetTime": 1795000000000 }
    ]
  }
}
```

(`msg` was `"操作成功"` for the CN host and `"Operation successful"` for `api.z.ai`.)

The bucket `type` was **`CREDIT_LIMIT`**, not the older `TOKENS_LIMIT` — the API renamed
it. Both spellings must be accepted (also documented in `ai-usagebar/src/zai/types.rs`:
*“The API renamed the bucket type from `TOKENS_LIMIT` to `CREDIT_LIMIT`; both spellings
denote the same session/weekly windows”*).

### Mapping to `remainingPct` / `resetsAt`

| payload field | meaning | mapped to |
|---|---|---|
| `data.limits[]` where `type ∈ {TOKENS_LIMIT, CREDIT_LIMIT}` and `unit == 3` | 5-hour rolling token window | `fiveHour` |
| … `unit == 6` | 7-day window | `sevenDay` |
| `percentage` | percent of the window **used**, 0..100 | `remainingPct = clamp(100 - percentage)` (primary) |
| `remaining` / `usage` | remaining / total quota (integer) | fallback `remainingPct = remaining / usage * 100` |
| `currentValue` / `usage` | used / total quota | second fallback `100 - currentValue / usage * 100` |
| `nextResetTime` | epoch **ms** | `resetsAt`; `null`/`0`/missing ⇒ `null` |
| `type == "TIME_LIMIT"` (`unit 5`) | monthly MCP/tools ceiling | **ignored** |
| `data.level` | plan tier (`lite`) | not mapped (widget has no tier text) |

`unit` codes are undocumented but consistent across three independent sources
(`pi-zai-usage`, `ai-usagebar`, z.ai frontend-derived public notes): `3` = 5-hour session,
`6` = 7-day, `5` = monthly tools. `number` reads as “5 hours” / “1 week” and is only used
as a last-resort fallback if `unit` is ever renumbered.

`percentage = used` was cross-checked against the arithmetic fields in the same live
response: `percentage: 0`, `currentValue: 0`, `remaining: 2000 == usage: 2000` → 0 % used,
100 % remaining — all three agree. Both prior-art implementations also treat it as
utilization (used).

### Live windows observed

- 5 h: `usage 2000`, 0 used, `percentage 0` → **remainingPct 100**, `nextResetTime`
  **absent** (the 5 h bucket only reports a reset time once the window is running/used;
  a captured public payload with usage had `nextResetTime` on the unit-3 row, and the
  adapter maps it when present). So `fiveHour.resetsAt: null` here is genuine, not a bug.
- 7 d: `usage 10000`, 0 used, `percentage 0` → **remainingPct 100**, reset
  `1795000000000` = `2026-01-08T00:00:00.000Z`.

### Auth-header quirk (important for the Host)

Public prior art disagrees:

- `ai-usagebar/src/zai/fetch.rs` says *“the API key is passed as `Authorization: <KEY>`
  WITHOUT the `Bearer` prefix. Sending `Bearer …` returns 401.”*
- `pi-zai-usage` sends `` `Bearer ${apiKey}` `` and is in production use.

With the real CN key **both forms returned 200** in this test (and `api.z.ai` accepted
`Bearer`). The adapter therefore sends `Bearer` first and retries once with the raw key on
401/403, so either future tightening works.

### What failed / open questions

- `open.bigmodel.cn/api/coding/paas/v4/monitor/usage/quota/limit` → **404** (see above).
- `api.z.ai` was slower (2.8 s) than the CN host (0.28 s) from this machine; the CN host is
  the right one for a `zai-coding-cn` key.
- Not verified: the exact `nextResetTime` presence rule for the 5 h bucket when the window
  is partially used (public captures show it present; this account had 0 usage). The
  adapter treats missing/`0` as `null`, so the ring still renders, only without a countdown.
- No documented rate limit. Console/undocumented endpoint; the same 45 s Host cache keeps
  this to ~4 requests/minute across all providers, which public tools comfortably exceed.

---

## 5. Normalized `probeProviderQuota` results (real keys, live)

Run: `node /tmp/quota-research/verify.mjs` on 2026-11-03 ~16:35 +08:00. Only normalized,
non-secret fields are printed (the script resolves keys through a child `python3` process
and never writes or logs them).

```json
{
  "opencode-go": {
    "state": "ok",
    "fiveHour": {  "remainingPct": 80,   "resetsAt": 1790000000000, "resetsAtIso": "2026-01-01T00:00:00.000Z" },
    "sevenDay": {  "remainingPct": 70,   "resetsAt": 1795000000000, "resetsAtIso": "2026-01-08T00:00:00.000Z" },
    "detail": null,
    "elapsedMs": 928
  },
  "kimi-coding": {
    "state": "ok",
    "fiveHour": { "remainingPct": 100,  "resetsAt": 1790000000000, "resetsAtIso": "2026-01-01T00:00:00.000Z" },
    "sevenDay": { "remainingPct": 42.2, "resetsAt": 1792500000000, "resetsAtIso": "2026-01-03T00:00:00.000Z" },
    "detail": null,
    "elapsedMs": 227
  },
  "zai-coding-cn": {
    "state": "ok",
    "fiveHour": { "remainingPct": 100,  "resetsAt": null,            "resetsAtIso": null },
    "sevenDay": { "remainingPct": 100,  "resetsAt": 1795000000000,   "resetsAtIso": "2026-01-08T00:00:00.000Z" },
    "detail": null,
    "elapsedMs": 283
  },
  "unknown-provider":    { "state": "unsupported", "fiveHour": null, "sevenDay": null, "detail": "No quota source is known for provider \"anthropic\"" },
  "missing-credential":  { "state": "no-credential", "fiveHour": null, "sevenDay": null, "detail": "No API key is configured for this provider" },
  "undefined-credential":{ "state": "no-credential", "fiveHour": null, "sevenDay": null, "detail": "No API key is configured for this provider" },
  "timeout-10s":         { "state": "error", "fiveHour": null, "sevenDay": null, "detail": "Quota request timed out after 10s", "elapsedMs": 10001 },
  "external-abort":      { "state": "error", "fiveHour": null, "sevenDay": null, "detail": "Quota request was cancelled" },
  "http-401-stub":       { "state": "error", "fiveHour": null, "sevenDay": null, "detail": "OpenCode Go rejected the API key (HTTP 401)" },
  "bad-json-stub":       { "state": "error", "fiveHour": null, "sevenDay": null, "detail": "Z.AI quota response is not a JSON object" },
  "throwing-fetch-stub": { "state": "error", "fiveHour": null, "sevenDay": null, "detail": "Quota request failed (ECONNRESET)" }
}
```

The three negatives above (`unsupported`, `no-credential`, `error` for 401 / bad JSON /
network throw) and the ~10 s timeout show that `probeProviderQuota` never throws and never
fabricates a percentage.

Shape tests (`node /tmp/quota-research/shapes.mjs`, stub fetch, no secrets):

```
kimi monthly-only (usages.limit_7d + usage) => ok, fiveHour null, sevenDay 42.2 %
kimi legacy limits[] only                   => ok, fiveHour 40 %, sevenDay 75 %
kimi ratio wins over legacy                 => ok, fiveHour 0 %,  sevenDay 50 %
kimi monthly-credit plan (limit_month_*)    => ok, fiveHour 80 %, sevenDay null   <-- correct null, not 100 %
zai TOKENS_LIMIT legacy                     => ok, fiveHour 58 %, sevenDay 85 %, nextResetTime parsed
zai percentage missing, remaining/usage      => ok, fiveHour 75 %, sevenDay 75 %
zai success:false                            => error, "Z.AI quota request was rejected (code 1001)"
opencode rate-limited rolling                => ok, fiveHour 0 %, sevenDay 70 %
opencode monthly-only                        => error, "no rolling/weekly windows"
non-JSON 200                                 => error, "… is not a JSON object"
```

---

## 6. CLI investigation (recorded, not used)

No CLI path is needed for any provider, and `probeProviderQuota` therefore uses **HTTP
only**, no `node:child_process`.

- `~/.kimi-code/bin/kimi --help` (v?) lists no usage/quota subcommand;
  `kimi usage --help` just prints the top-level help. The CLI’s own home
  (`~/.kimi-code/`) holds config (`config.toml` → `base_url = "https://api.kimi.com/coding/v1"`),
  OAuth credentials and session logs — none of which are needed, and reading them would
  mean parsing personal data.
- `~/.opencode/bin/opencode --help` subcommands are
  `upgrade/uninstall/acp/api/debug/auth/mcp/plugin/models/stats/mini/run/session/service/reload/pair/serve`.
  `opencode stats` is **local** token/cost statistics, not server quota; there is no
  `usage`/`quota` command. Both CLIs were probed read-only with `--help` (exit 0).
- Z.AI has no local CLI on this machine.

---

## 7. Risks / notes for the Host plugin at runtime

1. **Auth header style**
   - OpenCode Go and Kimi: plain `Authorization: Bearer <key>`, no extra header required
     (verified with only `Bearer` + `Accept`).
   - Z.AI: `Bearer` works today on both `open.bigmodel.cn` and `api.z.ai`; the raw key also
     works. Public tools disagree on which is required, so `providers.mjs` retries raw on
     401/403. If Z.AI ever flips to raw-only, the retry covers it — but it doubles one
     failed request, so keep the 45 s snapshot cache.
2. **Rate limits / etiquette**: none documented; these are console-grade endpoints. One GET
   per provider per 45 s cache refresh (~4 req/min total) is well within what public
   quota tools do. Do not poll faster than the client’s `refreshAfterMs` (~60 s).
3. **Hosts / proxies**: `opencode.ai` (0.9–1.7 s), `api.kimi.com` (0.2 s),
   `open.bigmodel.cn` (0.3 s) were reachable directly from this machine; no proxy needed.
   `api.z.ai` was slower (2.8 s) and is only a fallback. If the Host process runs with
   restricted egress, all three become `state: 'error'` with a network detail — the widget
   must degrade, not block the snapshot.
4. **Redirects**: `opencode.ai/zen/go/v1/usage` returns JSON directly (no redirect trial
   needed); adapter uses `redirect: 'follow'` and `cache: 'no-store'`.
5. **Response sizes** are small (≤ 2 KB); parse with `response.text()` + `JSON.parse` (done)
   rather than streaming, and never log the body — the Kimi body carries account ids and a
   booster wallet, and Z.AI’s `msg` is localized text.
6. **Timeouts**: per probe ≈ 10 s (`AbortSignal.any([callerSignal, AbortSignal.timeout(10s)])`
   when available, manual controller otherwise). Note `AbortSignal.timeout()` is unref’d in
   Node: in a process with nothing else on the event loop the timer does not keep it alive —
   irrelevant for the Host (an HTTP server + cache keep it alive), but test harnesses need a
   keep-alive (as `/tmp/quota-research/verify.mjs` does).
7. **Semantics to preserve**: every source reports **percent used**; the adapter converts to
   remaining with clamp. Do not “fix” this in the Host/client — the raw values are not
   remaining.
8. **Window absence is real**: `sevenDay: null` for Kimi monthly-credit plans and
   `fiveHour.resetsAt: null` for an unused Z.AI 5 h bucket are genuine `null`s. The client
   contract already allows `null`; do not substitute 100 %.
9. **Unverified drift risks**: Z.AI may rename bucket `type` or renumber `unit` (adapter
   accepts both known type names + `number` fallback and errors out on unknown layouts);
   Kimi may return the legacy `limits[]` shape on older plans (handled); OpenCode may add a
   new window name (ignored). Each unexpected layout yields `state: 'error'` with a short
   detail instead of fabricated numbers.

---

## 8. Prior art / references used for cross-checking

- OmniRoute PR “use official OpenCode Go usage API” — <https://github.com/cheaper-inference/OmniRoute/pull/12124>
- `ai-usagebar` crate 1.12.0 sources (`src/zai/*`, `src/opencode_go/*`, `src/kimi/*`) —
  downloaded from crates.io to `/tmp/quota-research/pkgs/ai-usagebar-1.12.0`, used only as
  documentation of wire shapes.
- `pi-zai-usage` README + `extensions/zai-usage.ts` (npm 0.1.4) — unit-code table and the
  Bearer/no-Bearer disagreement.
- oh-my-pi PR #5953 (Kimi `usages` shape, `resetTime` on `detail`) —
  <https://github.com/can1357/oh-my-pi/pull/5953>; issue #12790 (Kimi `limit_month_*`
  aggregate windows, `limit_5h` in `usages`).
- CodexBar Kimi notes and “contradictory legacy/ratio response” issue — corroborate the
  ratio-first rule.
- OpenCode Go public plan limits ($12 / 5 h, $30 / week, $60 / month) — presentation only;
  not used for math because the API reports percentages directly.

---

## 9. Reproduction

```sh
# live probes (keys resolved from ~/.dsh/.credentials.yaml, never printed)
node /tmp/quota-research/verify.mjs      # all three providers + negative cases
node /tmp/quota-research/shapes.mjs      # legacy/edge payload variants (stub fetch)
node --check dsh-sidebar-quota-widget/providers.mjs
```

No API key was written to any file in this workspace or in `/tmp/quota-research/`; the
scratch scripts read the credential store at runtime through a child process.
