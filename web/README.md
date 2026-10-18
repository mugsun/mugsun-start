# mugsun-start-web

start.mugsun.com 项目生成器前端（Vue 3 + TypeScript + Vite + Element Plus）。设计规格见体验设计官 v1。

```bash
pnpm install
pnpm dev        # http://localhost:3093
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

## 接口
- 唯一入口：`src/api/index.ts`。未设置 `VITE_API_BASE` 时使用 `src/api/mock.ts`（前端 mock 数据）。
- metadata 结构贴近 Spring Initializr v2.2（`Accept: application/vnd.initializr.v2.2+json`），类型见 `src/api/types.ts`，mugsun 扩展字段已标注。
- mock 场景：`?mock=meta-error|meta-timeout|meta-loading|gen-fail|gen-slow`。

## 截图
`BASE=http://localhost:3093 OUT=<目录> pnpm shots`，按规格第 9 节输出 16 张，均标注「前端 mock 数据」。

## 品牌素材
`public/logo.svg`、`logo-dark.svg`、`favicon.*` 取自 mugsun-docs/public。
