# mugsun-start 的向导页面

mugsun-start 的前端，用 Vue 3、TypeScript 和 Element Plus 编写，用 Vite 构建。

整个仓库的介绍见[上一级的 README](../README.md)。

## 启动

需要 Node.js 22 和 pnpm 11。

```bash
pnpm install
pnpm dev
```

浏览器打开 <http://localhost:3093>。没有设置 `VITE_API_BASE` 时，页面使用内置的模拟数据。

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发服务器，端口固定为 3093 |
| `pnpm typecheck` | 用 vue-tsc 做类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 单元测试，使用 Vitest |
| `pnpm build` | 类型检查并打包 |
| `pnpm e2e:ci` | 用 Playwright 检查页面布局，要先用 `VITE_USE_MOCK=1 pnpm build` 构建 |
| `pnpm shots` | 拍验收截图 |

## 连接后端还是用模拟数据

| 场景 | `VITE_API_BASE` | `VITE_USE_MOCK` | 结果 |
| --- | --- | --- | --- |
| 开发 | 不设 | 不设 | 模拟数据 |
| 开发 | `http://localhost:8090` | 不设 | 连接本机的后端 |
| 构建 | `/` 或完整地址 | 不设 | 连接后端 |
| 构建 | 任意 | `1` | 使用模拟数据的演示版 |
| 构建 | 不设 | 不设 | 构建失败 |

前后端同源部署时，`VITE_API_BASE` 设为 `/`。`VITE_USE_MOCK=1` 优先于 `VITE_API_BASE`。

两个变量在构建时写进产物，构建之后再修改不会生效。

它们可以写在 `.env.local` 或 `.env.production.local` 里，格式见 [.env.example](./.env.example)。

构建时两个变量都没有设置，`vite.config.ts` 会直接报错。

运行时 `src/api/index.ts` 也会抛出同样的错误，页面不会自动退回模拟数据。判断规则只写在 `src/api/mode.ts` 一处。

模拟数据由 `src/api/mock.ts` 提供，它替换的是 `fetch`。

所以请求仍然经过 `src/api/http.ts` 这一层，和连接后端时一样。

在地址后面加上 `?mock=<场景>`，可以模拟接口出错的情况：

| 场景 | 模拟的情况 |
| --- | --- |
| `meta-error` | 元数据返回 503 |
| `meta-timeout`、`meta-loading` | 元数据一直不返回，前者用来看超时，后者用来看骨架屏 |
| `preview-error` | 目录预览返回 500 |
| `gen-fail` | 生成返回 500 |
| `gen-slow` | 生成一直不返回 |
| `gen-429` | 生成返回 429，`Retry-After` 为 30 秒 |
| `gen-invalid` | 生成返回 400，`groupId` 和 `packageName` 不合法 |
| `gen-unsupported` | 生成返回 400，选项不支持 |

完整的场景列表在 `src/api/mock.ts` 开头的注释里。

## 和后端的约定

页面调用三个接口。

| 接口 | 请求格式 | 超时 |
| --- | --- | --- |
| `GET /api/v1/metadata` | 无请求体 | 10 秒 |
| `POST /api/v1/preview` | JSON | 10 秒 |
| `POST /starter.zip` | 表单编码，带 `baseDir` | 60 秒 |

- 元数据和预览发出新请求时会取消旧请求，只保留最新的结果。
- 错误体是 `{code, message, requestId, details}`。
- `INVALID_PARAMETER` 的 `details` 会显示到对应的表单字段上。
- 收到 429 时读取 `Retry-After`，倒计时结束前不能再次下载。
- 下载的文件名取自 `Content-Disposition`，并检查 `Content-Type` 是不是 `application/zip`。
- 默认值、校验规则和启动说明来自元数据的 `fields` 和 `postGenerate`。
- 元数据接口失败时，改用 `src/lib/defaults.ts` 里的值。

请求只发送下面这些字段：

```text
type  groupId  artifactId  name  description  packageName  dependencies  baseDir
```

下面六个参数目前只接受默认值，页面不发送：

```text
bootVersion   javaVersion               packaging
language      configurationFileFormat   database
```

`version` 在页面上没有对应的输入项，也不发送，后端默认用 `0.0.1-SNAPSHOT`。

正式部署时前后端最好同源，这样不需要 CORS。

本机跨域联调时，后端默认允许 `http://localhost:3093`，并暴露 `Content-Disposition`、`X-Request-Id` 和 `Retry-After` 三个响应头。

## 构建细节

- Element Plus 通过 unplugin-vue-components 按需引入，`src/components.d.ts` 是自动生成的。
- `ElMessage` 的样式在 `src/main.ts` 里手动引入。
- 主题覆盖用 `:root:root` 和 `html.dark:root` 两个选择器。
- Element Plus 的变量加载得晚，提高选择器的优先级后，品牌色才不会被盖掉。
- `pnpm-lock.yaml` 要提交。

## 验收截图

先启动开发服务器，再运行：

```bash
BASE=http://localhost:3093 OUT=<目录> pnpm shots
```

脚本用 Playwright 拍一组截图，包括中英文、亮色和暗色、两种宽度，以及几种出错的状态。每张图上都有「前端 mock 数据」的标记。

## 品牌素材

| 文件 | 说明 |
| --- | --- |
| `src/components/BrandLogo.vue` | 顶栏的标志，由方形图标和 MUGSUN 字标组成 |
| `src/assets/brand/mugsun-icon-dark.svg` | 28 像素的方形图标，和 mugsun-pc 用的是同一份 |
| `src/assets/brand/fonts/mugsun-saira-600.woff2` | 字标用的 Saira 字体，OFL 许可见同目录的 `LICENSE-Saira-OFL.txt` |
| `public/favicon.svg` | 取自 mugsun-pc 的 `main` 分支 |
| `public/favicon.ico` | 取自 mugsun-docs 的 `public/brand/web` 目录 |
