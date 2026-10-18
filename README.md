# mugsun-start

**中文** | [English](README_EN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

start.mugsun.com 项目生成器：基于 [Spring Initializr](https://github.com/spring-io/initializr) 0.23.0，按所选类型与可选模块（GIS、埋点、AI 等）生成基于 mugsun 的管理系统工程，下载后即可在本地运行。

> **状态：一期开发中（S1 骨架）。** 在 S4 之前，`/starter.zip` 输出的仍是通用 Spring Boot 骨架，尚未接入 mugsun 模板。
> 本仓库**不发布任何制品**（Maven / npm / Docker 镜像发布方案待定）。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `server/` | 后端生成服务（Spring Boot 3.5 + JDK 21 + initializr-web / generator） |
| `web/` | 前端向导页面（Vue 3 + TypeScript + Vite + Element Plus），随 `feat/start-web-v1` 合入 |

## 模板来源

生成的工程只取自 **已发布版本** 的构件：后端为 Maven Central 上的 `com.mugsun` 构件与 [mugsun-boot](https://github.com/mugsun/mugsun-boot) 的发布版本，前端为 [mugsun-pc](https://github.com/mugsun/mugsun-pc) 的 Git tag。本仓库**不复制** boot / pc 的源码，也不提交模板副本。

## 本地运行

### 后端（`server/`）

需要 JDK 21。

```bash
cd server
./mvnw spring-boot:run          # 默认端口 8080，可用 MUGSUN_START_PORT 覆盖
curl -s localhost:8080/metadata/client -H 'Accept: application/vnd.initializr.v2.2+json'
curl -o demo.zip 'localhost:8080/starter.zip?type=mugsun-backend'
```

### 前端（`web/`）

需要 Node.js 22 与 pnpm 11。未设置 `VITE_API_BASE` 时使用内置 mock 数据；设置后连接真实后端。

```bash
cd web
pnpm install
pnpm dev          # http://localhost:3093
pnpm typecheck    # vue-tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run
pnpm build        # vue-tsc --noEmit && vite build
```

## 测试与 CI

| 工作流 | 触发路径 | 内容 |
| --- | --- | --- |
| `.github/workflows/server-ci.yml` | `server/**` | `./mvnw verify` |
| `.github/workflows/web-ci.yml` | `web/**` | `pnpm install --frozen-lockfile`、`typecheck`、`lint`、`test`、`build` |

## 端点（一期规划）

- `GET /metadata/client`：标准 Initializr 元数据（IDE / curl 兼容）
- `GET /api/v1/metadata`：前端向导使用的元数据（S2）
- `GET|POST /starter.zip`：生成工程压缩包
- 错误统一返回 `{code, message, requestId, timestamp, details[]}`，并回显 `X-Request-Id`（S3）

## 许可证

[MIT](./LICENSE) · © 2026 北京定旭晨 / mugsun。包含 Spring Initializr（Apache-2.0）的使用声明见 [NOTICE](./NOTICE)。
