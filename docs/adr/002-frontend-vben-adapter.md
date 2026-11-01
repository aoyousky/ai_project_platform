# ADR-002：前端框架替换为 Vben Admin（自持适配层）

- **状态**：**Accepted**（2026-11-01 裁决，CLAR-001；覆盖 ADR-001 §2.3 的"前端沿用 plus-ui"决策）
- **日期**：2026-11-01
- **责任人**：架构负责人（待指定）
- **复核到期日**：2027-04-30（与 ADR-001 同步复核 antdv-next 生态与 Vben 版本节奏）
- **关联**：宪章 VII（前端同仓）/ XI（依赖白名单）/ VIII（测试基线）；红线 R1 / R8；`specs/constraints/allowlist.md`
- **验证记录**：[vben-p1-spike.md](../evidence/vben-p1-spike.md)

---

## 1. 背景

ADR-001 选定 plus-ui（Element Plus）作为前端底座。2026-11-01 用户明确：

- 要 **Vben 的工程能力与 UI 效果**（monorepo、动态菜单、标签页、主题、vxe-table 封装）；
- 包管理器用 **pnpm** 替换 npm；
- UI 库用 **antdv-next**；
- **不依赖 ruoyi-plus-vben5 等社区二改仓库**（社区维护风险）。

因此问题不是"选哪个社区 fork"，而是"能否在**上游 Vben 官方仓库**上自持一层适配，接本仓库的
RuoYi-Vue-Plus 后端"。

## 2. 决策

**采用 Vben Admin v5.7.0 的 `apps/web-antdv-next` 应用 + 自带 `packages/**` 框架包，自持适配层；
不引入任何社区 fork。**

具体约束：

1. **来源**：上游 `vbenjs/vue-vben-admin` tag `v5.7.0`，以整仓 subtree 形式落点 `frontend/`
   （与 plus-ui 的处置方式一致：来源、commit、已登记改动写入 `frontend/PROVENANCE.md`）。
2. **包管理器**：pnpm（`packageManager: pnpm@10.33.4`），锁文件 `pnpm-lock.yaml` 入库。
3. **UI 库**：antdv-next 1.3.0（MIT），不引入 ant-design-vue / Element Plus。
4. **框架层只读**：`packages/**`、`apps/web-antdv-next/src/adapter/**` 之外的框架代码只读；
   适配改动只允许落在下表接缝。
5. **后端契约不变**：不改 `platform/` 任何接口；所有差异在前端适配层消化。
6. **只保留一个应用**：裁剪掉 `web-antd` / `web-ele` / `web-naive` / `web-tdesign` / `playground` /
   `backend-mock`，减少 AI 误落点与维护面。

### 2.1 可写接缝（替代 ADR-001 §2.3 的三处接缝）

| 接缝 | 允许内容 |
|---|---|
| `apps/web-antdv-next/src/api/**` | 接口封装、类型、加密/解密、请求拦截器 |
| `apps/web-antdv-next/src/views/**` | 页面（含 `_core` 登录页改造） |
| `apps/web-antdv-next/src/router/**` | 路由表、后端路由转换、常量路由 |
| `apps/web-antdv-next/src/layouts/**` | 布局补丁（如 `ParentView` 占位） |
| `apps/web-antdv-next/src/{preferences.ts,bootstrap.ts,directives/**}` | 应用配置、指令补丁 |
| `apps/web-antdv-next/.env.*` | 配置项取值（端口、API 前缀、clientId、RSA 公钥/私钥） |
| `frontend/{package.json,pnpm-workspace.yaml,turbo.json}` | 仅裁剪应用清单与脚本，不改构建机制 |

`packages/**` 与 `apps/web-antdv-next/src/adapter/**` 需要改动时，另提 ADR 或升级上游版本解决。

## 3. P1 Spike 结论（证据见验证记录）

在**未改动 `packages/**`** 的前提下，9 个应用层文件即完成对接，并通过无头浏览器端到端验证：

- typecheck / build 通过（dist 5.4 MB）；
- RSA+AES 加密登录 + 图形验证码通过；
- 后端 `getRouters` 的 47 个路由节点全部转成 Vue Router 可解析路由（0 重名、0 `noRedirect` 残留）；
- 样例页 `system/post` 完成"列表 → 新增 → 删除"闭环；
- 控制台仅剩"未移植页面组件缺失"告警。

### 3.1 已确认的契约差异与处置

| # | 差异 | 处置 |
|---|---|---|
| C1 | 分页响应 `{code,msg,rows,total}` 不含 `data` | `defaultResponseInterceptor.dataField` 用函数兼容两种响应体 |
| C2 | 外链菜单 `path` 为完整 URL，`addRoute` 抛错 | 转换阶段**合成内部路径** `/iframe/<slug>-<hash>` + `component: 'IFrameView'`，URL 放 `meta.iframeSrc`。**必须省略 `meta.link`**（Vben 见到 `link` 就新窗口打开）。已验证菜单可见、点击内嵌、iframe `src` 正确；目标站点若设 `X-Frame-Options` 则内嵌空白 |
| C3 | `redirect: "noRedirect"` 占位值 | 丢弃 |
| C4 | `hidden` / `noCache` 语义相反映射 | `hidden`→`hideInMenu`，`noCache`→`!keepAlive` |
| C5 | `/index` 是前端常量路由，不在后端菜单 | `accessMode: 'mixed'` + `routes/modules/home.ts` |
| C6 | 超管权限码 `*:*:*`，Vben 精确匹配 | 应用层覆盖 `v-access` 指令补通配符 |
| C7 | 响应加密按 `encrypt-key` 头动态生效 | 拦截器按头存在与否决定解密 |
| C8 | Vben 登录页自带手机号/扫码登录入口 | 移植时移除 |
| C9 | 路由 name 含 `/`、`:` | Vue Router 5 可接受，已验证无重名 |
| C10 | plus-ui 富文本用 `@vueup/vue-quill`，Vben 自带 tiptap | 富文本页面（如通知公告）迁移时改用 `@vben/plugins` 的 tiptap 编辑器；**编辑器 UI 与产出的 HTML 结构会变化**，需回归富文本渲染页 |

## 4. 偏离宪章的项与处置

| # | 宪章条款 | 偏离事实 | 处置 | 到期 |
|---|---|---|---|---|
| D9 | XI：前端技术栈基线（Element Plus / axios） | 改为 antdv-next + Vben 请求客户端（axios 内核） | 修订 `allowlist.md` §1.2 后生效；宪章技术基线随 MINOR 修订 | 2026-11-15 |
| D10 | ADR-001 §2.3：前端沿用 plus-ui | 整体替换为 Vben | 本 ADR 签署后覆盖；plus-ui 从 `frontend/` 移除 | 关闭 |
| D11 | ADR-001 R8：`package-lock.json` 必须入库 | 改为 `pnpm-lock.yaml` 必须入库 | 修订红线 R8 文本 | 2026-11-15 |
| D12 | VIII：前端测试基线 | Vben 自带 vitest 配置，但业务页面零测试 | 每个移植页面配 RED→GREEN 测试；门禁阈值按宪章 VIII | P4 实施时 |

## 5. 放弃的备选方案

| 方案 | 放弃原因 |
|---|---|
| `ruoyi-plus-vben5` 社区仓库 | 用户明确不接受社区维护风险；其适配层与后端版本强耦合，升级被动 |
| `ruoyi-vue-pro-vben`（yudao） | 面向 yudao 后端，接口契约（登录、菜单、权限）与本仓库后端不兼容 |
| 保留 plus-ui，只换皮肤 | 无法获得 Vben 的工程能力（动态路由、标签页、主题、组件封装） |
| 仅自建 Vue3 + Naive/antdv 薄骨架 | 需自建布局/菜单/鉴权/表格封装，成本高于移植 |

## 6. 后果

**正面**

- 工程能力与 UI 效果达到 Vben 官方水平，无二改仓库的被动升级风险；
- 适配层薄（9 个文件），后端零改动；
- 依赖面可审计（47 个包，运行时 CVE 面不劣于现状）；
- 上游 MIT，商用无授权风险。

**负面 / 风险**

- antdv-next 是较新的独立实现（1.3.0），生态成熟度低于 ant-design-vue；
- Vben 的 monorepo 构建（Turborepo + Changeset）需裁剪，只保留一个应用；
- 外链菜单靠 IFrameView 内嵌（受目标站点 `X-Frame-Options` / CSP `frame-ancestors` 限制）、
  `v-access` 通配符为应用层补丁；
- 工作流页面（BPMN 设计器、动态表单）迁移工作量最大，需单独 spike；
- 前端测试基线仍需从零建立。

## 7. 迁移计划与验收

| 阶段 | 任务 | 验收标准 |
|---|---|---|
| P2-1 | 本 ADR 签署 + `allowlist.md` §1.2 增补 + 红线 R8 修订 | ✅ 2026-11-01 完成，三者一致 |
| P2-2 | 工作流专项 spike（bpmn-js / 动态表单） | 给出可迁移结论与工作量 |
| P3-1 | `/spec-packet` 生成前端替换 Spec Packet | A-xx / E-xx 可判定，non-goals 明确 |
| P4-1 | 适配层落地（沿用 spike 实现，补单测） | 登录 / 菜单 / 分页 / 权限码 测试全绿 |
| P4-2 | 38 个页面逐上下文移植 | 每页 RED→GREEN；与后端接口契约一致 |
| P4-3 | 回归 + 评测集 + 契约测试 + trace | DoD 全项满足 |

**估算**：12–17 人日（依据：样例页 `system/post` 实测约 0.5 人日/页，工作流页另计）。

## 8. 裁决记录（2026-11-01，CLAR-001）

| # | 事项 | 裁决 | 落地动作 |
|---|---|---|---|
| 1 | 外链菜单（C2） | **IFrameView 内嵌** | `menu.ts` 为外链合成内部路径 + `IFrameView`；URL 入 `meta.link` |
| 2 | 权限模型（C6） | **应用层指令补丁** | `src/directives/access.ts` 识别 `*:*:*`，不改后端权限展开 |
| 3 | Vben 落点形态 | **整仓 subtree** | `frontend/` 整仓落 `v5.7.0`；裁剪清单见 §2 第 6 条 |
| 4 | plus-ui 去留 | **删除** | P4-3 直接删除旧代码，不打 tag 归档（git 历史即为归档） |
| 5 | 依赖白名单 | **升版增补**（CLAR-001 选项 A） | `allowlist.md` §1.2 已增补；R8 锁文件条款已改为 `pnpm-lock.yaml` |

裁决 1–4 均已消除 P4 阻断项；下一步为 P3 `/spec-packet`。

## 9. 参考

- Vben Admin：https://github.com/vbenjs/vue-vben-admin（tag `v5.7.0`）
- antdv-next：https://github.com/ant-design-vue/antdv-next
- Spike 证据：[vben-p1-spike.md](../evidence/vben-p1-spike.md)
