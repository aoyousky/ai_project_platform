# CLAR-001

- REQ: REQ-FE-VBEN（待 Spec Packet 分配正式编号）
- TRIGGER: allowlist §1.2「前端依赖」— 需要引入白名单之外的依赖
- STATUS: 已裁决（2026-11-01）
- RAISED_BY: agent
- DATE: 2026-11-01

## 歧义描述

ADR-002 决定前端由 plus-ui（Vue 3 + Element Plus + axios + npm）替换为 Vben Admin 5.7.0
（`apps/web-antdv-next` + antdv-next + pnpm + `@vben/*` 框架包）。当前
`specs/constraints/allowlist.md` §1.2 只登记了 Vue 3 / TypeScript / Vite / Pinia / Vue Router /
Element Plus / axios，**不包含**以下任何一项。按 CLAUDE.md 铁律 2，引入白名单外依赖必须裁决。

两种理解：

- **理解 A**：白名单随 ADR-002 一并升版，登记 Vben 前端栈后进入实现；
- **理解 B**：不升版白名单，前端替换不实施，继续用 plus-ui。

### 待登记依赖（P1 spike 实测版本）

| 类别 | 组件 | 版本 | 性质 | 许可证 |
|---|---|---|---|---|
| UI 库 | antdv-next | 1.3.0 | runtime | MIT |
| 框架包 | `@vben/*`（access/common-ui/constants/hooks/icons/layouts/locales/plugins/preferences/request/stores/styles/types/utils，共 14 个） | workspace | runtime（仓库内源码） | MIT |
| 表格 | vxe-table | 4.18.13 | runtime | MIT |
| 加密 | crypto-js / jsencrypt | 4.2.0 / 3.5.4 | runtime | MIT |
| 组合式工具 | @vueuse/core | 14.x | runtime | MIT |
| 日期 | dayjs | 1.11.x | runtime | MIT |
| 基础框架 | vue / vue-router / pinia | 3.5.34 / 5.0.7 / 3.0.4 | runtime | MIT |
| 样式 | tailwindcss（v4）/ reka-ui | 4.3.x / 2.9.7 | runtime（构建 + 组件基座） | MIT |
| 构建 | vite / typescript | 8.0.13 / 6.0.3 | dev | MIT / Apache-2.0 |
| 包管理 | pnpm + Corepack | 10.33.4 | toolchain | MIT |

**需同时确认的许可证例外**（均已在 P1 采集，未进入运行时产物或可替代）：

- `@commitlint/*` — GPL-3.0，**仅 devDependency**
- `lightningcss` — MPL-2.0，构建期
- `zod-defaults` — 许可证为 Unknown（运行时，经 form-ui 链路引入）
- `node-forge` — BSD-3-Clause / GPL-2.0 双许可，可选用 BSD

**连带变更**：红线 R8 的 `package-lock.json` 必须入库需改为 `pnpm-lock.yaml` 必须入库；
前端可写接缝需按 ADR-002 §2.1 重写。

## 影响对比

| 选项 | 行为 | 影响的断言 |
|---|---|---|
| A | 升版 allowlist §1.2 登记上表依赖 + 修订 R8 锁文件条款 + 按 ADR-002 §2.1 重写前端接缝；随后按 P3 Spec Packet 进入实现 | 前端实现可启动；运行时依赖面从 29 个外部包起算；`*:*:*` 通配符、外链菜单等 4 项待裁决仍阻断 P4 |
| B | 不升版，维持 plus-ui 与 npm/Element Plus 现状 | 前端框架替换不实施；ADR-002 作废，改回 ADR-001 §2.3 |

## Agent 默认假设（仅供参考，未经裁决不得据此交付）

无有效默认假设：这是"是否引入新依赖栈"的审批项，不是可用默认值消解的歧义。
在裁决前，**不安装新依赖、不改 `frontend/`、不写实现代码**；spike 代码仅存在于临时目录
`D:\workstation\_spike\`，不并入仓库。

## PM 裁决

**2026-11-01 裁决**：

1. **依赖白名单**：选 **A** —— 升版 `specs/constraints/allowlist.md`，增补 Vben 前端栈。
   已执行：§1.2 重写为「1.2.1 目标基线（Vben 5.7.0 / antdv-next / pnpm）」+「1.2.2 存量过渡项
   （plus-ui，P4-3 后删除）」；摘要行（§1 表 row "前端"）与 §5 机器校验口径同步更新；
   `docs/AI-DELIVERY-REDLINES.md` R1 接缝表与 R8 锁文件条款（`package-lock.json` →
   `pnpm-lock.yaml`）已同步修订。
2. **外链菜单**：**IFrameView 内嵌**（不再剔除）。
3. **超管权限**：**应用层指令补丁**（覆盖 `v-access`，识别 `*:*:*`）。
4. **Vben 落点形态**：**整仓 subtree** 到 `frontend/`。
5. **plus-ui 旧代码**：**删除**。

**是否升版 Spec Packet：是。** 版本号待 `/spec-packet` 生成时分配（前端框架替换 Spec Packet），
在此之前的实现仍冻结。

裁决回写记录：`docs/adr/002-frontend-vben-adapter.md` §8 已按上述 5 项更新并转 Accepted。
