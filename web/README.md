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
- 切换真实后端只需设置 `VITE_API_BASE`（如 `https://start.mugsun.com`）。未设置时 `src/api/mock.ts` 以假 `fetch` 接入同一套 HTTP 层（`src/api/http.ts`），即「前端 mock 数据」。
- 超时：metadata/preview 10s，generate 60s；metadata 与 preview 新请求会取消旧请求，只保留最新结果。
- 错误体 `{code,message,requestId,details}`：`INVALID_PARAMETER` 的 details 映射到表单字段；429 读取 `Retry-After`。
- 下载文件名取 `Content-Disposition`，并校验 `Content-Type: application/zip`。
- 默认值、校验规则、启动说明来自 metadata `fields` / `postGenerate`；接口失败时用 `src/lib/defaults.ts` 兜底。
- mock 场景：`?mock=meta-error|meta-timeout|meta-loading|preview-error|gen-fail|gen-slow|gen-429|gen-invalid`。

## 构建
- Element Plus 经 unplugin-vue-components 按需引入（`src/components.d.ts` 自动生成）；`ElMessage` 样式在 `main.ts` 手动引入。
- 主题覆盖选择器为 `:root:root` / `html.dark:root`，保证晚加载的 Element Plus 变量不会盖掉品牌色。
- 本仓库提交 `pnpm-lock.yaml`。

## 截图
`BASE=http://localhost:3093 OUT=<目录> pnpm shots`，按规格第 9 节输出 16 张，均标注「前端 mock 数据」。

## 品牌素材
- 顶栏 logo：`src/components/BrandLogo.vue`，28px 方标 `src/assets/brand/mugsun-icon-dark.svg`（与 mugsun-pc#72 同源）+ Saira 实时字标 MUGSUN（`src/assets/brand/fonts/mugsun-saira-600.woff2`，OFL 许可见同目录 `LICENSE-Saira-OFL.txt`）。
- `public/favicon.*` 取自 mugsun-docs/public/brand/web。
