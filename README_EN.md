# mugsun-start

[中文](README.md) | **English**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

The project generator behind start.mugsun.com. Built on [Spring Initializr](https://github.com/spring-io/initializr) 0.23.0, it generates a mugsun-based admin application from the selected project type and optional modules (GIS, analytics, AI and others). The downloaded project runs locally.

> **Status: phase 1 in progress (S1 skeleton).** Until S4, `/starter.zip` still returns a generic Spring Boot skeleton; mugsun templates are not wired in yet.
> This repository **publishes no artifacts** (the Maven / npm / Docker image release plan is not decided yet).

## Layout

| Path | Description |
| --- | --- |
| `server/` | Generation service (Spring Boot 3.5, JDK 21, initializr-web / generator) |
| `web/` | Front-end wizard (Vue 3, TypeScript, Vite, Element Plus), arriving with `feat/start-web-v1` |

## Where templates come from

Generated projects are built only from **released** artifacts: the `com.mugsun` artifacts on Maven Central and released versions of [mugsun-boot](https://github.com/mugsun/mugsun-boot) for the backend, and Git tags of [mugsun-pc](https://github.com/mugsun/mugsun-pc) for the front end. This repository does **not** copy boot or pc source code and commits no template copies.

## Local development

### Backend (`server/`)

Requires JDK 21.

```bash
cd server
./mvnw spring-boot:run          # port 8080 by default; override with MUGSUN_START_PORT
curl -s localhost:8080/metadata/client -H 'Accept: application/vnd.initializr.v2.2+json'
curl -o demo.zip 'localhost:8080/starter.zip?type=maven-project'
```

### Front end (`web/`)

Requires Node.js 22 and pnpm 11. Without `VITE_API_BASE` the app uses built-in mock data; set it to connect to a real backend.

```bash
cd web
pnpm install
pnpm dev          # http://localhost:3093
pnpm typecheck    # vue-tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run
pnpm build        # vue-tsc --noEmit && vite build
```

## Tests and CI

| Workflow | Paths | Steps |
| --- | --- | --- |
| `.github/workflows/server-ci.yml` | `server/**` | `./mvnw verify` |
| `.github/workflows/web-ci.yml` | `web/**` | `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test`, `build` |

## Endpoints (phase 1 plan)

- `GET /metadata/client`: standard Initializr metadata (IDE / curl compatible)
- `GET /api/v1/metadata`: metadata for the front-end wizard (S2)
- `GET|POST /starter.zip`: download the generated project as a zip
- Errors use `{code, message, requestId, timestamp, details[]}` and echo `X-Request-Id` (S3)

## License

[MIT](./LICENSE) · © 2026 北京定旭晨 / mugsun. Attribution for Spring Initializr (Apache-2.0) is in [NOTICE](./NOTICE).
