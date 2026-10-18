# mugsun-start

start.mugsun.com 项目生成器：基于 [Spring Initializr](https://github.com/spring-io/initializr) 0.23.0，按所选类型与可选模块生成基于 mugsun 的管理系统工程。

> 状态：一期开发中（S1 骨架）。在 S4 之前，`/starter.zip` 输出的仍是通用 Spring Boot 骨架，尚未接入 mugsun 模板。
> 本仓库**不发布任何制品**（Maven / npm / Docker 镜像发布方案待定）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `server/` | 后端生成服务（Spring Boot 3.5 + JDK 21 + initializr-web/generator） |
| `web/` | 前端向导页面（后续合入） |

## 本地运行

需要 JDK 21。

```bash
cd server
./mvnw spring-boot:run          # 默认端口 8080，可用 MUGSUN_START_PORT 覆盖
curl -s localhost:8080/metadata/client -H 'Accept: application/vnd.initializr.v2.2+json'
curl -o demo.zip 'localhost:8080/starter.zip?type=mugsun-backend'
```

## 测试

```bash
cd server
./mvnw verify
```

CI（`.github/workflows/server-ci.yml`）在 `server/**` 变更时执行同样的 `verify`。

## 端点（一期规划）

- `GET /metadata/client`：标准 Initializr 元数据（IDE / curl 兼容）
- `GET /api/v1/metadata`：前端向导使用的元数据（S2）
- `GET|POST /starter.zip`：生成工程压缩包
- 错误统一返回 `{code, message, requestId, timestamp, details[]}`，并回显 `X-Request-Id`（S3）

## 许可证

MIT，见 [LICENSE](LICENSE)。包含 Spring Initializr（Apache-2.0）的使用声明见 [NOTICE](NOTICE)。
