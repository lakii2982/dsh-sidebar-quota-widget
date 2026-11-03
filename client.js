window.__ModuleLoader__.load({
  id: 'dsh-sidebar-quota-widget',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * Provider marks: each glyph is the provider's own logo, traced as a single
     * monochrome silhouette so it inherits the host theme color.
     * OpenCode / Kimi / DeepSeek marks come from Simple Icons (CC0); the Z.AI
     * mark is the two-arm "Z" taken from z.ai's own favicon SVG (z-cdn.chatglm.cn).
     * Brand marks remain the property of their owners; they are used here only
     * to identify the connected provider.
     */
    const PROVIDER_LOGOS = {
      'opencode-go': {
        viewBox: '0 0 24 24',
        paths: ['M22 24H2V0h20zM17 4.8H7v14.4h10z'],
      },
      'kimi-coding': {
        viewBox: '0 0 24 24',
        paths: [
          'M21.765.351C22.998.351 24 1.353 24 2.586S22.998 4.82 21.765 4.82h-1.974c-.15 0-.26-.12-.26-.26V2.586A2.237 2.237 0 0 1 21.765.35M9.41 13.388l8.447-8.377c.16-.16.07-.471-.14-.471h-4.55s-.1.02-.14.06l-9.099 9.029c-.14.14-.35.02-.35-.21V4.81c0-.15-.1-.27-.221-.27H.22c-.12 0-.22.12-.22.27v18.57c0 .15.1.27.22.27h3.137c.12 0 .22-.12.22-.27v-3.79c0-.08.03-.16.08-.21l2.826-2.796c.07-.07.16-.08.241-.03l7.546 5.551a8.9 8.9 0 0 0 4.018 1.493c.12.01.23-.11.23-.27V19.76c0-.14-.08-.25-.19-.26a5.8 5.8 0 0 1-2.355-.942l-6.533-4.73c-.14-.09-.15-.32-.03-.441',
        ],
      },
      'zai-coding-cn': {
        viewBox: '0 0 24 24',
        // z.ai favicon mark (30×30 asset): the diagonal stroke plus its two bars.
        transform: 'translate(-4.13 -4.13) scale(1.075)',
        paths: [
          'M24.3 7.1 13.14 22.91 5.7 22.91 16.86 7.1Z',
          'M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z',
          'M14.53,22.91l1.31-1.86c0.2-0.29,0.54,-0.47,0.9,-0.47h7.09v2.33H14.53z',
        ],
      },
      /** The official DeepSeek mark used by the balance row. */
      deepseek: {
        viewBox: '0 0 24 24',
        paths: [
          'M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45',
        ],
      },
    }

    /** Locale namespace owned by this plugin. */
    const NS = 'quota-widget'
    /** Snapshot route, document-relative: the GUI is served with `<base href="./">`. */
    const SNAPSHOT_PATH = 'quota-widget/snapshot'
    /** Fallback poll delay when the Host gives no hint. */
    const FALLBACK_REFRESH_MS = 60_000
    /** Retry delay after a failed read (the Host half may still be starting). */
    const RETRY_DELAY_MS = 15_000
    /** Per-request read deadline; a warm Host cache answers in milliseconds. */
    const READ_TIMEOUT_MS = 15_000
    /** Ring geometry: a 44 px gauge leaves the center mark a visible gap to the arcs. */
    const RING_SIZE = 44
    const RING_RADIUS_INNER = 12.5
    const RING_RADIUS_OUTER = 18.5
    const RING_STROKE = 3
    /** Center mark size (the inner arc's clear radius is 11 px, so this stays clear of it). */
    const MARK_SIZE = 15

    const zh = {
      'widget.label': '订阅额度',
      'provider.noCredential': '未配置凭据',
      'provider.unsupported': '暂无额度接口',
      'provider.error': '读取失败',
      'provider.noWindow': '该套餐无此额度窗口',
      'window.sevenDay': '7 天',
      'window.fiveHour': '5 小时',
      'window.remaining': '剩余',
      'window.unknown': '未知',
      'detail.http': '请求被拒绝（HTTP {status}）',
      'detail.timeout': '请求超时',
      'detail.cancelled': '请求已取消',
      'detail.network': '网络错误',
      'reset.inHours': '约 {hours} 小时后重置',
      'reset.inMinutes': '约 {minutes} 分钟后重置',
      'reset.now': '即将重置',
    }

    const en = {
      'widget.label': 'Subscription quota',
      'provider.noCredential': 'No credential configured',
      'provider.unsupported': 'No usage API yet',
      'provider.error': 'Read failed',
      'provider.noWindow': 'Not part of this plan',
      'window.sevenDay': '7-day',
      'window.fiveHour': '5-hour',
      'window.remaining': 'remaining',
      'window.unknown': 'unknown',
      'detail.http': 'Request rejected (HTTP {status})',
      'detail.timeout': 'Request timed out',
      'detail.cancelled': 'Request cancelled',
      'detail.network': 'Network error',
      'reset.inHours': 'resets in ~{hours}h',
      'reset.inMinutes': 'resets in ~{minutes}m',
      'reset.now': 'resetting now',
    }

    /** Combine the caller signal with this read's own deadline. */
    function readSignal(external) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        const deadline = AbortSignal.timeout(READ_TIMEOUT_MS)
        if (external && typeof AbortSignal.any === 'function') return AbortSignal.any([external, deadline])
        return external ?? deadline
      }
      return external
    }

    /** Read one snapshot from this bundle's Host half. */
    async function readSnapshot(signal) {
      const response = await fetch(SNAPSHOT_PATH, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
        signal: readSignal(signal),
      })
      const body = await response.json()
      if (body === null || typeof body !== 'object' || body.ok !== true || body.value === undefined) {
        throw new Error('quota snapshot unavailable')
      }
      return body.value
    }

    /** Poll the Host snapshot for as long as the component is mounted. */
    function useSnapshot() {
      const [state, setState] = React.useState({ status: 'loading', value: null, error: null })
      React.useEffect(() => {
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        let disposed = false
        let timer
        const schedule = (delay) => {
          if (disposed) return
          timer = setTimeout(load, delay)
        }
        async function load() {
          try {
            const value = await readSnapshot(controller?.signal)
            if (disposed) return
            setState({ status: 'live', value, error: null })
            schedule(Math.max(RETRY_DELAY_MS, value?.refreshAfterMs ?? FALLBACK_REFRESH_MS))
          } catch (error) {
            if (disposed) return
            setState((previous) => ({
              status: previous.value === null ? 'failed' : previous.status,
              value: previous.value,
              error: error instanceof Error ? error.message : 'snapshot failed',
            }))
            schedule(RETRY_DELAY_MS)
          }
        }
        load()
        return () => {
          disposed = true
          if (timer !== undefined) clearTimeout(timer)
          controller?.abort()
        }
      }, [])
      return state
    }

    /** Clamp a percentage into 0..100, or null. */
    function clamp(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return null
      return Math.max(0, Math.min(100, value))
    }

    /**
     * Remaining-quota color: >=70% solid green, 40-70% green -> amber,
     * 15-40% amber -> red, <15% solid red. The blend uses the theme state
     * tokens; the band token stays as the always-valid fallback stroke.
     */
    function quotaColor(remainingPct) {
      const pct = clamp(remainingPct)
      if (pct === null) return { stroke: 'var(--dsw-alias-state-idle-primary)', style: undefined }
      if (pct >= 70) return { stroke: 'var(--dsw-alias-state-success-primary)', style: undefined }
      if (pct >= 40) {
        const greenWeight = Math.round(((pct - 40) / 30) * 100)
        return {
          stroke: 'var(--dsw-alias-state-success-primary)',
          style: {
            stroke: `color-mix(in oklab, var(--dsw-alias-state-success-primary) ${greenWeight}%, var(--dsw-alias-state-warn-primary))`,
          },
        }
      }
      if (pct >= 15) {
        const amberWeight = Math.round(((pct - 15) / 25) * 100)
        return {
          stroke: 'var(--dsw-alias-state-warn-primary)',
          style: {
            stroke: `color-mix(in oklab, var(--dsw-alias-state-warn-primary) ${amberWeight}%, var(--dsw-alias-state-error-primary))`,
          },
        }
      }
      return { stroke: 'var(--dsw-alias-state-error-primary)', style: undefined }
    }

    function formatPct(remainingPct) {
      const pct = clamp(remainingPct)
      if (pct === null) return null
      return `${Math.round(pct * 10) / 10}%`
    }

    /** Localize a Host/adaptor failure detail instead of showing raw English. */
    function detailText(detail, t) {
      if (typeof detail !== 'string' || detail === '') return null
      const http = /HTTP (\d{3})/.exec(detail)
      if (http !== null) return t('detail.http', { status: http[1] })
      if (/tim(e|ed)?[ -]?out/i.test(detail)) return t('detail.timeout')
      if (/cancel/i.test(detail)) return t('detail.cancelled')
      if (/network|ECONN|ENOTFOUND|fetch|socket/i.test(detail)) return t('detail.network')
      return null
    }

    /** Localized "resets in …" text for one epoch-ms reset time. */
    function resetText(resetsAt, t) {
      if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return null
      const diffMs = resetsAt - Date.now()
      if (diffMs <= 0) return t('reset.now')
      const minutes = Math.max(1, Math.round(diffMs / 60_000))
      if (minutes >= 60) {
        const hours = Math.max(1, Math.round(minutes / 60))
        return t('reset.inHours', { hours })
      }
      return t('reset.inMinutes', { minutes })
    }

    /** Render one provider/brand mark; falls back to the letter mark. */
    function BrandMark(props) {
      const { logoId, mark, size, color } = props
      const logo = logoId === undefined ? undefined : PROVIDER_LOGOS[logoId]
      if (logo === undefined) {
        return h(
          'span',
          {
            className: 'qw-mark qw-mark-letter',
            style: { width: size, height: size, fontSize: Math.round(size * 0.76), color },
            'aria-hidden': 'true',
          },
          mark,
        )
      }
      return h(
        'span',
        { className: 'qw-mark', style: { width: size, height: size, color }, 'aria-hidden': 'true' },
        h(
          'svg',
          { width: size, height: size, viewBox: logo.viewBox, focusable: 'false', 'aria-hidden': 'true' },
          h(
            'g',
            logo.transform === undefined ? null : { transform: logo.transform },
            logo.paths.map((d, index) => h('path', { key: index, d, fill: 'currentColor' })),
          ),
        ),
      )
    }

    /** One quota row inside a tooltip. */
    function tipQuotaRow(key, label, window, t) {
      const pct = window === null ? null : clamp(window.remainingPct)
      const color = quotaColor(pct)
      const value = formatPct(pct) ?? t('window.unknown')
      const reset = window === null ? null : resetText(window.resetsAt, t)
      return h(
        'div',
        { className: 'qw-tip-block', key },
        h(
          'div',
          { className: 'qw-tip-row' },
          h('span', { className: 'qw-tip-dot', style: { background: color.style?.stroke ?? color.stroke } }),
          h('span', { className: 'qw-tip-label' }, label),
          h('span', { className: 'qw-tip-value' }, value),
        ),
        reset === null ? null : h('div', { className: 'qw-tip-note' }, reset),
      )
    }

    /** Provider tooltip content: exact windows, reset times and state. */
    function providerTipContent(provider, t) {
      const rows = []
      const failure = detailText(provider.detail, t)
      if (provider.state === 'no-credential') rows.push(h('div', { className: 'qw-tip-note', key: 'nc' }, t('provider.noCredential')))
      else if (provider.state === 'unsupported') rows.push(h('div', { className: 'qw-tip-note', key: 'un' }, t('provider.unsupported')))
      else if (provider.state === 'error') rows.push(h('div', { className: 'qw-tip-note', key: 'er' }, failure ?? t('provider.error')))
      if (provider.fiveHour !== null)
        rows.push(tipQuotaRow('5h', `${t('window.fiveHour')} ${t('window.remaining')}`, provider.fiveHour, t))
      if (provider.sevenDay !== null)
        rows.push(tipQuotaRow('7d', `${t('window.sevenDay')} ${t('window.remaining')}`, provider.sevenDay, t))
      if (provider.fiveHour === null && provider.sevenDay === null && provider.state === 'ok')
        rows.push(h('div', { className: 'qw-tip-note', key: 'none' }, t('provider.noWindow')))
      return rows
    }

    /** One arc, drawn clockwise from 12 o'clock by remaining percentage. */
    function arc(cx, cy, radius, remainingPct, key, opacity) {
      const circumference = 2 * Math.PI * radius
      const pct = clamp(remainingPct)
      const fraction = pct === null ? 0 : pct / 100
      const dash = circumference * fraction
      const color = quotaColor(pct)
      return h('circle', {
        key,
        cx,
        cy,
        r: radius,
        fill: 'none',
        stroke: color.stroke,
        style: color.style,
        strokeWidth: RING_STROKE,
        strokeLinecap: 'round',
        strokeDasharray: `${dash} ${circumference}`,
        strokeOpacity: opacity,
        transform: `rotate(-90 ${cx} ${cy})`,
      })
    }

    /** One provider gauge: center logo, inner 7-day ring, outer 5-hour ring. */
    function ProviderRing(props) {
      const { provider, t, hoverProps } = props
      const center = RING_SIZE / 2
      const sevenDay = provider.sevenDay === null ? null : provider.sevenDay.remainingPct
      const fiveHour = provider.fiveHour === null ? null : provider.fiveHour.remainingPct
      const summaryParts = []
      const fiveText = formatPct(fiveHour)
      const sevenText = formatPct(sevenDay)
      if (fiveText !== null) summaryParts.push(`${t('window.fiveHour')} ${fiveText}`)
      if (sevenText !== null) summaryParts.push(`${t('window.sevenDay')} ${sevenText}`)
      return h(
        'div',
        {
          className: 'qw-item qw-ring',
          tabIndex: 0,
          role: 'img',
          'aria-label': summaryParts.length === 0 ? provider.name : `${provider.name} — ${summaryParts.join(' · ')}`,
          ...hoverProps,
        },
        h(
          'svg',
          { width: RING_SIZE, height: RING_SIZE, viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`, 'aria-hidden': 'true', focusable: 'false' },
          h('circle', {
            cx: center,
            cy: center,
            r: RING_RADIUS_INNER,
            fill: 'none',
            stroke: 'var(--dsw-alias-border-l2)',
            strokeWidth: RING_STROKE,
          }),
          h('circle', {
            cx: center,
            cy: center,
            r: RING_RADIUS_OUTER,
            fill: 'none',
            stroke: 'var(--dsw-alias-border-l2)',
            strokeWidth: RING_STROKE,
          }),
          arc(center, center, RING_RADIUS_INNER, sevenDay, 'seven-day', 0.72),
          arc(center, center, RING_RADIUS_OUTER, fiveHour, 'five-hour', 1),
        ),
        h(
          'span',
          { className: 'qw-ring-mark', 'aria-hidden': 'true' },
          h(BrandMark, { logoId: provider.id, mark: provider.mark, size: MARK_SIZE, color: 'var(--dsw-alias-label-secondary)' }),
        ),
      )
    }

    /** The polling body; mounted only while the sidebar is expanded. */
    function QuotaWidgetBody(props) {
      const { t } = props
      const snapshot = useSnapshot()
      const [activeId, setActiveId] = React.useState(null)
      const value = snapshot.value
      const official = value?.official ?? null
      // The official balance lives on the account row (overlay below); only the
      // number is shown there, and only once the balance read has settled.
      let officialValue = ''
      if (snapshot.status !== 'loading' && official !== null) {
        if (official.status === 'ok') officialValue = official.display ?? '—'
        else if (official.status === 'error' || official.status === 'unavailable') officialValue = '—'
      }
      const providers = Array.isArray(value?.providers) ? value.providers : []
      const activeProvider = activeId === null ? undefined : providers.find((provider) => provider.id === activeId)
      const hoverPropsFor = (id) => ({
        onMouseEnter: () => setActiveId(id),
        onMouseLeave: () => setActiveId(null),
        onFocus: () => setActiveId(id),
        onBlur: () => setActiveId(null),
      })

      return h(
        'div',
        { className: providers.length === 0 ? 'qw-root qw-root-bare' : 'qw-root', role: 'group', 'aria-label': t('widget.label') },
        h('style', { key: 'style' }, STYLE),
        officialValue === ''
          ? null
          : h('span', { key: 'balance', className: 'qw-balance-overlay' }, officialValue),
        providers.length === 0
          ? null
          : h(
              'div',
              { className: 'qw-rings' },
              providers.map((provider) =>
                h(ProviderRing, { key: provider.id, provider, t, hoverProps: hoverPropsFor(provider.id) }),
              ),
            ),
        activeProvider === undefined
          ? null
          : h(
              'div',
              { className: 'qw-tip', role: 'tooltip', 'aria-hidden': 'true' },
              h(
                'div',
                { className: 'qw-tip-head' },
                h(BrandMark, {
                  logoId: activeProvider.id,
                  mark: activeProvider.mark,
                  size: 16,
                  color: 'var(--dsw-alias-label-secondary)',
                }),
                h('span', { className: 'qw-tip-title' }, activeProvider.name),
              ),
              h('div', { className: 'qw-tip-body' }, providerTipContent(activeProvider, t)),
            ),
      )
    }

    /** Footer entry: nothing in the 56 px rail, the two-layer toolbar when expanded. */
    function QuotaWidget(props) {
      if (props.widgetWide === false) return null
      return h(QuotaWidgetBody, { t: props.t })
    }

    const STYLE = [
      // Footer area: transparent so it sits on the sidebar surface; only rings live here.
      '.qw-root{position:relative;display:flex;flex-direction:column;box-sizing:border-box;width:100%;padding:6px 0 4px;color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px}',
      '.qw-root-bare{padding:0}',
      // Official balance number, overlaid on the shipped account row directly below.
      '.qw-balance-overlay{position:absolute;top:calc(100% + 4px);right:8px;display:flex;align-items:center;height:44px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;pointer-events:none}',
      // Layer 2 — up to five 46 px gauges per row, wrapping beyond five.
      '.qw-rings{display:flex;align-items:center;gap:3px;flex-wrap:wrap;row-gap:4px}',
      '.qw-item{position:relative;border-radius:9px;outline:none;transition:background .12s ease}',
      '.qw-item:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-1))}',
      '.qw-item:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.qw-ring{display:inline-flex;flex:none;align-items:center;justify-content:center;width:46px;height:46px;padding:1px;border-radius:50%;cursor:default}',
      '.qw-mark{display:inline-flex;flex:none;align-items:center;justify-content:center;line-height:1}',
      '.qw-mark svg{display:block}',
      '.qw-mark-letter{font-weight:600;letter-spacing:-0.02em}',
      '.qw-ring-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      // Tooltip — the shipped menu surface: menu fill, menu backdrop blur, prominent elevation.
      '.qw-tip{position:absolute;left:0;right:0;bottom:calc(100% + 8px);z-index:60;box-sizing:border-box;padding:6px;border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));box-shadow:0 0 0 .5px var(--dsw-alias-border-l1),0 10px 30px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.10);border:0;color:var(--dsw-alias-label-primary);text-align:left;pointer-events:none;animation:qw-tip-in .14s ease-out}',
      '.qw-tip-head{display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:32px;font-weight:600;font-size:14px;line-height:22px}',
      '.qw-tip-title{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.qw-tip-body{padding:0 2px 2px}',
      '.qw-tip-block{padding:6px 10px;border-radius:var(--dsw-radius-sm,8px)}',
      '.qw-tip-block+.qw-tip-block{margin-top:2px}',
      '.qw-tip-row{display:flex;align-items:center;gap:8px;justify-content:space-between}',
      '.qw-tip-label{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.qw-tip-value{flex:none;font-variant-numeric:tabular-nums;font-weight:600;font-size:13px}',
      '.qw-tip-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}',
      '.qw-tip-note{margin-top:1px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;line-height:15px}',
      '@keyframes qw-tip-in{from{opacity:0;transform:translateY(4px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@media (prefers-reduced-motion:reduce){.qw-item,.qw-tip{transition:none;animation:none}}',
    ].join('')

    /** Register the dictionary, then the footer slot entry. */
    function apply(ctx) {
      const locale = ctx.get('locale')
      let t = (key) => en[key] ?? key
      if (locale !== undefined && locale !== null) {
        ctx.effect(() => locale.register(NS, 'zh', zh), 'sidebar-quota-widget: zh dictionary')
        ctx.effect(() => locale.register(NS, 'en', en), 'sidebar-quota-widget: en dictionary')
        try {
          t = locale.bind(NS)
        } catch {
          t = (key) => en[key] ?? key
        }
      }

      function QuotaWidgetEntry(props) {
        return h(QuotaWidget, { widgetWide: props.wide, t })
      }

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'sidebar-quota-widget',
            order: 0,
            label: () => t('widget.label'),
          },
          QuotaWidgetEntry,
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})
