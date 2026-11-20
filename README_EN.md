# mugsun-start

[中文](./README.md) | [Docs](https://docs.mugsun.com/en/start/)

[![server-ci](https://github.com/mugsun/mugsun-start/actions/workflows/server-ci.yml/badge.svg?branch=main)](https://github.com/mugsun/mugsun-start/actions/workflows/server-ci.yml)
[![web-ci](https://github.com/mugsun/mugsun-start/actions/workflows/web-ci.yml/badge.svg?branch=main)](https://github.com/mugsun/mugsun-start/actions/workflows/web-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

The project generator for mugsun, built on [Spring Initializr](https://github.com/spring-io/initializr). Pick a project type and the optional modules, and it produces a project archive to download.

> [!WARNING]
> The generator is still under development. `/starter.zip` currently returns a plain Spring Boot skeleton. The mugsun templates are not wired in yet.
>
> `start.mugsun.com` is not deployed either, so you can only run it on your own machine as described below.

To use mugsun today, follow [the mugsun-boot README](https://github.com/mugsun/mugsun-boot/blob/main/README_EN.md#try-it-with-docker).

![The wizard page](https://docs.mugsun.com/readme/start-wizard-en.png)

The screenshot shows the wizard running locally. What you see on the page comes from the mock data built into the frontend.

## Run it locally

The backend lives in `server/` and needs JDK 21.

```bash
git clone https://github.com/mugsun/mugsun-start.git && cd mugsun-start/server
./mvnw spring-boot:run
```

It listens on port 8090. Set the environment variable `MUGSUN_START_PORT` to change that. Once it is up, download a project with curl:

```bash
curl -o demo.zip 'localhost:8090/starter.zip?type=mugsun-backend'
```

The wizard lives in `web/` and needs Node.js 22 and pnpm 11.

```bash
cd mugsun-start/web
pnpm install
pnpm dev
```

Open <http://localhost:3093>. The page now runs on the built-in mock data, so the backend does not have to be running.

To talk to the local backend, put `VITE_API_BASE=http://localhost:8090` in `web/.env.local` and run `pnpm dev` again.

## What you can choose

| Option | Values |
| --- | --- |
| Project type | Backend only `mugsun-backend`, full stack `mugsun-fullstack` |
| Optional modules | GIS `gis`, analytics `track`, AI `ai` |
| Database | PostgreSQL only, for now |

The modules that are always included, such as system administration and authentication, cannot be removed. They are ignored if a request names them.

## API

| Endpoint | What it does |
| --- | --- |
| `GET /metadata/client` | Standard Initializr metadata, usable from IDEs and curl |
| `GET /api/v1/metadata` | Metadata for the wizard page |
| `POST /api/v1/preview` | Returns the directory tree of the project for the current selection |
| `GET /starter.zip`, `POST /starter.zip` | Generates the project archive and returns it |

The standard metadata needs an `Accept` header:

```bash
curl -s localhost:8090/metadata/client -H 'Accept: application/vnd.initializr.v2.2+json'
```

Errors always come back as `{code, message, requestId, timestamp, details[]}` with an `X-Request-Id` response header.

The number of generations running at the same time is capped. Beyond the cap the service answers 429 with `Retry-After`.

## Layout

| Path | Contents |
| --- | --- |
| `server/` | The generation service, written with Spring Boot 3 and Spring Initializr, built with the Maven Wrapper |
| `web/` | The wizard page, written with Vue 3 and Element Plus. Its notes are in [web/README.md](./web/README.md) (Chinese) |

The generation service uses no database and no cache, and keeps no sessions.

## Where the templates come from

Once the templates are wired in, generated projects will only use released versions.

The backend comes from the `com.mugsun` artifacts on Maven Central and the releases of mugsun-boot, the frontend from Git tags of mugsun-pc.

This repository does not copy the source of mugsun-boot or mugsun-pc, and it keeps no copies of the templates.

## Tests

| Directory | Command | Workflow |
| --- | --- | --- |
| `server/` | `./mvnw -B -ntp verify` | `server-ci.yml` |
| `web/` | `pnpm typecheck && pnpm lint && pnpm test` | `web-ci.yml` |

Each workflow only runs when its own directory changes. `web-ci.yml` also builds once and checks the page layout with Playwright.

A build of `web/` fails unless `VITE_API_BASE` or `VITE_USE_MOCK=1` is set. [web/README.md](./web/README.md) explains why.

## Current limits

- The generated archive is still a plain Spring Boot skeleton with no mugsun code in it.
- There is no hosted site. `start.mugsun.com` is not deployed.
- PostgreSQL is the only database you can choose.
- No Maven artifacts, npm packages or Docker images are published.

## Related repositories

| Repository | What it is |
| --- | --- |
| [mugsun-boot](https://github.com/mugsun/mugsun-boot) | The backend. Generated projects will use its releases as the template |
| [mugsun-pc](https://github.com/mugsun/mugsun-pc) | The admin console. The frontend of a full-stack project will come from it |
| [mugsun-docs](https://github.com/mugsun/mugsun-docs) | Source of the documentation site, [docs.mugsun.com](https://docs.mugsun.com/en/) |

## Contributing

Read the [contributing guide](https://github.com/mugsun/.github/blob/main/CONTRIBUTING_EN.md) before you send a change. Report security issues privately as described in [SECURITY.md](https://github.com/mugsun/.github/blob/main/SECURITY.md). Please do not open a public issue.

## License

MIT, see [LICENSE](./LICENSE). The generation service uses Spring Initializr (Apache-2.0). The notice is in [NOTICE](./NOTICE).
