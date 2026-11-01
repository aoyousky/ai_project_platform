# frontend/ 来源与约束

本目录是 **RuoYi-Vue-Plus 配套前端 `plus-ui` 5.X** 的原样副本，与 `platform/`（后端底座）配套使用。

## 来源

| 项 | 值 |
|---|---|
| 上游仓库 | https://gitee.com/JavaLionLi/plus-ui |
| Tag | `v5.6.2-v2.6.2`（与后端 `5.6.2` 配套） |
| Commit | `d0d451967676707021b9857df529c395b27e90a7` |
| 上游提交时间 | 2026-06-17 05:05:10 +0000 |
| 导入日期 | 2026-11-01 |
| 导入方式 | `git clone --depth 1 --branch v5.6.2-v2.6.2`，删除 `.git` 后整体复制 |
| 文件数 / 体积 | 360 个文件 / 约 2.9 MB（不含 `node_modules`） |
| 许可证 | MIT，`LICENSE` 原样保留，不得删除 |

## 技术基线

| 项 | 版本 |
|---|---|
| 运行时 | Node.js **>= 20.19.0**，npm >= 8.19.0（`package.json.engines` 强制） |
| 框架 | Vue 3.5.30 + TypeScript 5.9 + Vite 7.3.2 |
| UI | Element Plus 2.13.5、vxe-table 4.18.1、UnoCSS 66.6.6 |
| 状态/路由 | Pinia 3.0.4、vue-router 5.0.3 |
| 后端对接 | Vite dev 代理 `VITE_APP_BASE_API=/dev-api` → `http://localhost:8080`（与 `platform` 的 `server.port` 一致） |

## 只读约束与可写接缝

本目录与 `platform/` 同等对待：**框架代码只读，业务代码另开目录**。

| 可写接缝 | 允许的操作 |
|---|---|
| `src/views/<context>/` | 新增业务页面（`<context>` 与后端 `business/<context>` 同名） |
| `src/api/<context>/` | 新增业务接口封装 |
| `.env.development` / `.env.production` | 改**已有配置项的值**（标题、base api 等），不得增删配置结构 |

其余文件（`src/components`、`src/layout`、`src/router`、`src/store`、`src/utils`、`vite/`、`vite.config.ts`、`package.json` 等）
一律只读；需要改动时另提 ADR 并登记到下方"已登记改动"表。

## 已登记改动（相对上游）

| 文件 | 改动 | 理由 |
|---|---|---|
| `.gitignore` | 注释掉 `package-lock.json` 的忽略规则 | 上游不锁依赖版本，无法复现构建；本项目要求 `package-lock.json` 入库 |

## 已知问题（导入时核验）

1. **零测试**：全仓没有 `*.test.ts` / `*.spec.ts`，也没有 vitest 配置；`vitest` 仅出现在 `devDependencies`。
   即前端不存在可用测试基线，与后端 D8 同类问题。
2. **上游 `.gitignore` 忽略全部锁文件**（`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`），
   导致依赖版本不可复现。本项目处置：改由本仓根 `.gitignore` 控制，`package-lock.json` **必须入库**。
3. **`.env.*` 内含 RSA 公私钥对与 `client_id`**，均为上游公开默认值。它们用于接口传输加密（前后端成对），
   **不是身份凭据**，但仍禁止在真实环境沿用；上线前必须重新生成并改为环境注入（红线 R3）。
4. 未做前端构建验证之外的运行时验证（未与后端联调）。

## 升级流程

1. 后端升级到新版本时，前端必须同步升级到配套 tag（`plus-ui` 的 tag 形如 `v<后端版本>-v<前端自身版本>`）。
2. 升级前先记录当前"已登记改动"，升级后逐条重新应用，不得直接覆盖。
3. 升级后必须验证：`npm ci && npm run build:prod` 通过；`src/views`、`src/api` 下的业务目录未被覆盖。
