# AGENTS.md — mugsun-start

本文件写给在本仓工作的开发者和 AI 助手。内容以本仓代码为准；与代码不一致时以代码为准，并请顺手修正本文件。

## 仓库是什么

start.mugsun.com 项目生成器：基于 Spring Initializr，按所选类型与可选模块生成基于 mugsun 的工程。一个仓两部分：

| 路径 | 作用 |
| --- | --- |
| `server/` | 后端生成服务（Spring Boot 3.5 + JDK 21 + initializr），Maven wrapper `./mvnw` |
| `web/` | 前端向导（Vue 3 + TypeScript + Vite + Element Plus），pnpm |

- 本仓**不发布任何制品**，也**不复制** mugsun-boot / mugsun-pc 的源码或模板副本；模板只取已发布版本。
- 生成服务不连数据库、缓存，也没有会话。

## 目录分层

| 路径 | 作用 |
| --- | --- |
| `server/src/main/java/com/mugsun/start/metadata/` | 元数据组装与一致性校验（`UiMetadataController`、`MetadataConsistency` 等） |
| `server/src/main/java/com/mugsun/start/web/` | 生成、预览接口，请求校验，统一错误体与 `X-Request-Id` |
| `server/src/main/resources/` | `application.yml`；错误文案 `messages.properties`（中文，缺省）与 `messages_en.properties` |
| `server/src/test/` | JUnit 测试（`*Tests.java`） |
| `web/src/api/` | 接口封装（`http.ts`）、mock（`mock.ts`）与模式切换（`mode.ts`） |
| `web/src/components/` | 页面组件 |
| `web/src/lib/` | 纯逻辑（校验、分享、存储、错误处理等），各自带 `*.test.ts` |
| `web/src/i18n/` | `zh.ts` / `en.ts` |
| `web/src/styles/` | 主题（`theme.css`，含暗色） |
| `web/scripts/` | `e2e.mjs`（布局 e2e）、`shots.mjs`（截图） |

## 命名与写法

- 错误统一返回 `{code, message, requestId, timestamp, details[]}`，错误码在 `ErrorCode`；新文案 zh / en 两个 `messages*.properties` **一起改**。
- 前端文案走 `web/src/i18n/`，zh / en 一起改；改样式要覆盖暗色。
- 前端接口基址 `VITE_API_BASE`：开发时留空走内置 mock；任何构建（含 `--mode staging`）必须设 `VITE_API_BASE` 或显式 `VITE_USE_MOCK=1`，否则构建失败（见 `web/.env.example`）。不要放宽这条守卫。

## 测试与构建

后端（需要 JDK 21）：

```bash
cd server
./mvnw -B -ntp verify           # CI 同款
./mvnw spring-boot:run          # 默认 8080，可用 MUGSUN_START_PORT 覆盖
```

前端（需要 Node.js 22、pnpm 11）：

```bash
cd web
pnpm install
pnpm typecheck    # vue-tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run
pnpm build        # 需 VITE_API_BASE 或 VITE_USE_MOCK=1
pnpm dev          # http://localhost:3093
pnpm e2e:ci       # vite preview + 布局 e2e（需先 VITE_USE_MOCK=1 pnpm build）
pnpm shots        # 截图
```

CI（`.github/workflows/`）：`server-ci.yml` 只在 `server/**` 有改动时跑 `./mvnw verify`；`web-ci.yml` 只在 `web/**` 有改动时跑类型检查、lint、单测、构建、构建守卫与布局 e2e。依赖更新由 `.github/dependabot.yml` 管理。

`repo-checks.yml` 不带 paths 过滤，任何分支推送都跑（CHANGELOG 行宽、gitleaks、AGENTS.md / CLAUDE.md 软链）。本仓 main 没有分支保护，按 3.16 快进前必须先在分支上跑绿的就是它；只改根目录文件的提交不会触发 server-ci / web-ci，以 repo-checks 的结果为准。合入 main 后马上用 `gh run list --commit <sha>` 看 main 的 CI；推送事件偶尔延迟不触发时，用 `gh workflow run <workflow> --ref <分支>` 手动跑。手动跑完仍要用 `gh run list --commit <sha>` 确认那次运行的 SHA 就是要快进的那个；之后迟到的 push 运行如果是红的，同样要处理。

新增或修改 workflow 时（3.17）：
- 触发用 `push: branches: ['**']` 加 `workflow_dispatch`；
- concurrency 统一写成：
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}${{ github.ref == 'refs/heads/main' && format('-{0}', github.sha) || '' }}
    cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
  ```
  main 每次推送单独成组、从不取消，其他分支新推送取消旧运行；
- `permissions` 只给 `contents: read`，checkout 加 `persist-credentials: false`，action 钉 SHA。
- 需要基线比较的检查，拿不到基线时用 `::error` 让 job 失败，不许静默通过。

本仓根目录没有 husky / pre-commit 钩子，提交前自己跑一遍对应的检查。

## 本地构建

- 重型任务（`mvnw verify`、全量测试、构建、类型检查、e2e、dev server 等）一律经仓库父目录 `mugsun/` 下的 `_locks/heavy.sh` 排队，同一时间只跑一个：
  ```bash
  ../_locks/heavy.sh <名字> <做什么> -- <命令...>
  # 例：../_locks/heavy.sh 前端工程师 "start web 构建" -- pnpm --dir web build
  ```
- 空闲内存低于 30% 时脚本不开跑（退出码 75），先停掉闲置的 dev server 再试。
- 脚本会在未设置时自动设 `NODE_OPTIONS=--max-old-space-size=3072`，不要在命令里再调大。
- dev server 用完即停，不要挂着。

## 提交与推送

- Conventional Commits，主题中文，不超过 50 字，不用 emoji。
- 不用 `git stash`；切换工作用 `git worktree`。
- 不用 `--no-verify`；已推送的分支不 rebase。
- 把 main 合进分支产生的 merge commit 是新 SHA，同样要先在分支上跑绿再快进。
- **只有分支最新的 commit 已经在分支上跑过同名检查、并且全绿，才可以快进推入 main。推送前用 `gh run list --commit <sha>` 自己确认。不要 force push。**
- 合入后作者自行删除远端分支。
- 提交的作者和提交者一律是 `mugsun <bydongxin@gmail.com>`：用 `git -c user.name=mugsun -c user.email=bydongxin@gmail.com commit` 或仓库级 config，不改全局配置。已推送的历史（含 main 上以其他身份提交的）一律不改写、不 force push。
- 生成逻辑 / 依赖升级 / CI workflow 属于敏感改动，需安全审查。
