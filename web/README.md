# mugsun-start-web

start.mugsun.com 项目生成器前端（Vue 3 + TypeScript + Vite + Element Plus）。设计规格见体验设计官 v1。

```bash
pnpm install
pnpm dev        # http://localhost:3093
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

## 接口
- 契约：平台后端《start.mugsun.com 切片》§4。`GET /api/v1/metadata`、`POST /api/v1/preview`（JSON）、`POST /starter.zip`（form-urlencoded，含 `baseDir`）。
- 切换真实后端只需设置 `VITE_API_BASE`（如 `https://start.mugsun.com`；前后端同源部署设 `/`）。开发时未设置则 `src/api/mock.ts` 以假 `fetch` 接入同一套 HTTP 层（`src/api/http.ts`），即「前端 mock 数据」。
- 生产构建（`pnpm build`）未设 `VITE_API_BASE` 且未显式设 `VITE_USE_MOCK=1` 会在构建期直接报错（`vite.config.ts`），运行期 `src/api/index.ts` 也会抛同样的错误，不再悄悄回落到 mock。要部署 mock 演示版请显式设 `VITE_USE_MOCK=1`。变量说明见 `.env.example`；判定规则在 `src/api/mode.ts`。
- 超时：metadata/preview 10s，generate 60s；metadata 与 preview 新请求会取消旧请求，只保留最新结果。
- 错误体 `{code,message,requestId,details}`：`INVALID_PARAMETER` 的 details 映射到表单字段；429 读取 `Retry-After`。
- 下载文件名取 `Content-Disposition`，并校验 `Content-Type: application/zip`。
- 默认值、校验规则、启动说明来自 metadata `fields` / `postGenerate`；接口失败时用 `src/lib/defaults.ts` 兜底。
- mock 场景：`?mock=meta-error|meta-timeout|meta-loading|preview-error|gen-fail|gen-slow|gen-429|gen-invalid|gen-unsupported`。
- 正式部署前后端同源（start.mugsun.com），无需 CORS；如跨域联调，后端 `Access-Control-Expose-Headers` 已包含 `Content-Disposition`、`X-Request-Id`、`Retry-After`。
- 请求只发送 type、groupId、artifactId、name、description、packageName、dependencies、baseDir；bootVersion/javaVersion/packaging/language/configurationFileFormat/database 一期只接受默认值，前端不传（version 可选，后端默认 0.0.1-SNAPSHOT，界面无该项故不传）。

## 构建
- Element Plus 经 unplugin-vue-components 按需引入（`src/components.d.ts` 自动生成）；`ElMessage` 样式在 `main.ts` 手动引入。
- 主题覆盖选择器为 `:root:root` / `html.dark:root`，保证晚加载的 Element Plus 变量不会盖掉品牌色。
- 本仓库提交 `pnpm-lock.yaml`。

## 截图
`BASE=http://localhost:3093 OUT=<目录> pnpm shots`，按规格第 9 节输出 01–16，另有 17（429）、18（字段错误），均标注「前端 mock 数据」。

## 品牌素材
- 顶栏 logo：`src/components/BrandLogo.vue`，28px 方标 `src/assets/brand/mugsun-icon-dark.svg`（与 mugsun-pc#72 同源）+ Saira 实时字标 MUGSUN（`src/assets/brand/fonts/mugsun-saira-600.woff2`，OFL 许可见同目录 `LICENSE-Saira-OFL.txt`）。
- `public/favicon.svg` 取自 mugsun-pc main（#72 压缩后的版本，约 3.5KB）；`public/favicon.ico` 取自 mugsun-docs/public/brand/web。
