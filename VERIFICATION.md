# Independent verification — `dsh-sidebar-quota-widget`

Verifier: teammate `verifier` (adversarial review, read-only except this file).

> 说明：本文件中的余额、百分比与时间戳均为**示例值**（已脱敏），不代表任何真实账户余额或用量。
Date: 2026-11-03 ~17:08 Asia/Shanghai. Live GUI origin: `http://127.0.0.1:55023`.
Profile: `desktop` (`DSH_PROFILE=desktop`, `DSH_PROFILE_DIR=~/.dsh/profiles/desktop`).

## 0. Snapshot identity — IMPORTANT caveat

The bundle files were **edited while this verification was running** (not by me; I wrote only this file):

| file | size | mtime |
|---|---|---|
| `index.js` | 12 130 B | 2026-11-03 17:01:39 |
| `client.js` | 19 183 B | 2026-11-03 16:55:48 |
| `providers.mjs` | 23 057 B | 2026-11-03 16:36:04 |
| `CONTRACT.md` | 5 752 B | 2026-11-03 16:48:36 |
| `package.json`, `cordis.patch.yml`, locale, icon | — | 16:29 |

Consequences:

- The code review below is against the **current files at 17:07** (`index.js` 364 lines, `client.js` 442 lines, `providers.mjs` 646 lines). Two defects I observed in the first read (16:51) were already fixed by the concurrent editor: `official.bonusWallets: []` was missing from the `unavailable` branch, and provider rings had only `aria-label = provider.name` (now a 5h/7d summary).
- The **running Host process (PID 66830) started Mon 2026-11-02 23:56:58**, the bundle was installed/linked ~16:39, and files were edited up to 17:01. A module loaded in the Host process is not re-imported by editing a linked file; the live route may be serving a generation **older than the reviewed files**. The client half in the browser may likewise be an older bundle. The live checks prove *a* working generation exists; they do not prove the reviewed files are what the user is running. **A restart (or a verified HMR reload plus an unchanged slot/bundle id) is required before claiming current files == live behavior.**

## 1. Skill rules — PASS (with two notes)

Read: `.../skills/cordis-plugin-development/SKILL.md` + `references/{ui-plugin,host-plugin,practices,verification}.md` (read tool, inside `app.asar`), and compared against `templates/decoration/*`.

| rule | result | evidence |
|---|---|---|
| manifest `dsh.bundle.patch` | PASS | `package.json:21-22` → `./cordis.patch.yml`; patch `- insert: [{id: sidebar-quota-widget, name: 'dsh-sidebar-quota-widget'}]` |
| `exports`/`files` cover every runtime file | PASS | `package.json` exports `.`, `./client`, `./locale/*.json`, `./icon`; `files` = index.js, client.js, providers.mjs, cordis.patch.yml, locale/*.json, icon.svg — all exist (verified `ls`) |
| `dsh.client` platform/immediately/inject valid | PASS | `platform: "web"`, `immediately: true`, `inject: ["@deepseek-ai/dsh-client-ui-sidebar", "@deepseek-ai/dsh-client-locale"]` — both are real client packages; inject only orders activation (per `references/ui-plugin.md`) |
| display metadata (`meta.title`/`meta.description`, en+zh, meaningful) | PASS | `locale/en.json` "Sidebar Quota Widget" / description; `locale/zh.json` "侧边栏额度工具栏" / description — both meaningful, not template copy |
| icon valid SVG ≤256 KiB, original | PASS | `icon.svg` 769 B, well-formed SVG 48×48, hand-drawn concentric rings + dot, no external refs/embedded raster, no third-party mark |
| no Harness Client package imports | PASS | `client.js:1-4` only `window.__ModuleLoader__.load` + `require('react')`; no `dsh-client-*` import; `providers.mjs` has zero imports |
| no `document.body`/app-root writes | PASS | grep: no `document.` / `body` / `createRoot` in `client.js` |
| theme tokens only for chrome | PASS | all colors in `client.js` STYLE are `var(--dsw-alias-*)`; literal colors exist only in `icon.svg` artwork. Every token used exists in the installed theme bundle (`@deepseek-ai/dsh-client-ui-theme/lib/client.js`): state-success/warn/error/idle-primary, border-l1/l2, bg-layer-1, bg-overlay, label-primary/secondary, brand-primary |
| timers/listeners disposed | PASS | client poll timer cleared on unmount (`client.js:113-116`); `providers.mjs` `composeSignal` clears its timer and removes the abort listener in `cleanup()` (`providers.mjs:194-200`, called in `finally` `:575-577`); no Host listeners |
| `ctx.effect` ownership for Host route + locale dicts | PASS | `index.js:360-363` `ctx.effect(() => ctx.webServer.register(...), ...)` (same pattern as `client-modules`); `client.js:401-402` locale registers inside `ctx.effect`; slot registration inside `ctx.slots.inject` |
| no second React / no HTML/iframe page | PASS | React comes from the module table; no iframe/page/HTML served |
| no user-visible untranslated copy | **NOTE** | All chrome copy goes through `ctx.locale` (23 keys in both en+zh, sets equal). Exception: Host-generated `detail` strings are English-only and are rendered verbatim in tooltips — see defect D1 |
| no leftover debug markers/counters | PASS | grep `console.|debugger|TODO|FIXME|?probe|counter` → none in index.js/client.js/providers.mjs |
| `dsh.client.immediately:true` appropriate | PASS | same as the shipped decoration template |

## 2. Host service usage — PASS (inspection + live behaviour)

Service contracts checked against the installed implementation (`app.asar`):

- `deepseekAccount.getBalance(client: AccountClientMetadata)` → `AccountDetails['balance'] | null`; `AccountClientMetadata = { version, locale, timezoneOffsetSeconds }` (verified in `@deepseek-ai/dsh-deepseek-account/lib`); implementation returns `{ status: 'ready', value: normal_wallets, bonusWallets: bonus_wallets }` or `null` (verified in `@deepseek-ai/dsh-deepseek-account-platform/lib/index.js`). Plugin usage matches: optional service checked (`index.js:137-147`), `null` → signed-out, `status !== 'ready'` → error, `balance.value` and `balance.bonusWallets` mapped, wallet shape filtered by string balance. The account service applies its own `balanceTimeout`, so the missing per-call abort is not an unbounded-wait risk.
- `credentials.resolve(ref)` → `{ value, source } | undefined` (verified from `@deepseek-ai/dsh-credentials` README/lib). Plugin resolves per call, in candidate order, catches failures, requires non-empty string (`index.js:209-223`). It passes a plain string instead of the branded `credentialRef(...)`; the brand is compile-time only, runtime works (live route proves it: all 3 providers resolved credentials and returned `state: "ok"`).
- `llm.listProviders()` → synchronous `[{id, name}]` (verified in `@deepseek-ai/dsh-llm/lib/index.js`). Plugin awaits it (await of a sync value is harmless), filters routes matching `/^(deepseek|deepseek-)/i`, and live output contains only the 3 non-official providers.
- `webServer.register({ kind:'prefix', path, handler })` → disposer; duplicate paths throw (verified in `@deepseek-ai/dsh-host-webserver/lib/index.js`). Plugin registers `{kind:'prefix', path:'/quota-widget'}` once and disposes via `ctx.effect`.
- Error handling: the whole request handler body is in `try/catch` → 500 envelope (`index.js:344-357`); `readOfficial` never throws; `readProvider` never throws; `snapshot()` shares one in-flight compose and applies `AbortSignal.timeout(20_000)`; snapshot TTL 45 s (`index.js:30,317-328`).
- Exposure: loopback-only. `isLoopbackRequest` requires a loopback `Host`, rejects `sec-fetch-site: cross-site`, and enforces same-origin `Origin` when present (`index.js:63-88`). Verified live (below). No credential value, provider host, or raw payload is ever placed in the response; `detail` strings are HTTP-status wording only (grep for key material in the bundle found nothing).
- Notes (not defects, but disclosed): `POST /refresh` clears the cache on every call → a loopback caller can force upstream provider probes more often than the 45 s TTL (no rate limit); the route is not behind the GUI auth token (any local process can read balance/quota, but no secrets).

## 3. Live route — PASS (all curl checks)

Commands and observed results (2026-11-03 16:51–17:07):

1. `curl -s -i -m 20 http://127.0.0.1:55023/quota-widget/snapshot`
   → `HTTP/1.1 200 OK`, `content-type: application/json; charset=utf-8`, `cache-control: no-store`,
   body `{"ok":true,"value":{"generatedAt":1793695…,"refreshAfterMs":60000,"official":{"label":"DeepSeek 官方","status":"ok","wallets":[{"currency":"CNY","balance":"123.4500000000000000","display":"¥123.45"}],"bonusWallets":[{"currency":"CNY","balance":"0","display":"¥0.00"}],"display":"¥123.45","detail":null},"providers":[{"id":"opencode-go",…},{"id":"kimi-coding",…},{"id":"zai-coding-cn",…}]}}`.
2. Field-by-field contract validation script (types, enums, ranges, exact key sets, no extra keys, no secret substrings, no official-route leakage, no duplicate ids):
   `{"errs":[], "status":200, "officialStatus":"ok", "officialDisplay":"¥123.45", "wallets":1, "bonuses":1, "providers":[{"id":"opencode-go","state":"ok","five":80,"seven":70,"mark":"O"},{"id":"kimi-coding","state":"ok","five":90,"seven":42.199999999999996,"mark":"K"},{"id":"zai-coding-cn","state":"ok","five":100,"seven":100,"mark":"Z"}]}`
   → 0 violations. All `remainingPct` in 0..100, all `resetsAt` epoch-ms or null, all `state` in the contract enum, `official.status` in enum, `display` string, `bonusWallets` always an array, no debug fields, no secret material (`sk-`, `Bearer`, `token`, env names, etc. absent). Detailed validation script re-run at 17:07 → `errs: []`.
3. `GET /quota-widget/other` → `HTTP/1.1 404 Not Found`, body `{"ok":false,"error":{"code":"not-found","message":"unknown quota widget endpoint"}}` (+ `cache-control: no-store`).
4. `POST /quota-widget/refresh` → `HTTP/1.1 200 OK`, same `{"ok":true,"value":…}` envelope, fresh `generatedAt`.
5. `curl -H 'sec-fetch-site: cross-site' …/snapshot` → `HTTP/1.1 403 Forbidden`, `{"ok":false,"error":{"code":"forbidden","message":"this route is loopback-only"}}`.
6. `curl -H 'Origin: http://evil.example' …/snapshot` → `HTTP/1.1 403 Forbidden` (origin check).
7. `curl -H 'Origin: http://127.0.0.1:55023' …/snapshot` → `200` (first-party page passes).
8. `Cache-Control: no-store` present on every response (200/403/404).
9. Cross-check against `RESEARCH-providers.md` §5: live `resetsAt` values match the research run (opencode-go `1790000000000`/`1795000000000`; Kimi 5h `1790000000000`; Kimi 7d remaining `42.2` matches the researched `0.578` used-ratio conversion). Semantics are remaining-direction: doc says `percent`/`percentage`/`used_ratio` are **used**, adapters convert to remaining (`100-used`, `(1-ratio)*100`), consistent with live values (Kimi 7d = `(1 - used_ratio) * 100` remaining).

Minor data-quality nit: `sevenDay.remainingPct` can serialize with a float artifact such as `42.199999999999996` (float artifact); the client formats to 1 decimal (contract allows any number 0..100), so cosmetic only.

## 4. Live client registration — UNVERIFIED (environment), source-level PASS

- Every `cordis_inspect_query` **client** call times out: `Slots.listSubTree` (3 attempts: 16:52, 16:57, 17:07), `Theme.listTokens`, `Builtin.listBuiltins` → all `Client inspect query … timed out after 10000ms. Open or reconnect the Harness page, then retry.` So I cannot read the live `sidebar.footer.action` occupant list, its active flag, or owner props.
- The GUI index is auth-gated (`curl http://127.0.0.1:55023/` → `dsh web authentication required; reopen the URL printed by dsh web.`) and `/plugins/…` bundle URLs 404 without the revisioned combo query, so the live boot graph / slot tree was not readable without hunting auth tokens (out of scope).
- **Source-level PASS for the registration contract:** the slot is declared by the installed `@deepseek-ai/dsh-client-ui-sidebar` bundle as `"sidebar.footer.action": { kind: "list", scope: "root" }`, rendered as `renderSlot("sidebar.footer.action", { wide })` — **owner props are only `{ wide }`** (`…/dsh-client-ui-sidebar/lib/client.js`, SidebarRoot). The plugin registers exactly one occupant with `id: 'sidebar-quota-widget'`, `order: 0`, `name: 'sidebar.footer.action'` via `ctx.slots.inject(...)` + `ctx.slots.register(...)` (`client.js:414-424`), matching the shipped `templates/decoration/client.js` shape. `wide === false` returns `null` (`client.js:343`). No duplicate/second registration exists in the file.
- Whether the occupant is actually mounted and active in the user's live page remains **UNVERIFIED-WITHOUT-BROWSER**. The Lead (or a session with a connected page) should run `cordis_inspect_query` client `Slots.listSubTree` with `{"root":"sidebar.footer.action"}` — note that in *this* session all inspect `input` payloads are broken (see §9), so even that may fail here.

## 5. Plugin display metadata — PARTIAL (files PASS, rendered display UNVERIFIED)

- Read-only `plugin_manager list_bundles`: our entry →
  `{"name":"dsh-sidebar-quota-widget","official":false,"availability":"profile","version":"1.0.0","description":"Sidebar quota widget: official DeepSeek account balance plus 5-hour / 7-day remaining-quota rings for every other connected provider.","source":"link:~/Documents/deepseek-harness/default-workspace/dsh-sidebar-quota-widget","enabled":true,"installed":true,"optional":false,"removable":true,"rows":[{"rowId":"sidebar-quota-widget","moduleName":"dsh-sidebar-quota-widget","entryId":"include:sidebar-quota-widget"}],"overrides":[]}` → bundle is **installed + enabled** with exactly one Host row.
- The manager does **not** expose the locale `meta.title`/`meta.description` or any icon field for profile bundles; it reports the `package.json` description instead. Therefore I verified those resources directly: locale meta title/description present and meaningful in en+zh; `icon.svg` valid, 769 B, declared via `exports["./icon"]` and listed in `files`.
- Rendered title/description/icon in Plugin Manager / Settings and the actual sidebar rendering are **UNVERIFIED-WITHOUT-BROWSER** (no DOM/screenshot control allowed or available).

## 6. Code-level correctness review — PASS with low-severity defects

Files read in full (current versions): `index.js`, `providers.mjs`, `client.js`, `CONTRACT.md`, `RESEARCH-providers.md`, locale/icon/package/patch.

Checked and correct:

- **Percentage direction vs research:** opencode-go `percent` = used → `100-percent`; Kimi `used_ratio` = used → `(1-ratio)*100`; Z.AI `percentage` = used → `100-percentage` with `remaining/usage` then `currentValue/usage` fallbacks; `rate-limited` → 0 remaining; monthly bucket ignored; Kimi monthly-credit plans return `sevenDay: null` (never fabricated 100%). All match `RESEARCH-providers.md` §2–§4 and live values.
- **Clamping:** both layers clamp to 0..100 (`index.js:100-104`, `client.js:121-125`); non-finite → null.
- **null vs 0:** unknown window (`null`) renders an empty arc with the idle token + "unknown"/"no window" copy; 0 remaining renders an empty arc with the error color; no conflation in data.
- **State mapping:** unknown probe states collapse to `'error'` (`index.js:285-288`); state enum only ok/no-credential/unsupported/error.
- **Error paths never throw:** probes catch all; `parse*` throw `ProbeFailure` only inside the probe; `providerRoutes`/`credentialOf` catch; route wraps and answers 500.
- **Timeouts/abort:** per-probe 10 s composed with the caller signal; `AbortSignal.any` feature-checked (`providers.mjs:167-201`); Windows-style fallback controller + listener cleanup; Host compose `AbortSignal.timeout(20_000)`; account service has its own balance timeout.
- **Credential candidate order:** most-specific first (`OPENCODE_GO_API_KEY` → `OPENCODE_API_KEY`, etc.) and matches the profile's `llm-pi-ai` `apiKeyEnv` values.
- **Official branch:** `null` → signed-out, non-ready → error, non-array wallets → empty arrays, wallet type filters, `display` joined with ` · `, all branches include `wallets`+`bonusWallets`+`display`+`detail` (the current file fixed the one branch that lacked `bonusWallets`).
- **Client polling + cleanup:** initial load, `refreshAfterMs` honored with 15 s floor, timer cleared on unmount, disposed guard.
- **Tooltip robustness:** no crash for `state: error` / `no-credential` / `unsupported` / null windows / `official === null`; wallet arrays guarded; reset-time text handles past times (`reset.now`).
- **`color-mix` fallback:** `stroke` attribute always carries a valid band token; `style.stroke` is the `color-mix(in oklab, …)` blend (`client.js:132-158, 261-274`) — if `color-mix` is unsupported the attribute still paints.
- **Locale completeness:** every literal `t('…')` key exists in both dicts; en and zh key sets are identical (23/23); placeholders `{hours}`/`{minutes}` present in both; dynamic `t('currency.'+code)` covered by `currency.CNY`/`currency.USD` (Host forces currency to CNY/USD).
- **`wide === false`:** renders nothing; polling still starts (see D5).
- **No stale `?probe` query/counters:** none.
- **A11y:** group `aria-label`, SVG `aria-hidden`, focus-visible outline, ring `aria-label` now includes the 5h/7d remaining summary; balance row is keyboard-focusable; tooltip is not aria-hidden (visible text). Remaining nit: tooltip content inside `role="img"` is not announced, and the balance row is a focusable `div` without a role/aria-label.

## 7. Honest visual limit — UNVERIFIED-WITHOUT-BROWSER

Could verify: files/JSON/SVG validity, tokens used exist in the installed theme, slot/owner-prop contract from the sidebar bundle, live Host route output, Host row live/active.
Could **not** verify: actual rendering of the toolbar above the account row, ring geometry/arc appearance, green→amber→red interpolation appearance, tooltip hover/focus behaviour and clipping inside the sidebar footer, light/dark theme appearance, widget visibility in the live page, and whether the live page runs the current `client.js`. No screenshot, DOM emulation, or browser preview was used (prohibited), and the client Inspect channel is dead in this session (§4). **Do not claim visual success from this report.**

## 8. Regression check — PASS

`plugin_manager list_plugins` (paged, read-only) at 17:00:

- `include:sidebar-quota-widget` → `enabled: true, fiberPhase: "active", patchId: "sidebar-quota-widget"`.
- Spot-checks all active: `include:ui-sidebar`, `include:ui-settings-account`, `include:llm-pi-ai`, `include:subagent-codex`, `include:subagent-claude-code`, `include:ui-conversation`, `include:locale`, `include:ui-theme` — all `fiberPhase: "active"`.
- Profile `package.json` dependencies + `dsh.profile.bundles` include `"dsh-sidebar-quota-widget": "link:~/Documents/deepseek-harness/default-workspace/dsh-sidebar-quota-widget"` and the bundle only inserts its own row, so nothing was overridden. `list_bundles` `overrides: []` for our bundle.
- Pre-existing (not caused by this bundle): profile `node_modules/@local/` also contains a stale symlink `agent-team-model-picker` that is not in `package.json` dependencies / bundles. Worth mentioning but unrelated.

## 9. Environment/tooling limitations found during verification

1. **`cordis_inspect_query` cannot pass a structured `input` in this session.** Every method-specific query (`host Service.listService {service}`, `host Config.listConfigs {name}`, client `Slots.listSubTree {root}`) is rejected with `… rejected input: "input" must be an object`, because the tool parameter is declared `type: 'json'` with no JSON-Schema type and the wire call stores the object as a **JSON string**. Evidence from this session's `tool/call` events: `{"input":"{\"service\": \"llm\"}","method":"listService",…}` and the Host error above. Passing a pre-serialized string, `{}`, or a nested invalid value gives the same error. No-input forms work (`Service.listService` catalog, `Config.listConfigs` page 1, `Tool.listTools`), which is what I used. This is a harness/tooling defect, not a plugin defect, but it means the checklist's intended `Config.listConfigs name=@local/...` query could not be executed — `plugin_manager` was used instead.
2. **Client Inspect channel dead:** all client queries time out after 10 000 ms (see §4).
3. **GUI index auth-gated:** the page HTML/boot graph is not readable without the authenticated URL; I did not search for or read any auth token.

## 10. Defect list (ordered by severity)

No high or medium-severity defect was found in the current files (live route contract, security envelope, service usage, percentage semantics, cleanup and locale completeness all pass). Remaining findings are low severity / informational:

| # | severity | file:line | defect |
|---|---|---|---|
| D1 | low | `client.js:207`, `client.js:248`; source `index.js:145,171,204`, `providers.mjs:250-261` | Error/`detail` copy is English-only Host text (`"account service unavailable"`, `"balance request failed"`, `"… rejected the API key (HTTP 401)"`, `"Quota request timed out after 10s"`) and is rendered verbatim in tooltips, so a zh-locale user sees untranslated English in the error states. All static chrome copy is localized; only these dynamic details are not. |
| D2 | low | `index.js:243-249` | Fallback `providerRoutes()` returns **every known adapter id** when the optional `llm` service is absent, `listProviders()` throws, or it returns an empty list — the widget then shows "no-credential" gauges for providers that are not locally connected, which contradicts the "one gauge per other locally connected provider" requirement. It should return `[]` when no connected routes can be enumerated. |
| D3 | low | `index.js:140,151,156,166,190,199` | Host payload is not locale-aware: `label` is hardcoded `'DeepSeek 官方'` and `AccountClientMetadata.locale` is always `'zh'`. Harmless today (the client localizes the name and the balance format is not locale-dependent for CNY/USD), but it makes the Host snapshot Chinese-only for any other consumer and ignores the user's language. |
| D4 | low | `index.js:349-352` | `POST /quota-widget/refresh` rejects the whole cache TTL on every call with no minimum interval, so any loopback process can force a fresh upstream probe of all 3 providers + account per request (potential upstream rate-limit / quota endpoint load). Route is loopback-only and unauthenticated (no secrets exposed). |
| D5 | low | `client.js:341-343` | `useSnapshot()` runs before the `wide === false` guard, so in the 56 px collapsed rail the widget still polls the Host every 60 s while rendering nothing. Minor wasted work; should check `wide` before starting the poll (e.g. keep hooks order by gating inside the effect). |
| D6 | low | `client.js:73-84,113-116` | The client `fetch` has no `AbortController`/timeout and the in-flight request is not aborted on unmount (the disposed flag only suppresses `setState`). A stalled Host route would leave a fetch pending until the browser aborts it; no crash. |
| D7 | info | `client.js:349` | If `official.status === 'ok'` but the Host reports zero wallets (`display: null`), the UI shows the "balance read failed" copy. Rare/edge (schema allows empty `normal_wallets`), copy is misleading rather than wrong data. |
| D8 | info | `client.js:294-295` (fixed in current file), `client.js:361-369` | A11y nits: provider ring tooltip content sits inside `role="img"` so screen readers get only the `aria-label` summary; the balance row is a focusable `div` without `role`/`aria-label`. Keyboard focus and focus-visible styling are present. |
| D9 | info | `index.js:110-117`, live JSON | `sevenDay.remainingPct` can serialize a float artifact (`42.199999999999996`); the client rounds to 1 decimal, contract permits it — cosmetic only. |
| D10 | design risk | `index.js:63-88` | Loopback-only guard + `Host` header requirement: if the GUI is ever opened through a non-loopback hostname (LAN/remote/`--host 0.0.0.0` advertised URL), the client fetch is rejected 403 and the widget silently degrades to "quota read failed". Acceptable for the local requirement, but must be disclosed. |

## 11. Risk the Lead must disclose to the user

1. **Live generation ≠ reviewed files.** The app process predates the last bundle edits (process start 2026-11-02 23:56; install ~16:39; `index.js` 17:01, `client.js` 16:55). Neither the Host module nor the browser bundle is proven to have reloaded. The user should restart the app (or verify an HMR reload) and re-check the widget before final acceptance; otherwise a stale build may be what they see.
2. **Visual acceptance is not established.** Ring colors/blending, tooltip placement/clipping, light/dark blending and the actual above-account-row placement were not verified (no browser control; client Inspect timed out). The user must confirm visually.
3. **Error text is English-only** in tooltips (D1) — visible in a Chinese UI when a provider/account request fails.
4. **Loopback-only + unauthenticated route:** quota/balance data is readable by any local process on the machine (no credentials), and the widget will not work if the GUI is accessed through a non-loopback hostname (D10/D4).
5. **Unverified live slot occupancy:** the source contract matches, but I could not observe the live `sidebar.footer.action` occupant list; a duplicate/leftover occupant or a crashed entry would not have been detected by me.

## 12. Checklist verdict summary

| # | checklist item | verdict |
|---|---|---|
| 1 | Skill rules | **PASS** (one note: untranslated dynamic details, D1) |
| 2 | Host service usage | **PASS** (notes: plain-string credential ref is runtime-valid; refresh has no rate limit, D4) |
| 3 | Live route | **PASS** (all 8 curl checks; contract validation 0 errors) |
| 4 | Live client registration | **UNVERIFIED-WITHOUT-BROWSER** (client Inspect channel times out); source-level registration contract PASS |
| 5 | Plugin display metadata | **PARTIAL** — files PASS (locale meta en+zh, valid original 769 B SVG); manager does not expose locale meta/icon; rendered display UNVERIFIED |
| 6 | Code-level correctness | **PASS** with low-severity D1–D10 |
| 7 | Honest visual limit | **UNVERIFIED-WITHOUT-BROWSER** (stated) |
| 8 | Regression check | **PASS** (all spot-checked existing rows active; bundle overrides `[]`) |

---

## Lead addendum — fixes after the verifier report (2026-11-03 ~17:20 +08:00)

The Lead applied the low-risk findings after the report, then proved the **live generation equals the
reviewed files** (no Host restart, Plugin Manager recomposition / HMR was used):

| finding | resolution |
|---|---|
| D1 untranslated failure details | Client maps Host/adaptor detail strings onto localized categories (`detail.http` / `detail.timeout` / `detail.cancelled` / `detail.network`); raw English is no longer rendered in the zh tooltip |
| D2 provider fallback | Already fixed before the report snapshot: `providerRoutes()` now treats the live `llm.listProviders()` array (including empty) as authoritative and falls back to known ids only when the service is absent or throws |
| D4 refresh bypassing the TTL | `POST /refresh` now forces at most one cache invalidation per 45 s TTL window; earlier calls answer from the warm cache |
| D5 rail polling | The hook moved into `QuotaWidgetBody`, which is mounted only when `wide !== false`; the 56 px rail renders nothing and performs no requests |
| D6 unbounded client read | Reads carry a 15 s deadline and an `AbortController` that is aborted on unmount |
| D7 zero-wallet copy | `status: ok` with no wallets renders `—` instead of "balance read failed" |
| D8 a11y | Balance row has `role="group"` + `aria-label` (title, amount, wallets); ring `aria-label` carries the 5h/7d summary; decorative tooltips are `aria-hidden` |
| D10 remote GUI access | The route now accepts a loopback request **or** a device paired with this Harness (`remoteWebUiPairing.isPairedDevice`, same fence as the shipped remote surfaces); unpaired non-loopback requests still get 403 |

Final live evidence after the fixes (same origin `http://127.0.0.1:55023`):

- `GET /quota-widget/snapshot` → `200`, keys exactly `generatedAt, refreshAfterMs, official, providers`
  (no debug fields); `official.display = "¥123.45"`, 1 recharge + 1 bonus wallet;
  `opencode-go 80/70`, `kimi-coding 90/42.2`, `zai-coding-cn 100/100` (5h/7d remaining).
- `POST /refresh` twice, 1 s apart → identical `generatedAt` (throttle only exists in the final code,
  so this also proves the final Host code is live).
- `sec-fetch-site: cross-site` → `403`; `Origin: http://evil.example` → `403`; unknown sub-path → `404`.
- The rewritten Client half was confirmed live in the connected page without a page reload: a temporary
  version marker in its snapshot request was observed by the Host (then the marker was removed and the
  final bundle was recomposed and re-checked).
- Client `Slots.listSubTree` root `sidebar.footer.action` → occupants `cordis-panel` and
  `sidebar-quota-widget` (order 0), both `active: true`.

Remaining unverified (browser-limited, unchanged from the section above): rendered visual acceptance
(ring color blend, tooltip placement/clipping, light/dark blending), and the Plugin Manager's rendered
title/icon. Those need the user's eyes; the files themselves are validated.

---

## Lead addendum 2 — user feedback round: real logos + stronger, non-clipping tooltip (2026-11-03 ~17:35 +08:00)

User feedback after the first delivered build: (a) letter marks in the ring centers look bad — use the
providers' real logos; (b) the hover popup's visual separation is too weak; (c) the rightmost ring's
popup is cut off.

Changes (Client half only; Host half untouched except the temporary verification marker, removed again):

- **Real provider marks**: monochrome silhouettes drawn inline in `client.js` with `currentColor`, so
  they inherit the host theme instead of introducing brand colors that clash with the sidebar:
  `opencode-go` and `kimi-coding` from Simple Icons (CC0), `zai-coding-cn` = the two arms of z.ai's own
  favicon mark (`z-cdn.chatglm.cn/z-ai/static/logo.svg`), and the official row now shows the DeepSeek
  whale mark instead of the letter "D". Unknown providers still fall back to the Host-provided letter.
  Brand marks stay the property of their owners; attribution is recorded in the file header.
- **Tooltip is now one state-driven card anchored to the whole widget** (`left:0; right:0`), not to the
  hovered ring: it can no longer overflow or be clipped horizontally at the right edge, and the same
  card serves every ring plus the balance row. Visual weight raised with a `border-l2` outline, a
  `bg-overlay` surface, a two-layer drop shadow, a 10 px radius, a head row (logo + title separated by a
  `border-l1` rule) and 10–12 px padding. Hover/focus on the balance row or any ring shows it; leaving
  clears it; hidden tooltips no longer exist in the tree (only one active card).

Verification of this round:

- `node --check` on `client.js`/`index.js`; logic smoke test expands the component tree and asserts:
  3 rings render with logo SVG paths (1 / 1 / 2 paths), no tooltip before hover, balance-row hover gives
  `Top-up ¥123.45` + `Bonus ¥0.00` rows, ring hover gives 5h/7d rows with reset countdowns, leave hides
  it, `no-credential` ring shows its state, `wide === false` renders nothing.
- The rebuilt Client half was confirmed live in the connected page **without a page reload** by a
  temporary version marker in its snapshot request (observed by the Host, then removed and recomposed).
- Final live route: keys exactly `generatedAt, refreshAfterMs, official, providers`, no debug fields,
  `official.display = "¥123.45"`, provider rings reporting real remaining percentages; cross-site
  request still `403`; client slot `sidebar-quota-widget` still registered/active.

Still browser-limited (user acceptance): logo legibility at 13 px, tooltip shadow/contrast, and
placement above the footer on light and dark themes.

---

## Lead addendum 3 — layout move + native Mac material (2026-11-03 ~17:45 +08:00)

User asked: move the official balance number onto the shipped user-settings/account row, keep only the
third-party gauges in the footer area above it, keep hover behavior, make the popup opaque (the
translucent version washed the text out) and match the shipped Mac menu in the screenshot, and remove
the white plate behind the provider logos.

Changes (Client half; Host untouched apart from temporary verification markers, removed again):

- **Layout**: the footer entry now renders only the gauges (44 px SVG, 46 px footprint, up to five per
  row, wrapping beyond five). The official balance is a `pointer-events: none` overlay positioned on
  the shipped account row directly below (`top: calc(100% + 4px)`, 44 px row — the shipped launcher
  row is 44 px tall with a 4 px top margin), right-aligned 8 px from the edge. Because it never
  captures the pointer, clicking/hovering that row still opens the shipped user menu; the number
  itself therefore has no tooltip (ring tooltips are unchanged).
- **Opaque menu surface**: the hover card now uses the shipped menu fill `var(--dsw-specific-menu)`
  with **no backdrop blur**, a `border-l1` hairline, a soft popover shadow and `--dsw-radius-lg`
  (16 px); rows use menu-like 13–14 px type and 6–10 px padding. No translucency remains.
- **Bare logos**: removed the white disc/plate behind the center mark; the provider mark now sits
  directly in the ring center. The Z.AI mark was also corrected — the missing diagonal polygon of the
  official "Z" is now included (2 → 3 paths), so it no longer reads as two dashes.
- **Native interaction**: hover uses only `var(--dsw-alias-interactive-bg-hover)` (the shipped row
  hover token) with a 120 ms background transition — no lift, no custom shadow; the popover enters
  with a 140 ms fade/4 px rise and is disabled under `prefers-reduced-motion`.

Verification for this round: `node --check` both halves; component smoke test asserts the balance
overlay text (`¥123.45`), 3 rings with 1/1/3 logo paths, no tooltip before hover, ring hover gives the
5h/7d rows, leave hides it, rail renders nothing; a temporary build marker (`?probe=8`) was observed by
the Host from the connected page (proving the new bundle reached it without a reload), then removed and
recomposed; final `GET /quota-widget/snapshot` returns the clean four-key envelope with real data and
no debug fields.

Browser-limited acceptance still needs the user: exact vertical alignment of the balance number on the
shipped account row, popup opacity/row spacing, and logo legibility at 15 px.
