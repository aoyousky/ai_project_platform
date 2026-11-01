# 前端迁入证据（`frontend/`）

日期：2026-11-01
关联：ADR-001 §2 第 3 条、D7（偏离关闭）、§9；`docs/AI-DELIVERY-REDLINES.md` R1 / R3 / R8

## 1. 来源与导入

| 项 | 值 |
|---|---|
| 上游 | https://gitee.com/JavaLionLi/plus-ui |
| Tag | `v5.6.2-v2.6.2`（与后端 `5.6.2` 配套） |
| Commit | `d0d451967676707021b9857df529c395b27e90a7` |
| 上游提交时间 | 2026-06-17 05:05:10 +0000 |
| 导入方式 | `git clone --depth 1 --branch v5.6.2-v2.6.2`，删除 `.git` 后整体复制到 `frontend/` |
| 文件数 | 360（与源一致） |
| 体积 | 2.9 MB（不含 `node_modules` / `dist`） |
| 许可证 | MIT，`LICENSE` 保留 |

**完整性校验**：

```
$ diff -rq <源> frontend -x .git -x node_modules -x package-lock.json
Files <源>/.gitignore and frontend/.gitignore differ     # 已登记改动：解除锁文件忽略
Only in frontend: PROVENANCE.md                          # 本仓新增
```

除上述两项外无差异。

## 2. 构建验证

环境：Node.js v24.15.0，npm 11.12.1（`engines` 要求 `>= 20.19.0`）。

```
$ npm install --no-audit --no-fund
added 575 packages in 6m            # exit 0
$ cat package-lock.json             # lockfileVersion 3，666 个 packages 条目

$ npm ci --dry-run
up to date in 5s                    # exit 0，锁文件与 package.json 一致

$ rm -rf dist && npm run build:prod
EXIT=0
error 行数：0
vite v7.3.2 ✓ built in 50.57s
dist 体积：8.0 MB（201 个 js、22 个 css）
```

结论：**前端底座可安装、可锁定、可生产构建**。CI 的 `frontend` job 用 `npm ci && npm run build:prod`。

## 3. 与后端的对接点

| 项 | 前端 | 后端 |
|---|---|---|
| 端口 | `VITE_APP_PORT = 80` | `server.port = 8080` |
| 代理 | `/dev-api` → `http://localhost:8080`（`vite.config.ts`） | — |
| 加密开关 | `VITE_APP_ENCRYPT = true` | 后端需对应开启 `api-decrypt` |

## 4. 导入时发现的问题

| # | 问题 | 处置 |
|---|---|---|
| 1 | **零测试**：无 `*.test.ts` / `*.spec.ts` / vitest 配置，`vitest` 仅在 `devDependencies` | 与后端 D8 同类，前端测试基线列入 P1 |
| 2 | 上游 `.gitignore` 忽略 `package-lock.json`，依赖不可复现 | 已注释该规则，锁文件入库；记入 `frontend/PROVENANCE.md` 已登记改动 |
| 3 | `.env.*` 含 RSA 公私钥对与 `client_id`（上游公开默认值，用于接口传输加密） | 允许入库（构建必需），但红线 R3 要求上线前重新生成并改为环境注入 |
| 4 | `README.md` 为上游原版（多租户管理系统说明），与本仓约定不一致 | 保留原文，本仓约定以 `frontend/PROVENANCE.md` 为准 |

## 5. 未验证

- 未与后端联调（后端未启动，需要 MySQL + Redis）。
- `npm run dev` 未实际运行（仅验证了生产构建）。
- 未做前端依赖的 CVE 扫描（列入 P1）。

## 6. 一条待裁决的白名单差异

`specs/constraints/allowlist.md` §1.2 写着"前端依赖（plus-ui 5.X，version 5.6.2-2.6.2）"，
其中列有 **`vxe-pc-ui`**，但实际 `frontend/package.json` **没有这个依赖**（只有 `vxe-table 4.18.1`）。

这属于 `specs/` 下的内容，按 CLAUDE.md 只读不自行修改，已上报待裁决。
