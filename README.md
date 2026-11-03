# dsh-sidebar-quota-widget

在 **DSH（DeepSeek Harness）** Web GUI 的侧边栏账号行上显示 DeepSeek 官方余额，并在其上方用圆环展示本机已接入的**其他模型提供方**的 **5 小时 / 7 天剩余额度**。

<p align="center"><img src="icon.svg" width="96" alt="plugin icon"></p>

> 一个 CSS-only 的轻量 UI 插件：Host 半负责读余额与各提供方 usage 接口，Client 半负责渲染，不引入额外依赖。

## 特性

- **官方余额**：`¥12.34` 这样的数字直接显示在“用户菜单那一行”的右端（悬浮层 `pointer-events: none`，不挡住点击，点该行仍是原生用户菜单）。
- **额度圆环**：每个第三方提供方一个圆环，圆心是该提供方的真实 LOGO，**内圈 = 7 天剩余**、**外圈 = 5 小时剩余**，弧长即剩余比例。
- **颜色语义**：剩余 ≥70% 绿色、40–70% 绿→琥珀渐变、15–40% 琥珀→红、<15% 红色。
- **原生质感**：悬停/键盘聚焦弹出 DSH 原生菜单质感的卡片（`--dsw-specific-menu` 不透明底色、原生圆角/投影/字号），显示 5 小时与 7 天剩余、重置倒计时与失败原因。
- **自适应布局**：一行最多放 5 个圆环，超过自动换行；亮/暗主题、侧边栏折叠、多语言（中/英）都跟随 DSH。
- **低打扰**：Host 端 45 秒缓存 + 前端 60 秒轮询；折叠成 56px 窄栏时隐藏且不轮询。

## 数据来源

所有数字都是**真实接口**读取（Host 进程内完成，前端只拿余额与百分比）：

| provider id | 额度接口 | 认证 |
|---|---|---|
| `opencode-go` | `GET https://opencode.ai/zen/go/v1/usage` | `Authorization: Bearer <key>` |
| `kimi-coding` | `GET https://api.kimi.com/coding/v1/usages` | `Authorization: Bearer <key>` |
| `zai-coding-cn` | `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit` | `Authorization: Bearer <key>` |

提供方列表自动取自 DSH 的 LLM 注册表（排除 DeepSeek 官方账号路由）；没有额度适配器的 provider 会显示灰色空环并提示“暂无额度接口”。字段映射、真实响应样例（已脱敏）与失败场景见 [RESEARCH-providers.md](RESEARCH-providers.md)。

## 安装

前提：DSH Desktop / Web（含 Web GUI 与 Plugin Manager），并且至少接入了一个第三方模型提供方、在 DSH 凭据里配置了对应 API Key。

1. 克隆本仓库到本机任意目录：
   ```bash
   git clone https://github.com/lakii2982/dsh-sidebar-quota-widget.git
   ```
2. 以本地 bundle 安装（二选一）：
   - 在 DSH 的 Plugin Manager / 设置里选择“安装本地 bundle”，指向克隆下来的目录；
   - 或让 DSH 里的 Agent 调用 `plugin_manager` 的 `install_bundle`，`target` 传该目录的**绝对路径**。
3. 安装成功后插件会热更新进当前页面；若没出现，刷新一次页面。

### 凭据

Host 端通过 DSH 凭据服务按需解析以下引用（顺序即回退顺序），不需要把 Key 写进插件配置：

```
opencode-go   → OPENCODE_GO_API_KEY → OPENCODE_API_KEY
kimi-coding   → KIMI_CODING_API_KEY → KIMI_API_KEY
zai-coding-cn → ZAI_CODING_CN_API_KEY → ZAI_API_KEY
```

在**设置 → 模型**里接入对应 provider 并填好 Key 即可；插件不保存任何密钥。

## 增加一个提供方

1. 在 [`providers.mjs`](providers.mjs) 里实现一个 adapter（拿 `credential` 请求该提供方的 usage 接口，把结果归一成 `remainingPct` / `resetsAt`）。
2. 在 `PROVIDER_CREDENTIAL_CANDIDATES`、`PROVIDER_PRESENTATION`、`ADAPTERS` 中登记。
3. 如是新品牌，可在 [`client.js`](client.js) 的 `PROVIDER_LOGOS` 里加一个单色 SVG 轮廓（`currentColor`，自动跟随主题）。

注意：`remainingPct` 必须是**剩余**百分比（0–100）；接口只给“已用”时要换算。

## 安全与隐私

- Key 只在 Host 进程内、每次请求时经 `ctx.credentials` 解析，**不进入前端、不进日志、不出现在响应里**。
- 插件注册的 HTTP 路由只接受**本机回环**或**已与 DSH 配对的设备**请求；跨站/跨源请求返回 403。响应里只有余额与百分比。
- 缓存与轮询间隔按“官方控制台接口”的礼貌频率设置，避免频繁请求。

## 目录结构

```
index.js            Host 半：读取官方余额 + 各提供方额度，45s 缓存，注册 /quota-widget 路由
providers.mjs       各提供方 usage 适配器（真实接口、归一化、超时与失败状态）
client.js           Client 半：账号行余额数字 + 圆环渲染 + 原生菜单质感的悬停卡片
cordis.patch.yml    Bundle patch：插入一条 Host row
locale/{en,zh}.json 插件管理器里显示的标题与描述
icon.svg            插件图标
CONTRACT.md         前后端（Host/Client）之间的 JSON 契约与交互约定
RESEARCH-providers.md 各提供方接口的调研证据（真实响应、字段映射、失败样例）
VERIFICATION.md     独立验证报告与每轮改动的验收记录
```

## 开发与验证

```bash
npm run check   # node --check 三个运行文件
```

更高层的要求（主题 token、slot 注册、卸载清理等）见 [CONTRACT.md](CONTRACT.md) 与 [VERIFICATION.md](VERIFICATION.md)。

## 已知限制

- 三个 usage 接口属于各家控制台用途、**未公开文档化**，上游改动可能导致某一路返回失败；失败只会让对应圆环变灰并给出提示，不影响 DSH 本身。
- 只覆盖 DSH 的 LLM provider；Claude Code / Codex 属于子智能体，不在此列。
- 侧边栏折叠成 56px 窄栏时插件隐藏。
- 余额数字定位基于当前 DSH 账号行 44px 行高；DSH 大版本升级后如有偏移，改 `client.js` 里 `.qw-balance-overlay` 的 `top` / `height` 即可。

## License

[MIT](LICENSE)。

Provider 的 LOGO 与商标归各自所有（OpenCode / Kimi / DeepSeek 的单色轮廓来自 [Simple Icons](https://simpleicons.org/)，Z.AI 的「Z」取自其官方 favicon 资源），这里仅用于标识所连接的提供方。本项目与 DeepSeek、OpenCode、Moonshot、Z.AI 均无隶属关系。
