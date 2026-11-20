# mugsun-start

[English](./README_EN.md) | [文档](https://docs.mugsun.com/start/)

[![server-ci](https://github.com/mugsun/mugsun-start/actions/workflows/server-ci.yml/badge.svg?branch=main)](https://github.com/mugsun/mugsun-start/actions/workflows/server-ci.yml)
[![web-ci](https://github.com/mugsun/mugsun-start/actions/workflows/web-ci.yml/badge.svg?branch=main)](https://github.com/mugsun/mugsun-start/actions/workflows/web-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

mugsun 的项目生成器，基于 [Spring Initializr](https://github.com/spring-io/initializr)。选好工程类型和可选模块后，它生成一个工程压缩包供下载。

> [!WARNING]
> 生成器还在开发中。`/starter.zip` 现在输出的是通用的 Spring Boot 骨架，还没有接入 mugsun 的模板。
>
> `start.mugsun.com` 也还没有部署，只能按下面的步骤在本机运行。

现在要用 mugsun，请按 [mugsun-boot 的说明](https://github.com/mugsun/mugsun-boot#用-docker-试用)启动。

![向导页面](https://docs.mugsun.com/readme/start-wizard.png)

上图是向导页面在本机运行的样子，页面里的内容来自前端内置的模拟数据。

## 本地运行

后端在 `server/` 目录，需要 JDK 21。

```bash
git clone https://github.com/mugsun/mugsun-start.git && cd mugsun-start/server
./mvnw spring-boot:run
```

服务监听 8090 端口，可以用环境变量 `MUGSUN_START_PORT` 修改。启动后用 curl 下载一个工程：

```bash
curl -o demo.zip 'localhost:8090/starter.zip?type=mugsun-backend'
```

向导页面在 `web/` 目录，需要 Node.js 22 和 pnpm 11。

```bash
cd mugsun-start/web
pnpm install
pnpm dev
```

浏览器打开 <http://localhost:3093>。这时页面用的是内置的模拟数据，不需要启动后端。

要连接本机的后端，在 `web/.env.local` 里写上 `VITE_API_BASE=http://localhost:8090`，再重新运行 `pnpm dev`。

## 可以选什么

| 选项 | 取值 |
| --- | --- |
| 工程类型 | 仅后端 `mugsun-backend`，前后端 `mugsun-fullstack` |
| 可选模块 | GIS `gis`，埋点 `track`，AI `ai` |
| 数据库 | 目前只有 PostgreSQL |

系统管理、认证与安全这些常驻模块不能去掉，请求里传了也会被忽略。

## 接口

| 接口 | 说明 |
| --- | --- |
| `GET /metadata/client` | 标准的 Initializr 元数据，IDE 和 curl 可以直接使用 |
| `GET /api/v1/metadata` | 向导页面用的元数据 |
| `POST /api/v1/preview` | 按所选内容返回工程的目录树 |
| `GET /starter.zip`、`POST /starter.zip` | 生成并下载工程压缩包 |

读取标准元数据时要带上 `Accept` 请求头：

```bash
curl -s localhost:8090/metadata/client -H 'Accept: application/vnd.initializr.v2.2+json'
```

出错时统一返回 `{code, message, requestId, timestamp, details[]}`，响应头里带 `X-Request-Id`。

同时进行的生成任务有数量上限，超出时返回 429 和 `Retry-After`。

## 代码结构

| 路径 | 内容 |
| --- | --- |
| `server/` | 生成服务，用 Spring Boot 3 和 Spring Initializr 编写，用 Maven Wrapper 构建 |
| `web/` | 向导页面，用 Vue 3 和 Element Plus 编写，说明见 [web/README.md](./web/README.md) |

生成服务不连数据库和缓存，也没有会话。

## 模板从哪里来

接入模板后，生成的工程只取已经发布的版本。

后端取 Maven Central 上的 `com.mugsun` 构件和 mugsun-boot 的发布版本，前端取 mugsun-pc 的 Git 标签。

这个仓库不复制 mugsun-boot 和 mugsun-pc 的源码，也不保存模板的副本。

## 测试

| 目录 | 命令 | 工作流 |
| --- | --- | --- |
| `server/` | `./mvnw -B -ntp verify` | `server-ci.yml` |
| `web/` | `pnpm typecheck && pnpm lint && pnpm test` | `web-ci.yml` |

两个工作流只在各自的目录有改动时运行。`web-ci.yml` 还会构建一次，并用 Playwright 检查页面布局。

`web/` 的构建必须设置 `VITE_API_BASE` 或 `VITE_USE_MOCK=1`，否则直接失败，原因见 [web/README.md](./web/README.md)。

## 目前的限制

- 生成的压缩包还是通用的 Spring Boot 骨架，里面没有 mugsun 的代码。
- 没有线上站点，`start.mugsun.com` 还没有部署。
- 数据库只能选 PostgreSQL。
- 不发布 Maven 构件、npm 包和 Docker 镜像。

## 相关仓库

| 仓库 | 说明 |
| --- | --- |
| [mugsun-boot](https://github.com/mugsun/mugsun-boot) | 后端。生成的工程将以它的发布版本为模板 |
| [mugsun-pc](https://github.com/mugsun/mugsun-pc) | 管理后台。前后端工程里的前端将取自它 |
| [mugsun-docs](https://github.com/mugsun/mugsun-docs) | 文档站 [docs.mugsun.com](https://docs.mugsun.com/) 的源码 |

## 参与贡献

提交前请读[贡献指南](https://github.com/mugsun/.github/blob/main/CONTRIBUTING.md)。安全问题请按 [SECURITY.md](https://github.com/mugsun/.github/blob/main/SECURITY.md) 私下报告，不要开公开 Issue。

## 许可

MIT，见 [LICENSE](./LICENSE)。生成服务使用了 Spring Initializr（Apache-2.0），声明见 [NOTICE](./NOTICE)。
