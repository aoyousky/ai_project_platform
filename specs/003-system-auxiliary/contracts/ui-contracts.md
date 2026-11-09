# Contract: UI 行为与组件契约

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Source**: `specs/SPEC-004-system-auxiliary.md` A-01～A-18、E-01～E-34、§4.12（签字版）
**Visual baseline**: plus-ui 的 RuoYi-Vue-Plus 同类页面行为；不要求 DOM/CSS 逐字一致（Packet §7）。
所有页面使用 `apps/web-antdv-next` 现有 `Page` 容器、`useVbenVxeGrid`、`useVbenModal`、
`useVbenForm`、`AntModal.confirm`、`message`，不新增全局 renderer。

## 1. 通用交互

| 规则 | 契约 |
|---|---|
| 列表容器 | `useVbenVxeGrid`，分页器显示总数；`pageSize` 默认 10，可切 20/50/100 |
| 空数据 | `rows=[]` 显示表格空状态；不弹错误（E-12/E-13） |
| 页码越界 | `resolveOutOfRangePage`：请求前按 `total` 回退到有效页；不出现 `NaN`（E-25） |
| 日期范围 | `RangePicker` 绑定 `params.beginTime/endTime`；文件页用 `beginCreateTime/endCreateTime`；起止颠倒时查询为空，不崩溃（E-33） |
| 删除/批量删除 | 先 `AntModal.confirm`，确认后才发请求；取消不发请求（A-13） |
| 清空日志/解锁/切换默认/刷新缓存 | 同上，均二次确认（A-13） |
| 提交防重 | 提交按钮进入 loading；连续点击 3 次只发 1 个请求（E-32） |
| 成功提示 | `message.success`，文案不覆盖后端业务语义 |
| 失败提示 | `message.error(msg)`，`msg` 为后端原文；不展示堆栈（A-14/E-14/E-15） |
| 页面异常 | 不产生未捕获异常；`pageerror` 计数 = 0 |
| 表单校验 | 失焦/提交时校验；不通过不发出请求，弹窗保留已填内容（E-11/E-24） |
| 按钮权限 | 无权限时按钮不进入 DOM（`v-access:code`），不是 `disabled`（A-09/E-20） |
| 敏感字段 | 列表/详情/控制台不出现 `secretKey`；表单 `InputPassword` 默认遮蔽（E-31） |

## 2. 字典管理 `/system/dict`（A-01、A-09）

**布局**：左右双栏。左侧字典类型表格（占约 55%），右侧当前类型下的字典数据表格（占约 45%）；
点击左侧行即加载右侧，右侧标题显示当前 `dictType`。

### 2.1 左侧：字典类型

- 搜索字段：字典名称、字典类型、创建时间范围。
- 表格列（顺序）：`字典名称`、`字典类型`、`备注`、`创建时间`、`操作`。
- 工具栏：`新增`（`system:dict:add`）、`删除`（批量，`system:dict:remove`）、
  `导出`（`system:dict:export`）、`刷新缓存`（`system:dict:remove`）。
- 行操作：`修改`（`system:dict:edit`）、`删除`（`system:dict:remove`）、
  `字典数据`（跳转 `/system/dict-data/index/{dictId}`，无写权限要求）。
- 删除后若当前类型被删，右侧清空；后端拒绝时保留行并展示 `msg`（A-01 反例）。
- 新增/修改弹窗字段：字典名称、字典类型、备注；校验见 §4.12。
- 刷新缓存成功后调用 `clearDictCache()`（E-34），再 `message.success`。

### 2.2 右侧：字典数据

- 搜索字段：字典标签（模糊）；`dictType` 固定为当前选中类型，不提供编辑。
- 表格列：`字典标签`、`字典键值`、`字典排序`、`回显样式`、`备注`、`创建时间`、`操作`。
- 工具栏：`新增`（`system:dict:add`）、`删除`（批量，`system:dict:remove`）、
  `导出`（`system:dict:export`）。
- 行操作：`修改`（`system:dict:edit`）、`删除`（`system:dict:remove`）。
- 新增/修改弹窗字段：字典类型（只读）、字典标签、字典键值、字典排序、样式属性、
  回显样式、备注；`isDefault` 不展示、不提交。
- 新增后右侧行数 +1，修改不改变行数，删除后 -1（A-01 期望 2→3→3→2）。
- 受限账号（仅 list/query）：工具栏与行操作中的新增/删除/导出/修改均不渲染；
  页面不出现文本“新增”“删除”“导出”（A-09）。

## 3. 隐藏字典数据页 `/system/dict-data/index/:dictId`（A-02）

- 独立页（非双栏）；顶部显示字典类型 `dictType` 与返回按钮（返回 `/system/dict`）。
- 进入流程：`GET /system/dict/type/{dictId}` → 取 `dictType` → 按 `dictType` 查字典数据。
- 表格列与 2.2 相同；搜索字段：字典标签；工具栏与行操作权限与 2.2 相同。
- `dictId` 无效：展示后端 `msg` 或“字典类型不存在”空状态；不请求字典数据列表；
  不出现“即将推出”。
- 修改标签保存后 `gridApi.reload()`，刷新后仍显示新标签（A-02）。

## 4. 参数设置 `/system/config`（A-03）

- 搜索字段：参数名称、参数键名、系统内置（`Y/N`）、创建时间范围。
- 表格列：`参数名称`、`参数键名`、`参数键值`、`系统内置`、`备注`、`创建时间`、`操作`。
- “系统内置”列将 `'Y'/'N'` 显示为“是/否”或 Tag；`null` 不出现。
- 工具栏：`新增`（`system:config:add`）、`删除`（`system:config:remove`）、
  `导出`（`system:config:export`）、`刷新缓存`（`system:config:remove`）。
- 行操作：`修改`（`system:config:edit`）、`删除`（`system:config:remove`）。
- 新增/修改弹窗字段：参数名称、参数键名、参数键值、系统内置、备注。
  编辑时“系统内置”只读保留原值（Packet §6）；新增默认 `'Y'`。
- 不实现 `configKey` 唯一性校验；重复键名可成功新增（E-07）。
- 删除内置参数被后端拒绝 → 行保留，展示 `msg`（A-03/E-08）。
- 刷新缓存成功后清空 `useDict` 会话缓存（与 E-34 同理），提示成功。

## 5. 通知公告 `/system/notice`（A-04、A-11）

- 搜索字段：公告标题、操作人员（`createByName`）、公告类型。
  **不渲染**状态筛选与时间范围筛选（Packet §4.11、§7.4）。
- 表格列：`公告标题`、`公告类型`、`状态`、`创建者`、`创建时间`、`操作`。
- 类型与状态列用 `sys_notice_type`、`sys_notice_status` 字典中文标签；
  字典未命中时显示原值，不空白。
- 工具栏：`新增`（`system:notice:add`）、`删除`（批量，`system:notice:remove`）。
- 行操作：`修改`（`system:notice:edit`）、`删除`（`system:notice:remove`）。
- 新增/修改弹窗字段：公告标题、公告类型（Radio `'1'/'2'`）、状态（Radio `'0'/'1'`，
  新增默认 `'0'`）、公告内容（`Tiptap`）。
- 内容编辑：`previewable=false`，不使用 `VbenTiptapPreview`；历史 `ql-*` 先归一化再进编辑器；
  不渲染 `v-html`。A-11 要求居中段落计算样式 `center`、大字号大于正文基准字号。
- 标题含 `<`/`>` 或超 50 字符：前端拦截或后端拒绝；弹窗不关闭、内容不丢（E-11）。
- 删除后列表 `total` 减 1；修改状态后列表标签同步。

## 6. 操作日志 `/system/log/operlog`（A-05、A-14、A-18）

- 搜索字段：系统模块、操作人员、操作地址、操作类型（多选）、状态、操作时间范围。
- 表格列：`日志编号`、`系统模块`、`操作类型`、`请求方式`、`操作人员`、`操作地址`、
  `操作地点`、`状态`、`操作日期`、`消耗时间`、`操作`。
- `businessType` 用 `sys_oper_type` 字典；`status` 显示“正常/异常”Tag；
  `costTime` 显示“xx ms”。
- 可排序列：`操作人员`（`operName`）、`操作时间`（`operTime`）、`消耗时间`（`costTime`）；
  点击表头发送 `orderByColumn` 与 `isAsc`（A-18）。
- 工具栏：`删除`（`monitor:operlog:remove`）、`清空`（`monitor:operlog:remove`）、
  `导出`（`monitor:operlog:export`）。
- 行操作：`详情`（无写权限要求；详情弹窗展示全部字段）。
- 详情弹窗：
  - `operParam`、`jsonResult`：尝试 `JSON.parse`；成功用 `<pre>{格式化 JSON}</pre>`；
    失败按原始字符串展示（E-14）；空值显示“无”。
  - 其余字段按契约原值展示；不包含 `tenantId`。
- 删除/清空二次确认；清空成功 `total=0`、`rows=[]`（E-18）。
- 导出失败（JSON 错误体）展示 `msg`，不保存文件（E-15）。

## 7. 登录日志 `/system/log/logininfor`（A-06、A-15、A-18）

- 搜索字段：用户名称、登录地址、状态、访问时间范围。
- 表格列：`访问编号`、`用户名称`、`客户端`、`设备类型`、`登录地址`、`登录地点`、
  `浏览器`、`操作系统`、`状态`、`提示消息`、`访问时间`、`操作`。
- `deviceType` 用 `sys_device_type` 字典；`status` 用 `sys_common_status` 字典，
  显示“成功/失败”Tag。
- 可排序列：`用户名称`（`userName`）、`访问时间`（`loginTime`）；发送
  `orderByColumn`/`isAsc`（A-18）。
- 工具栏：`删除`（`monitor:logininfor:remove`）、`清空`（`monitor:logininfor:remove`）、
  `解锁`（`monitor:logininfor:unlock`）、`导出`（`monitor:logininfor:export`）。
- 解锁按钮：选中行数 ≠ 1 时 `disabled`（不是隐藏）；为 1 时可用；点击先确认，
  确认后取该行 `userName` 调接口；勾选 0/2 时不发请求（A-15/E-16）。
- 行操作可无；删除通过批量选择。解锁后列表不自动移除该日志（A-06）。

## 8. 文件管理 `/system/oss`（A-07、A-12、E-19、E-20）

- 搜索字段：文件名、原名、文件后缀、服务商、上传人、创建时间范围
  （`beginCreateTime`/`endCreateTime`）。
- 表格列：`文件名`、`原名`、`文件后缀`、`服务商`、`上传人`、`上传时间`、`操作`。
- 工具栏：
  - `上传文件`（`system:oss:upload`）
  - `上传图片`（`system:oss:upload`）
  - `删除`（批量，`system:oss:remove`）
  - 预览开关（`system:config:edit`）：Switch + 标签“预览开关”；切换前确认。
- 行操作：`下载`（`system:oss:download`）、`删除`（`system:oss:remove`）；
  地址列可点击复制，不新增“预览”跳转页。
- 预览渲染：
  - 开关值 `'true'` 且 `fileSuffix` 为图片（png/jpg/jpeg/gif/webp/bmp）时，
    行内渲染 `<img src="{url}">`，`src` 必须等于该行 `url`（A-12）。
  - 开关值 `'false'` 或非图片：显示 `url` 文本（可截断，title 含完整 URL）。
  - 开关写入 `PUT /system/config/updateByKey`，成功后 `gridApi.reload()`；
    失败回滚并提示（A-16 同理）。
- 上传：
  - `Upload` 使用 `customRequest`；`上传文件` 接受任意类型，`上传图片` 接受图片类型；
    FormData 字段名 `file`。
  - 成功 `message.success` + `reload`；失败展示 `msg`；空文件前端拦截（E-19）。
  - 上传按钮无权限时不渲染；直接调用接口由后端 403（E-20）。
- 下载：
  - 点击后 `downloadOssApi`；成功保存文件，文件名 `originalName || fileName`；
    失败展示 `msg`，不保存空文件（E-29）。

## 9. 隐藏文件配置页 `/system/oss-config/index`（A-08、A-16）

- 独立页；表格列：`配置key`、`访问站点`、`桶名称`、`是否默认`、`备注`、`操作`。
  **不渲染** `secretKey`、`accessKey` 列（E-31）。
- 搜索字段：配置 key、桶名称、是否默认（`'0'/'1'`）。
- 工具栏：`新增`（`system:ossConfig:add`）。
- 行操作：`修改`（`system:ossConfig:edit`）、`删除`（`system:ossConfig:remove`）、
  `设为默认`（`system:ossConfig:edit`，仅 `status='1'` 行显示）。
- “是否默认”列：`'0'` 显示“是”Tag，`'1'` 显示“否”。
- 新增/修改弹窗字段：配置 key、accessKey、secretKey（`InputPassword`）、桶名称、
  访问站点（带协议前缀显示）、前缀、自定义域名、域、是否 HTTPS、桶权限类型、
  备注。`status` 不在表单中编辑：新增默认 `'1'`；`isHttps` 默认 `'N'`。
- 设为默认：先确认，再 `PUT /resource/oss/config/changeStatus`，载荷
  `{ ossConfigId, configKey, status: '0' }`；成功后仅一行 `status='0'`；失败回滚（A-16）。
- 删除内置配置：后端返回 `msg='系统内置, 不可删除!'`，原文展示，行保留（A-08）。
- 表单校验见 §4.12；`configKey` 重复由后端返回 `msg`（E-22）。

## 10. 组件与文件契约

| 组件/文件 | 职责 |
|---|---|
| `views/system/dict/index.vue` | 双栏容器 + 两个 grid + 两个 modal；类型选择状态 |
| `views/system/dict/dict-page-logic.ts` | 查询组装、删除载荷、行数期望、dictId 上下文 |
| `views/system/dict/components/dict-type-form.vue` | 类型新增/修改表单 |
| `views/system/dict/components/dict-data-form.vue` | 数据新增/修改表单 |
| `views/system/dict/data.vue` | 隐藏独立页；复用 `dict-data-form.vue` |
| `views/system/config/index.vue` | 参数页 + 表单弹窗 |
| `views/system/config/config-page-logic.ts` | 查询/载荷/内置判断 |
| `views/system/notice/index.vue` | 公告页 + tiptap 表单弹窗 |
| `views/system/notice/legacy-notice-html.ts` | `ql-*` → 内联样式归一化、标题注入拦截 |
| `views/system/oss/index.vue` | 文件页 + 上传 + 预览开关 + 下载 |
| `views/system/oss/oss-page-logic.ts` | 上传响应映射、预览判断、下载文件名 |
| `views/system/oss/config.vue` | 隐藏文件配置页 + 表单弹窗 |
| `views/system/oss/oss-config-page-logic.ts` | 默认切换载荷、状态回滚、secret 掩码 |
| `views/monitor/operlog/index.vue` | 操作日志页 + 详情弹窗 |
| `views/monitor/operlog/operlog-page-logic.ts` | `formatJsonOrRaw`、排序映射 |
| `views/monitor/logininfor/index.vue` | 登录日志页 + 解锁单选约束 |
| `views/monitor/logininfor/logininfor-page-logic.ts` | 解锁可用性、排序映射 |
| `adapter/component/index.ts`（修改） | `ComponentType` 增 `'Tiptap'`、`ComponentPropsMap` 增 `Tiptap`、`components` 注册 `VbenTiptap`（`@vben/plugins/tiptap`，不修改 packages） |
| `adapter/form.ts`（修改） | `modelPropNameMap` 增 `Tiptap: 'modelValue'`（`VbenTiptap` 用 `defineModel`，不是 antdv 的 `value`） |

## 11. 断言 → UI 落点

| 断言 | UI 落点 |
|---|---|
| A-01 | §2 双栏；右侧行数 2→3→3→2；删除类型失败保留 |
| A-02 | §3 独立页；表头；修改后刷新保留 |
| A-03 | §4 筛选/CRUD/内置删除/刷新缓存 |
| A-04 | §5 筛选/富文本/状态/删除 |
| A-05 | §6 筛选/详情 JSON/删除/导出 |
| A-06 | §7 筛选/解锁/删除/导出 |
| A-07 | §8 上传两种文件/下载/删除 |
| A-08 | §9 表头/CRUD/唯一默认/内置删除文案 |
| A-09 | §2.2 权限按钮不渲染 |
| A-10 | 8 个页面表头与占位页替换 |
| A-11 | §5 tiptap 归一化与计算样式 |
| A-12 | §8 预览开关与 `<img>` |
| A-13 | §1 二次确认清单 |
| A-14 | §1 失败 `message.error` |
| A-15 | §7 解锁单选 |
| A-16 | §9 默认切换回滚 |
| A-18 | §6/§7 排序字段 |
