# Quickstart：REQ-002 系统管理核心验收指南

**Date**: 2026-11-03 | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/backend-api-consumed.md](./contracts/backend-api-consumed.md)

> 本文件是**运行与验收指南**，不是实现说明。每条场景对应 `spec.md` 的 FR / SC 编号；失败即视为
> 交付未完成（CLAUDE.md DoD）。实现细节见 `tasks.md` 与代码。

## 1. 前置条件

| 项 | 要求 | 检查命令 |
|---|---|---|
| Node | `^22.18.0` 或 `^24.0.0` | `node -v` |
| pnpm | 10.33.4（Corepack 自动） | `corepack enable && pnpm -v` |
| 后端栈 | MySQL 8 / Redis / `awp-backend:8080` | `docker ps --format '{{.Names}}'` |
| Redis 密码 | 本地 `aoyou123`（E2E 读取验证码用） | `docker exec awp-redis redis-cli -a aoyou123 ping` |
| 超管账号 | `admin`，角色 `superadmin`，拥有 `*:*:*` | 后端初始化数据 |
| 普通账号 | 仅授予 `system:user:list` / `system:post:list` 等只读权限，用于权限场景 | 在用户/角色管理中创建 |
| 浏览器 | 系统 Edge/Chrome（Playwright 使用 `channel: 'msedge'`） | — |

## 2. 启动

```bash
# 后端
cd deploy && docker compose up -d

# 前端
cd ../frontend
corepack enable
pnpm install
pnpm -F @vben/web-antdv-next dev        # http://localhost:5666
```

**预期**：登录后侧栏出现「系统管理」下的用户、角色、菜单、部门、岗位；控制台无未捕获异常；
没有“组件不存在”“路由重复”类红色错误。

## 3. 自动化门禁

```bash
cd frontend

# 类型检查（宪章 VII）
pnpm -F @vben/web-antdv-next typecheck

# 单元/组件测试 + 覆盖率（宪章 VIII；范围见 research R10）
pnpm test:unit -- --coverage

# 生产构建
pnpm -F @vben/web-antdv-next build

# 端到端（需后端栈在线）
pnpm exec playwright test tests/e2e/system-user.spec.ts tests/e2e/system-role.spec.ts \
  tests/e2e/system-menu.spec.ts tests/e2e/system-dept.spec.ts tests/e2e/system-post.spec.ts
```

**通过标准**：四条命令均以 0 退出；覆盖率报告对新代码（`src/api/system/**`、`src/utils/system/**`、
`src/composables/use-dict.ts`、`src/views/system/**` 中可测试逻辑）lines / branches / functions /
statements ≥ 70%；Playwright 报告无失败。

评测集：

```bash
# 静态校验（P0 覆盖检查，不联网）
python specs/evals/run.py --check

# HTTP 用例（需后端栈）
EVAL_BASE_URL=http://localhost:8080 python specs/evals/run.py --ci \
  --report specs/evals/reports
```

## 4. 手工验收场景

### VS-1 用户管理（FR-007 ~ FR-013）

1. **列表与部门树**：进入「系统管理 → 用户管理」。左侧部门树可展开/折叠；点击某部门后列表只显示
   该部门及下级用户；清空部门筛选后恢复全量。
2. **筛选**：按用户名称、昵称、手机号、状态、创建时间范围分别筛选；分页总数变化；「重置」恢复默认。
3. **新增**：点击新增 → 填写昵称、归属部门、手机号、邮箱、用户名称、密码、性别、状态、岗位、角色
   → 提交。新用户出现在列表。重复用户名/手机号/邮箱时展示后端 `msg`，表单不关闭。
4. **编辑**：编辑刚创建的用户，修改昵称/邮箱/状态/岗位/角色；保存后列表与详情一致。编辑态无
   “用户名称”“密码”输入项。
5. **分配角色**：行内「分配角色」→ 勾选角色 → 提交 → 重新进入授权页，勾选结果保持。
6. **重置密码**：行内「重置密码」→ 输入 5–20 位新密码 → 确认。密码含 `< > " ' \ |` 时前端拒绝。
7. **状态开关**：切换状态 → 二次确认 → 成功提示。断网或后端拒绝时开关恢复到原值。
8. **批量删除**：勾选两个用户 → 删除 → 确认 → 列表不再出现。勾选超管或当前登录用户时后端拒绝，
   页面展示原因。
9. **导入**：下载模板 → 上传合法文件 → 勾选“更新已存在用户数据” → 提交 → 弹窗展示成功/失败统计；
   上传非法格式时展示可理解错误。
10. **导出**：点击导出 → 下载文件包含当前筛选条件下的用户列。

### VS-2 角色、数据权限与授权用户（FR-014 ~ FR-019）

1. **列表**：按角色名称、权限字符、状态、创建时间筛选；重置恢复默认。
2. **新增/编辑**：新增角色（名称、权限字符、顺序、状态、备注）→ 列表出现。编辑角色 → 菜单树勾选/
   取消 → 保存 → 重新打开勾选状态一致；切换父子联动后勾选集合与保存结果一致。
3. **数据权限**：行内「数据权限」→ 选择“自定义数据权限”→ 勾选部门 → 保存 → 重新打开保持一致；
   切换到其他范围时部门树按既有规则隐藏/显示。
4. **分配用户**：行内「分配用户」→ 在未授权列表选择用户 → 添加 → 已授权列表出现；移除/批量移除后
   两个列表同步。
5. **保护**：超管角色（`roleId=1`）不显示修改/删除/数据权限/分配用户入口；尝试通过接口删除被引用
   角色时展示后端原因。
6. **导出**：导出文件包含当前筛选条件下的角色列。

### VS-3 菜单管理（FR-020 ~ FR-023）

1. **树表**：进入菜单管理，树形展示菜单名称、图标、排序、权限标识、组件路径、状态、创建时间；
   按名称/状态筛选后只显示匹配节点及其必要父节点；重置恢复完整树。
2. **新增**：新增目录 → 新增其子菜单 → 新增按钮节点。不同类型按既有规则要求不同必填项；缺必填项
   时前端提示，不提交。
3. **编辑**：修改名称、排序、权限标识、显示状态、缓存设置、激活路由（`remark`）→ 保存 → 树与详情
   立即反映。
4. **删除**：删除有子节点的菜单 → 后端拒绝并提示；使用级联删除 → 确认后节点及所有子节点消失。
5. **权限生效**：把新菜单分配给角色 → 用该角色账号登录 → 仅显示已授权且未隐藏的菜单；按钮权限按
   `perms` 生效。

### VS-4 部门管理（FR-024 ~ FR-027）

1. **树表**：按部门名称、类别编码、状态筛选；展开/折叠不影响筛选结果；重置恢复完整树。
2. **新增**：新增一级部门 → 新增下级部门；同级名称重复或上级非法时展示后端错误。
3. **编辑**：修改名称、排序、负责人、联系电话、邮箱、状态 → 保存 → 树与详情同步。上级部门选择器
   不包含自身及下级。
4. **删除**：删除含下级或关联用户的部门 → 后端拒绝并说明原因；删除空叶子部门成功。
5. **一致性**：用户管理左侧部门树、用户表单归属部门、角色数据权限部门树的结构一致；停用部门在
   用户表单选择器中按规则过滤。

### VS-5 岗位管理（FR-028 ~ FR-031）

1. **列表**：按岗位编码、名称、类别、部门、状态筛选；分页正确；重置恢复默认。左侧部门树点击按
   子树筛选。
2. **新增/编辑**：新增岗位（名称、编码、类别、所属部门、顺序、状态、备注）→ 列表出现；编码重复时
   展示后端错误。
3. **删除**：删除被用户引用的岗位 → 后端拒绝并说明原因；删除未引用岗位成功。
4. **用户表单**：在用户新增/编辑页打开岗位选择器，选项与岗位管理数据一致；保存后用户岗位关系正确。
5. **导出**：导出文件包含当前筛选条件下的岗位列。

### VS-6 权限与失败路径（FR-003、FR-005、FR-006、SC-004、SC-006）

1. 普通账号登录 → 只有被授权的菜单可见；无权限按钮不渲染。
2. 普通账号直接访问 `/system/menu` 或隐藏授权页 → 403/404，无受限数据泄漏。
3. 断网或后端返回 500 → 列表/树显示错误状态，不出现空白无提示或无限加载。
4. 列表为空 → 显示空状态，不弹错误。
5. 状态开关失败/取消 → 恢复原值；表单提交失败 → 输入保留、弹窗不关闭。
6. 会话过期 → 按统一规则回登录页；无未捕获异常。

### VS-7 hidden 授权页直接访问（FR-010、FR-018）

1. 已登录且具备 `system:user:edit` 时，直接访问 `/system/user-auth/role/<userId>` → 显示分配角色页。
2. 已登录且具备 `system:role:edit` 时，直接访问 `/system/role-auth/user/<roleId>` → 显示分配用户页。
3. 无权限账号访问上述地址 → 403/404，不显示用户/角色数据。

## 5. 证据留存

| 证据 | 路径 | 说明 |
|---|---|---|
| 单测/覆盖率 | `frontend/coverage/` | Vitest HTML + json-summary |
| E2E 报告 | `frontend/tests/e2e/report/` | Playwright HTML |
| E2E 截图/trace | `frontend/tests/e2e/.artifacts/` | 失败时保留 |
| 评测报告 | `specs/evals/reports/` | `run.py --report` 输出 |
| trace | `trace/<需求编号>.yaml` | P0 断言 → file:line、测试证据 |
| 构建产物 | `frontend/apps/web-antdv-next/dist/` | `pnpm build` 成功后留存 |

## 6. 故障排查

| 现象 | 可能原因 | 处置 |
|---|---|---|
| 列表全空但后端有数据 | 分页响应未按 `rows` 解析 | 检查 `resolveResponseData` 与 API 返回类型 |
| 超管看不到按钮 | `*:*:*` 未被 `v-access` 识别 | 检查 `directives/access.ts` 是否已注册覆盖版指令 |
| 菜单页写操作 403 | 只校验了权限码，未校验 `superadmin` 角色 | 检查按钮守卫与 `userStore.userInfo.roles` |
| 树选择显示 `undefined` | 把 `label` 当成 `name` | 使用 `data-model.md` 的 `DeptTreeOption` / `MenuTreeOption` |
| 菜单/部门树筛选后只剩一个子树 | 误用了 `/treeselect` 作为列表数据 | 列表用 `/list` flat 数据，前端构树 |
| 日期筛选不生效 | 日期范围未写入 `params[beginTime]` / `params[endTime]` | 使用 `utils/system/query.ts` 的 `addDateRange` |
| 导出文件损坏 | 后端返回 JSON 错误体被当 blob 保存 | 检查 `Content-Type`，JSON 时解析 `msg` |
| 导入 400 | 手动设置了 multipart `Content-Type` | 删除手动 header，交给浏览器生成 boundary |
| 授权页刷新后 404 | 隐藏菜单未进入动态路由或组件路径不匹配 | 检查 `getRouters` 中 `hidden` 项与 `views/system/**` 文件名 |
| 状态开关与后端不一致 | 失败/取消未回滚 | 保存旧值，失败时恢复并刷新 |
