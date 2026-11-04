---
id: REQ-20261103-002
title: 系统管理核心 MVP（用户全生命周期与角色分配）
version: 1.2
risk_level: L2
channel: ai_forced_review
pm: 待指派（CLAR-004 裁决人）
business_signoff: aoyousky（2026-11-03 对话确认）
arch_reviewer: aoyousky（2026-11-03 对话确认，L2）
target_window: 2026-11-03 ~ 2026-11-14
speckit_feature: specs/002-system-management-core
---

# Spec Packet：系统管理核心 MVP（用户全生命周期与角色分配）

> 本文件是**交付与验收的唯一依据**。`specs/002-system-management-core/spec.md` 与
> `plan.md` 只是上游意图与设计来源；两者冲突时以本文件为准，并按升版流程更新 `version`。
> 本 Packet 只覆盖 MVP：Setup + Foundational + US1 用户全生命周期；角色/菜单/部门/岗位页面
> 由后续 Packet 承接，见 §7。

## 1. 意图

- **业务目标（含量化指标）**：在 Vben Admin 5.7.0 的 `apps/web-antdv-next` 中，以 `system/user`
  与隐藏页 `system/user/authRole` 为范围，完成用户列表/筛选/分页、新增、编辑、删除、重置密码、
  启停、导入、导出、分配角色，行为对齐现有 plus-ui。DoD 内指标：本 Packet 的 11 条 P0 断言
  全部通过；用户页关键链路 Playwright 失败数 0；后端接口与错误结构变更数 0。
- **调用方 / 场景 / 频率**：平台内部系统管理员，桌面端现代浏览器，中文界面；日常办公频率
  （每人每日多次进入用户管理执行查询与维护）。
- **上线 30 天成功度量（不计入 DoD）**：交付后 30 天内“用户新增/编辑/删除/授权失败且无提示”
  类工单数为 0；该指标为滞后指标，交付时不可验证，转为上线回顾。

## 2. 验收断言

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 评测环境预置部门 `D` 与用户 fixture `spec002_user`（`userId=900000000000000002`，`deptId` 属于 `D` 子树） | `GET /system/user/list?pageNum=1&pageSize=10&deptId=D` | HTTP 200；`code=200`；`rows` 为数组且包含 `spec002_user`；`total` 为整数且 `total ≥ 1`；每行满足 UserVO schema，`userId` 为字符串或数字 |
| A-02 | P0 | 管理员令牌有效；用户名 `spec002_created_<runId>` 不存在 | `POST /system/user` 提交合法 `UserForm`；随后 `GET /system/user/list?userName=spec002_created_<runId>` | 创建响应 `code=200`；查询响应 `code=200`、`total=1`，该行 `nickName` 与提交值一致 |
| A-03 | P0 | fixture 用户存在且非 `userId=1` | `PUT /system/user` 提交原 `userName`（只读、不可改）与新 `nickName`，不提交 `password`；随后 `GET /system/user/{fixtureUserId}` | 修改响应 `code=200`；详情 `code=200`，`nickName` 为新值，`userName` 保持原值 |
| A-04 | P0 | 评测环境每次运行前预置可删除用户 `spec002_delete`（`userId=900000000000000004`） | `DELETE /system/user/900000000000000004`；随后 `GET /system/user/list?userName=spec002_delete` | 删除响应 `code=200`；查询 `code=200`、`total=0`、`rows=[]` |
| A-05 | P0 | 内置管理员 `userId=1` 存在，且当前状态与角色已知 | 分别调用 `DELETE /system/user/1`、`PUT /system/user/changeStatus`（`status=1`）、`PUT /system/user/resetPwd` | 三个响应均 `code ≠ 200` 且 `msg` 非空；随后 `GET /system/user/1` 的 `status` 与角色集合与调用前一致 |
| A-06 | P0 | fixture 用户当前未分配角色 `R`（`roleId=900000000000000006`） | `PUT /system/user/authRole?userId=<fixtureUserId>&roleIds=900000000000000006`；随后查询授权页 | 提交 `code=200`；查询 `code=200`，`roles[]` 中 `R.flag=true`，`roleIds` 含 `R` |
| A-07 | P0 | 分别准备无令牌、无 `system:user:list` 的令牌、含 `*:*:*` 的令牌 | 对三种身份分别 `GET /system/user/list` | 无令牌：HTTP 401 或 `code=401`；无权限：`code=403` 且 `msg="没有访问权限，请联系管理员授权"`；通配权限：`code=200` |
| A-08 | P0 | 管理员令牌有效 | `GET /system/user/deptTree` | HTTP 200；`code=200`；`data` 为数组且至少 1 个节点；节点含 `id`、`parentId`、`label`、`children`；`children` 为数组 |
| A-09 | P0 | fixture 用户当前 `status="0"` | `PUT /system/user/changeStatus` 设为 `"1"`；随后查询详情；再设回 `"0"` | 两次修改均 `code=200`；两次查询分别返回 `status="1"` 与 `status="0"` |
| A-10 | P0 | 任意已认证令牌 | `GET /system/dict/data/type/sys_normal_disable` | HTTP 200；`code=200`；`data` 为非空数组；每项含 `dictLabel`、`dictValue`；`dictValue` 集合包含 `"0"` 与 `"1"` |
| A-11 | P0 | 管理员令牌有效，且存在 `spec002_user` | `POST /system/user/export?userName=spec002_user`（参数在 query） | HTTP 200；`Content-Type` 为 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 或 `application/octet-stream`；响应体非空；若 `Content-Type` 为 JSON 则 `code ≠ 200` 且 `msg` 非空 |
| A-12 | P1 | 具备 `system:user:*` 的账号已登录 | 进入 `/system/user`，执行“筛选 → 新增 → 编辑 → 分配角色 → 重置密码 → 启停 → 删除” | 每一步显示成功提示；刷新后列表/详情与操作一致；`pageerror` 计数为 0 |
| A-13 | P1 | 用户页已加载，状态开关可操作 | 模拟 `PUT /system/user/changeStatus` 返回 `code=500` | 失败提示出现次数 = 1；开关选中值与操作前一致（字符串相等）；`pageerror` 计数 = 0 |
| A-14 | P1 | 具备 `system:user:import` 与 `system:user:export` | 下载导入模板、上传合法文件并勾选更新、再执行导出 | 模板下载 HTTP 200 且 `Content-Type` 为 xlsx；导入响应 `code=200` 且 `msg` 为非空字符串；导出 HTTP 200 且 `Content-Type` 为 xlsx；失败时 `code ≠ 200` 且 `msg` 非空 |
| A-15 | P1 | 列表中同时存在 `userId=1` 与普通用户 | 查看两行的操作列 | `userId=1` 行内“修改/删除/重置密码/分配角色”按钮数量为 0；普通用户行对应按钮数量均为 1 |
| A-16 | P1 | 具备 `system:user:edit` 的账号已登录 | 直接访问 `/system/user-auth/role/<fixtureUserId>`；再用无权限账号访问同一地址 | 有权限：页面渲染成功且角色勾选状态与 A-06 查询结果一致；无权限：页面错误码 = 403 或路由跳转到 403/404 页面，不展示用户数据 |

> P0 断言 11 条，符合 5–12 条上限；P1 断言 5 条。
>
> A-05 不含 `authRole`：后端 `insertAuthRole` 未实现管理员保护，空 `roleIds` 为 no-op（事实见 E-22）；
> 前端不渲染 `userId=1` 的入口（A-15）。该裁决见 `clarifications/CLAR-005.md`。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 未携带令牌访问 `/system/user/list` | HTTP 401 或 `code=401`；响应体不包含用户列表数据；前端跳转 `/auth` |
| E-02 | 令牌有效但缺少 `system:user:list` | `code=403`；`msg="没有访问权限，请联系管理员授权"`；不返回用户数据 |
| E-03 | 新增用户时 `userName` 已存在 | `code ≠ 200`；`msg` 非空；列表总数不增加；表单保持输入 |
| E-04 | 新增用户时邮箱/手机号格式非法或密码含尖括号、引号、反斜杠、竖线 | 前端校验拦截，不发请求；或后端返回 `code ≠ 200` 且 `msg` 非空；列表不增加 |
| E-05 | 删除 `userId=1` | `code ≠ 200`；`msg` 非空；`GET /system/user/1` 仍返回该用户 |
| E-06 | 当前登录用户删除自己 | `code ≠ 200`；`msg` 非空；当前会话仍有效，用户仍在列表中 |
| E-07 | 编辑当前登录用户 | 部门、角色、岗位控件禁用；提交体不含 `deptId`、`roleIds`、`postIds`；`userName` 与 `password` 不出现 |
| E-08 | 状态开关请求失败或用户取消确认 | 开关恢复原值；列表刷新后状态与后端一致；不产生错误状态残留 |
| E-09 | 用户列表返回 `rows=[]` | 表格显示空状态；`total=0`；不弹错误提示；不无限加载 |
| E-10 | 查询页码超过总页数 | 返回空 `rows`，`total` 不变；分页器回到有效页码；页面不出现 `NaN` |
| E-11 | 后端返回 HTTP 500 或 `code=500` | 展示后端 `msg` 或统一错误提示；页面不白屏；DOM 不出现堆栈文本 |
| E-12 | 导出接口返回 JSON 错误体 | 检查 `Content-Type`；解析并展示 `msg`；不保存损坏文件 |
| E-13 | 导入文件为空、扩展名错误或模板列缺失 | 展示可理解错误；弹窗不关闭；不上传成功统计 |
| E-14 | 导入部分成功 | `code=200`；`msg` 含成功/失败统计；列表刷新；失败原因可见 |
| E-15 | 重置密码请求未携带加密头或密文非法 | 后端拒绝（`code ≠ 200`）；前端正常路径必须带 `isEncrypt` 且请求体为密文 |
| E-16 | 部门树节点 `disabled=true` | 用户表单的部门选择器过滤该节点；用户列表左侧树仍按后端数据展示 |
| E-17 | 昵称/备注包含长文本或特殊字符 | 保存后详情内容与原文一致；列表超长时省略显示，截断不改变保存值 |
| E-18 | 删除已被其他会话删除的用户 | `code ≠ 200`；列表刷新后该用户不出现；页面不崩溃 |
| E-19 | 后端返回的 `userId` 为字符串（超出 JS 安全整数） | 前端按字符串保存与比较；编辑/删除路径原样回传；不出现精度丢失或 `NaN` |
| E-20 | 操作过程中会话过期 | 只跳转一次 `/auth`；不出现重复跳转或循环；未提交表单数据不写入持久化存储 |
| E-21 | 分配角色提交空 `roleIds` | `code=200`；后端对空数组为 no-op，现有角色 `flag` 保持不变；页面不报错 |
| E-22 | 对 `userId=1` 提交 `authRole`（空 `roleIds`） | `code=200` 且为 no-op；`GET /system/user/authRole/1` 的 `roles[].flag` 与调用前一致；前端不渲染该入口（A-15） |

## 4. 数据契约

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `code` | number | 否 | — | `200` 成功；`401` 未认证；`403` 无权限；`500` 业务失败 |
| `msg` | string | 否 | 失败时必填 | 人类可读文案；前端原样展示，不包装 |
| `rows` | array | 否 | 空数组，不为 `null` | 分页数据 |
| `total` | number | 否 | `0` | 总条数，不是总页数 |
| `UserVO.userId` | number \| string | 否 | — | `BigNumberSerializer` 可能输出字符串；比较时转 string |
| `UserVO.userName` | string | 否 | — | 登录账号；仅新增可填，编辑不可改 |
| `UserVO.nickName` | string | 否 | — | 用户昵称 |
| `UserVO.deptId` | number \| string | 是 | `null` 表示未分配部门 | 树选择值 |
| `UserVO.deptName` | string | 是 | `null` 表示后端未填充 | 只读展示 |
| `UserVO.email` | string | 是 | `null` 表示未设置 | 无 `system:user:edit` 时后端返回掩码；前端不得还原 |
| `UserVO.phonenumber` | string | 是 | `null` 表示未设置 | 同上 |
| `UserVO.sex` | string | 是 | `null` 表示未设置 | `"0"` 男 / `"1"` 女 / `"2"` 未知 |
| `UserVO.status` | string | 否 | — | `"0"` 正常 / `"1"` 停用 |
| `UserVO.avatar` | string | 是 | `null` 表示无头像 | 后端 `@Translation` 后为 URL |
| `UserVO.createTime` | string | 是 | `null` 表示无记录 | `yyyy-MM-dd HH:mm:ss`；不做时区换算 |
| `UserVO.roleIds` | array<number \| string> | 是 | `null` 与 `[]` 均表示无角色 | 提交时保留标量类型 |
| `UserVO.postIds` | array<number \| string> | 是 | `null` 与 `[]` 均表示无岗位 | 同上 |
| `UserVO.roles` | array<RoleVO> | 是 | `null` 表示未返回 | 分配角色页使用 `flag` |
| `UserInfoVO.user` | UserVO | 是 | `null` 表示无 ID 预处理响应 | 新增前加载选项时使用 |
| `UserInfoVO.roleIds` | array<number \| string> | 是 | `null` 与 `[]` 均表示无角色 | — |
| `UserInfoVO.postIds` | array<number \| string> | 是 | `null` 与 `[]` 均表示无岗位 | — |
| `UserForm.password` | string | 是 | 编辑态不提交 | 新增必填，5–20 位，不含尖括号、引号、反斜杠、竖线 |
| `ResetPwdForm.password` | string | 否 | — | 5–20 位；请求必须加密（`isEncrypt`） |
| `UserImportParams.file` | File | 否 | — | multipart part 名 `file` |
| `UserImportParams.updateSupport` | boolean | 否 | `false` 表示不更新已存在用户 | query 参数 |
| `DeptTreeOption.id` | number \| string | 否 | — | 树节点值 |
| `DeptTreeOption.parentId` | number \| string | 否 | — | 根节点通常为 `0` |
| `DeptTreeOption.label` | string | 否 | — | Hutool `nameKey` 为 `label`，不是 `name` |
| `DeptTreeOption.disabled` | boolean | 是 | 缺省 `false` | `true` 表示停用部门 |
| `DeptTreeOption.children` | array\<DeptTreeOption\> | 是 | 缺省 `[]` | 递归结构 |
| `DictData.dictLabel` | string | 否 | — | 展示文案 |
| `DictData.dictValue` | string | 否 | — | 提交值；与后端字符串枚举一致 |

**日期与时区**：`createTime`、`loginDate` 均为 `yyyy-MM-dd HH:mm:ss` 字符串，无时区后缀；
前端直接展示，不解析为 `Date` 再格式化。**精度**：ID 一律按字符串比较；金额字段本期不涉及。

## 5. 非功能约束

- **性能口径（上线回顾指标，不计入 DoD）**：用户列表/详情接口在本地 Docker 栈、Edge 最新版下
  P95 ≤ 2s；页面路由切换 ≤ 500ms（不含接口耗时）；导出请求发起后 2s 内开始返回响应体。
  交付阶段不做压测，交付后 30 天回顾时抽样核对；未达标不阻断本次验收，但须登记为改进项。
- **安全（鉴权 / 脱敏字段）**：
  - 权限默认拒绝；按钮使用 `v-access:code`，应用层覆盖版指令必须识别 `*:*:*` 通配权限。
  - `resetPwd` 请求必须使用 `isEncrypt` 加密；令牌、AES 密钥、明文密码不得写入日志、console、
    测试快照或 trace 证据。
  - `email`、`phonenumber` 无编辑权限时为掩码值；前端不得尝试还原或缓存明文。
  - 导入文件只随请求上传，不在前端持久化；导出文件由浏览器下载，不写入仓库。
- **合规（留痕 / 审计）**：用户增删改、重置密码、授权角色由后端既有审计承接；前端不额外落盘
  敏感信息；测试数据使用 `spec002_*` 前缀，禁止使用真实用户数据。
- **可观测（必须输出的日志/trace 字段）**：前端错误日志含 `timestamp`、`level`、`url`、`message`；
  接口失败日志含 `code` 与 `msg`；不得包含令牌、密码或完整手机号。
- **评测前置条件（门禁）**：
  - 评测环境预置：部门 `D`、用户 `spec002_user`（`userId=900000000000000002`）、
    可删除用户 `spec002_delete`（`userId=900000000000000004`）、角色 `R`（`roleId=900000000000000006`）。
    预置脚本只允许在本地/CI 测试库执行，禁止指向生产库。
  - `specs/evals/run.py` 当前不支持从环境变量注入认证头与路径变量。执行 P0 用例前，必须扩展
    执行器以支持 `${EVAL_TOKEN}`、`${EVAL_USER_ID}` 等占位替换（不新增依赖），或在等价测试
    夹具中完成注入。未完成该前置时，不得运行 `--ci` 并声称通过。
  - 用例不得在 `cases.yaml` 中写入真实令牌；`EVAL_TOKEN` 由 CI secret 注入。

## 6. 状态流转

| 对象 | 当前状态 | 事件 | 下一状态 | 非法迁移的拒绝行为 |
|---|---|---|---|---|
| 用户 | `status="0"` 正常 | 管理员停用并确认 | `status="1"` 停用 | 后端拒绝时开关回滚到 `"0"` |
| 用户 | `status="1"` 停用 | 管理员启用并确认 | `status="0"` 正常 | 后端拒绝时开关回滚到 `"1"` |
| 用户 | 任意非 `userId=1` | 删除成功 | 记录不再出现在列表 | `userId=1` 或删除自己：`code ≠ 200`，状态不变 |
| 用户角色 | 未分配角色 `R` | 提交 `roleIds` 含 `R` | `R.flag=true` | 提交失败：保持原勾选，展示 `msg` |
| 用户角色 | 已分配角色 `R` | 提交空 `roleIds` | 状态不变（后端 no-op，`R.flag` 保持 `true`） | 提交失败：保持原勾选，展示 `msg` |
| 会话 | 已登录 | 任一请求返回 401 | 未登录 | 清会话并跳 `/auth`，仅跳转一次 |

## 7. Non-goals（必填）

- **本期不做**：
  - 角色管理页、菜单管理页、部门管理页、岗位管理页、角色授权用户页（`system/role`、
    `system/role/authUser`、`system/menu`、`system/dept`、`system/post`），由 REQ-002 后续 Packet
    或 REQ-003 承接。
  - 个人中心 `system/user/profile`、修改密码、头像上传、在线设备。
  - 字典管理、参数设置、通知公告、文件/OSS、客户端、租户、租户套餐、日志、监控、代码生成、
    演示页面、工作流与任务。
  - 修改 `platform/` 任何文件，包括接口、字段、错误码、权限码、SQL 与配置。
  - 新增前端依赖；新增 vxe 全局 renderer；修改 `packages/**` 上游实现。
  - 移动端/响应式专项适配、新增语言包、视觉重设计、plus-ui SVG 图标资产搬迁。
  - 重新定义导入模板列或导出文件格式；模板与列以后端既有实现为准。
  - 改变后端权限判定规则；前端只消费 `permissions` 与 `roles`。
- **不兼容**：
  - 不保证与 plus-ui 的 DOM 结构或 CSS 类名一致；只保证用户可见行为与数据契约一致。
  - 不保证导入失败文案逐字一致；只保证展示后端 `msg` 且包含成功/失败统计。
  - 不保证超出 JS 安全整数范围的 ID 以 number 形式出现；前端统一兼容 number/string。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `GET /system/user/list?pageNum=1&pageSize=10&deptId=100`，后端返回 `spec002_user` | `code=200`；`rows` 含 `{userId:"900000000000000002", userName:"spec002_user", nickName:"Spec 002", deptId:"100", status:"0"}`；`total ≥ 1`；`userId` 按字符串比较 |
| 正例 | `POST /system/user` 提交 `{userName:"spec002_created_1", nickName:"Created", deptId:"100", password:"Abc12345", roleIds:["900000000000000006"], postIds:[]}` | `code=200`；随后按 `userName` 查询 `total=1`，`nickName="Created"`，`roleIds` 含 `900000000000000006` |
| 正例 | `GET /system/user/authRole/900000000000000002`，角色 `R` 已授权 | `code=200`；`data.user.userId="900000000000000002"`；`data.roles[]` 中 `roleId="900000000000000006"` 的 `flag=true`；`data.roleIds` 含该角色 |
| **反例** | `DELETE /system/user/1`（内置超级管理员） | **必须被正确拒绝**：`code ≠ 200`，`msg` 非空（如“不允许操作超级管理员用户”）；随后 `GET /system/user/1` 仍返回该用户，`status` 与角色集合不变 |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版，由 `specs/002-system-management-core/spec.md` 断言化生成；MVP 范围仅用户与分配角色 | 2026-11-03 | 业务：aoyousky（对话确认）；架构：aoyousky（对话确认，L2） |
| 1.1 | 按 CLAR-005/006/007 裁决对齐后端事实：A-03 提交原 `userName`；A-05 移除 `authRole`；A-06/E-21 空 `roleIds` 为 no-op；新增 E-22；P1 A-13/A-14/A-16 的 Then 改为可判定表述 | 2026-11-04 | 业务：aoyousky（“按照事实执行”）；架构：aoyousky（L2） |
| 1.2 | §5 性能口径降级为“上线回顾指标，不计入 DoD”（交付期不压测，交付后 30 天抽样核对）；门禁 5 改用等价夹具执行（不改 `specs/evals/run.py`） | 2026-11-04 | 业务：aoyousky（本次裁决）；架构：aoyousky（L2） |

> 签字记录：用户于 2026-11-03 在对话中明确“确认方案，继续执行后续任务”；2026-11-04 对
> CLAR-005/006/007 裁决“按照事实执行”，据此升版至 1.1，不修改 `platform/`；同日裁决
> “性能 P95 降级为上线回顾指标”“门禁 5 改调等价夹具”，据此升版至 1.2。
> 若需更换签字人，按 §9 升版流程更新。

### FR → A-xx 映射

| 原条目 | 断言 | 状态 |
|---|---|---|
| FR-001 列表/树/筛选/分页/重置 | A-01、A-08 | 已映射 |
| FR-002 操作后视图与后端一致、失败可理解 | A-02、A-03、A-04、A-09、A-13、E-08、E-11 | 已映射 |
| FR-003 权限码控制入口与按钮 | A-07、A-15、A-16、E-02、E-20 | 已映射 |
| FR-004 敏感操作二次确认 | A-12、A-15、E-05、E-06 | 已映射（确认交互由 P1 覆盖） |
| FR-005 前端校验 + 后端校验 | E-03、E-04、E-13 | 已映射 |
| FR-006 加载/空/失败三态 | E-09、E-10、E-11 | 已映射 |
| FR-007 用户筛选与约定列 | A-01 | 已映射 |
| FR-008 新增用户字段 | A-02、E-03、E-04 | 已映射 |
| FR-009 编辑/删除/重置/启停 | A-03、A-04、A-05、A-09、E-05、E-06、E-15 | 已映射 |
| FR-010 分配角色 | A-06、A-16、E-21 | 已映射 |
| FR-011 导入模板/上传/结果 | A-14、E-13、E-14 | 已映射（P1 + 异常） |
| FR-012 按筛选条件导出 | A-11、A-14、E-12 | 已映射 |
| FR-013 部门树导航与过滤 | A-01、A-08、E-16 | 已映射 |
| FR-032 数据契约不得前端改变 | §4 数据契约、A-08、E-19 | 已映射 |
| FR-033 用户-角色/岗位关联一致性 | A-06、A-09、E-21 | 已映射 |
| FR-034 文案/枚举/错误结构一致 | A-10、E-02、E-11 | 已映射 |
| FR-014 ~ FR-031 | — | 未映射：不属于本 MVP，见 §7；由后续 Packet 承接 |
| FR-019 角色保护 | — | 未映射：角色页面不在本 MVP；用户侧仅覆盖 `userId=1` 保护（A-05） |

### UNVERIFIABLE 清单

本 Packet 无无法判定的行为断言。以下条目为 P1 人工核对项，不作为 P0 门禁：

| 条目 | 原因 | 建议核对方式 |
|---|---|---|
| 导入模板精确列 | 模板由后端提供，`spec.md` 未枚举列名 | 以模板下载文件与后端实现为准，做一次人工 round-trip；若业务要求逐列断言，升版本 Packet |
| 中文文案逐字一致 | 没有既有页面文案基线 | 只断言关键标签与后端 `msg` 原文；如需逐字基线，先提供基线清单 |
| 导出文件列顺序 | `spec.md` 只约定列集合，未约定顺序 | 断言列集合包含 FR-007 字段；顺序以导出文件为准 |

### 新增的 E-xx（由断言化补出）

E-07、E-09、E-10、E-12、E-15、E-16、E-18、E-19、E-20、E-21 为 `spec.md` 未逐条覆盖、
断言化时补出的边界。E-01/E-02 对应通用权限边界，E-03/E-04 对应重复与格式校验。

### 新增的 Non-goals（由断言化补出）

- 不保证 DOM/CSS 与 plus-ui 一致。
- 不保证导入失败文案逐字一致。
- 不保证大整数 ID 以 number 出现。
- 不重新定义导入模板列与导出格式。
