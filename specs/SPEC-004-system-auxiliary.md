---
id: REQ-20261107-005
title: 系统管理辅助模块（字典 / 参数 / 公告 / 日志 / 文件）前端交付
version: 1.0
risk_level: L2
channel: ai_forced_review
pm: aoyousky（2026-11-07 确认 8 视图范围）
business_signoff: Jim Liu（2026-11-07 确认 10 条 P0、8 条 P1、34 条 E 与 §7 五项）
arch_reviewer: Jiankui Zhang（2026-11-07 架构确认，L2）
target_window: 2026-11-07 ~ 2026-11-21
speckit_feature: specs/003-system-auxiliary
---

# Spec Packet：系统管理辅助模块（字典 / 参数 / 公告 / 日志 / 文件）前端交付

> 本文件是**交付与验收的唯一依据**。`specs/003-system-auxiliary/spec.md` 与
> `specs/003-system-auxiliary/checklists/requirements.md` 只是上游意图与质量记录；
> 两者冲突时以本文件为准，并按升版流程更新 `version`。
> 本 Packet 覆盖后端 `getRouters` 中的 8 个视图：
> `system/dict/index`、`system/dict/data`（隐藏）、`system/config/index`、`system/notice/index`、
> `monitor/operlog/index`、`monitor/logininfor/index`、`system/oss/index`、`system/oss/config`（隐藏）。
> 用户已于 2026-11-07 明确选择“全部 8 个视图”；`client/*`、`tenant/*`、`tenantPackage`
> 不在本 Packet 范围。

## 1. 意图

- **业务目标（含量化指标）**：在 Vben Admin 5.7.0 的 `apps/web-antdv-next` 中完成字典、参数、
  通知公告、操作日志、登录日志、文件管理与文件配置管理 8 个视图的列表、筛选、分页、新增、修改、
  删除、导出、缓存刷新、上传、下载、解锁与默认配置切换，用户可见行为对齐 plus-ui 删除前基线
  （`0534d3d^`）。DoD 内指标：本 Packet 的 10 条 P0 断言全部通过；8 个视图上“即将推出”占位页
  出现次数为 0；越权按钮可见数量为 0；`platform/` 与 `frontend/packages/**` 变更数为 0；
  新增前端依赖数为 0。
- **调用方 / 场景 / 频率**：平台超级管理员、租户管理员与具备相应权限码的运营人员；
  桌面端现代浏览器、中文界面；字典与参数在配置调整时集中使用，日志在排障与审计时使用，
  文件在头像、富文本图片与业务附件上传时使用。
- **上线 30 天成功度量（不计入 DoD）**：交付后 30 天内“字典/参数保存后不生效”“公告内容格式
  丢失”“日志详情打不开”“文件上传后列表不显示”类工单数为 0。该指标为滞后指标，交付时不可
  验证，转为上线回顾。

## 2. 验收断言

> 评测夹具（`scripts/evals/seed_spec004.sh` 在实现阶段提供）：字典类型
> `spec004_dict_type`（名称 `Spec004 字典类型`）及其字典数据 `spec004_value_a`
> （标签 `Spec004 标签一`）、`spec004_value_b`（标签 `Spec004 标签二`）；非内置参数
> `spec004.config.key`（`configType='N'`）；公告 `Spec004 公告`（`noticeType='1'`、
> `status='0'`，内容含 `ql-align-center` 与 `ql-size-large`）；操作日志 `Spec004 操作`
> （`operName='spec004_operator'`，请求参数为合法 JSON `{"key":"value"}`）；登录日志用户
> `spec004_lock`（`status='1'`）；仅字典列表权限的账号 `spec004_limited`（密码 `admin123`）。
> 内置参数 `sys.oss.previewListResource`（`configId=11`，`configType='Y'`）、内置文件配置
> `ossConfigId=1/2` 由基线 SQL 提供。A-08 在用例内新建文件配置并在结束时恢复 `ossConfigId=1`
> 为默认；除 A-09 外均使用拥有 `*:*:*` 的超级管理员令牌。

| 编号 | 优先级 | Given | When | Then（状态码/返回值/阈值/错误码之一） |
|---|---|---|---|---|
| A-01 | P0 | 字典类型 `spec004_dict_type` 及其两条字典数据存在；`admin` 已登录 | 打开 `/system/dict`；按 `dictType=spec004_dict_type` 筛选；点击类型行；在右侧新增一条字典数据、修改其标签、删除该条；再删除该字典类型 | 左侧 `total=1` 且行 `dictType='spec004_dict_type'`；右侧表头含“字典标签”“字典键值”“字典排序”，初始显示 2 行；新增/修改/删除字典数据的响应 `code=200`，右侧行数依次为 2→3→3→2；删除字典类型响应 `code≠200` 且 `msg` 非空，类型与两条字典数据仍存在；`pageerror` 计数 = 0 |
| A-02 | P0 | 隐藏菜单 `system/dict/data` 存在；`spec004_dict_type` 的 `dictId` 可从夹具取得 | 直接访问 `/system/dict-data/index/{dictId}`；在页面内修改一条字典数据的标签并保存 | 页面渲染“字典标签”“字典键值”表头，行数 ≥ 2；DOM 中不出现“即将推出”；响应 `code=200`；刷新后列表显示新标签；`pageerror` 计数 = 0 |
| A-03 | P0 | 参数 `spec004.config.key`（`configType='N'`）与内置参数 `sys.oss.previewListResource`（`configType='Y'`）存在 | 打开 `/system/config`；按参数名称与键名筛选；新增参数、修改参数值、删除新增参数；删除内置参数；点击刷新缓存 | 筛选 `total` 与命中行数一致；新增/修改/删除响应 `code=200`；删除内置参数响应 `code≠200` 且 `msg` 非空，内置参数仍在列表；刷新缓存响应 `code=200`；`pageerror` 计数 = 0 |
| A-04 | P0 | 公告 `Spec004 公告` 存在；`admin` 已登录 | 打开 `/system/notice`；按标题、操作人员、类型筛选；打开编辑弹窗核对内容；新增一条带居中与大字号格式的公告；保存后重新打开；修改状态并保存；删除该公告 | 筛选 `total=1` 且公告类型、状态以中文标签显示；`GET /system/notice/{新公告 id}` 的 `noticeContent` 非空且包含新公告正文文本；编辑弹窗回显相同正文；修改状态响应 `code=200` 且列表状态标签同步；删除后 `total` 减 1；`pageerror` 计数 = 0 |
| A-05 | P0 | 操作日志 `Spec004 操作` 存在 | 打开 `/system/log/operlog`；按系统模块与操作人员筛选；打开详情；删除该条；导出当前筛选结果 | 列表 `total ≥ 1` 且行含 `title='Spec004 操作'`、`operName='spec004_operator'`、`operParam`、`jsonResult`、`status`、`operTime`、`costTime`；详情弹窗展示请求参数与返回参数，合法 JSON 以可读结构展示；删除响应 `code=200` 且 `total` 减 1；导出 HTTP 200、响应体非空且 `Content-Type` 属于 xlsx 或 octet-stream；`pageerror` 计数 = 0 |
| A-06 | P0 | 登录日志 `spec004_lock` 存在 | 打开 `/system/log/logininfor`；按用户名称与状态筛选；仅勾选该行并执行解锁；删除该行；导出当前筛选结果 | 列表 `total ≥ 1` 且行含 `userName='spec004_lock'`、`ipaddr`、`loginLocation`、`browser`、`os`、`status`、`loginTime`；解锁响应 `code=200`，解锁后该日志仍在列表；删除响应 `code=200` 且 `total` 减 1；导出 HTTP 200、响应体非空且 `Content-Type` 属于 xlsx 或 octet-stream；`pageerror` 计数 = 0 |
| A-07 | P0 | `admin` 已登录；对象存储配置可用（默认 `ossConfigId=1`） | 打开 `/system/oss`；通过上传入口上传 1 个 PNG 图片与 1 个 UTF-8 文本文件；在列表中找到两条记录；下载 PNG；勾选两条并删除 | 两次上传响应 `code=200`，列表出现两张记录且 `originalName`、`fileSuffix`、`service`、`createByName` 非空；下载 HTTP 200 且响应体非空、`Content-Disposition` 含 `attachment`；删除响应 `code=200` 且两条记录从列表消失；`pageerror` 计数 = 0 |
| A-08 | P0 | 内置文件配置 `ossConfigId=1/2` 存在；`admin` 具备 `system:ossConfig:*` | 直接访问 `/system/oss-config/index`；按配置 key、桶名称、是否默认筛选；新增配置 `spec004_oss_config`、修改其桶名称、将其设为默认、删除内置配置 `ossConfigId=2`、删除新增配置 | 页面渲染“配置key”“访问站点”“桶名称”“是否默认”表头且不出现“即将推出”；新增/修改响应 `code=200`；`GET /resource/oss/config/list` 中 `status='0'` 的行恰好 1 条且为 `spec004_oss_config`；删除内置配置响应 `code≠200` 且 `msg='系统内置, 不可删除!'`，该配置仍在；删除新增配置响应 `code=200`；结束后恢复 `ossConfigId=1` 为默认；`pageerror` 计数 = 0 |
| A-09 | P0 | 账号 `spec004_limited` 的角色仅绑定字典菜单与 `system:dict:list`/`system:dict:query`，无 `system:dict:add/edit/remove/export` | 使用该账号登录并打开 `/system/dict`；再以该账号调用 `POST /system/dict/type` | 页面可加载字典列表且 `total ≥ 1`；DOM 中不存在“新增”“删除”“导出”按钮；写接口 HTTP 200、`code=403`、`msg='没有访问权限，请联系管理员授权'`；`pageerror` 计数 = 0 |
| A-10 | P0 | `admin` 已登录；后端 `getRouters` 返回 8 个目标菜单（6 个可见、2 个隐藏） | 依次打开 `/system/dict`、`/system/dict-data/index/{dictId}`、`/system/config`、`/system/notice`、`/system/log/operlog`、`/system/log/logininfor`、`/system/oss`、`/system/oss-config/index` | 8 个地址均不出现“即将推出”、不落到 403/404；每页出现对应表头：字典名称 / 字典标签 / 参数名称 / 公告标题 / 日志编号 / 访问编号 / 文件名 / 配置key；`pageerror` 计数 = 0 |
| A-11 | P1 | 公告 `Spec004 公告` 的内容含 `ql-align-center` 与 `ql-size-large` 类 | 打开该公告的编辑弹窗 | 正文可见且文本与原文一致；居中段落计算样式 `text-align='center'`；大字号文本计算字号大于正文基准字号；页面不出现脚本执行或未捕获异常 |
| A-12 | P1 | `sys.oss.previewListResource` 当前值为 `'true'`；列表中存在 PNG 记录 | 打开 `/system/oss` 查看列表；点击预览开关并在确认框确认；再次查看列表；恢复开关为 `'true'` | 首次列表的图片行渲染 `<img>` 且 `src` 等于该行 `url`；开关写入后 `GET /system/config/configKey/sys.oss.previewListResource` 返回 `'false'`，列表图片行改为展示 URL 文本；再次切换恢复 `'true'`；开关按钮仅对具备 `system:config:edit` 的账号渲染 |
| A-13 | P1 | 任一列表页已加载 | 执行删除、批量删除、清空日志、解锁、切换默认配置、刷新缓存 | 每个敏感操作先出现二次确认；确认前不发出写请求；取消后数据与开关状态不变 |
| A-14 | P1 | 列表接口被拦截为 HTTP 500 或 `code ≠ 200` | 打开任一列表页 | 页面展示后端 `msg` 或统一错误提示；不出现无限加载；`pageerror` 计数 = 0 |
| A-15 | P1 | 登录日志列表已加载 | 分别勾选 0 条、1 条、2 条 | 勾选 0 条或 2 条时“解锁”入口不可用；勾选 1 条时可用 |
| A-16 | P1 | 文件配置默认项为 `ossConfigId=1`；新增配置存在 | 将新增配置设为默认；拦截 `PUT /resource/oss/config/changeStatus` 使其失败 | 首次切换成功且仅一条 `status='0'`；失败时开关回滚为原状态，默认项仍为 `ossConfigId=1` |
| A-17 | P1 | 交付分支相对 `main` | 执行 `git diff --stat main...HEAD -- platform/ frontend/packages/` 与 `git diff --stat main...HEAD -- 'frontend/**/package.json' 'frontend/pnpm-workspace.yaml'` | 两条命令输出均为空（变更文件数 = 0）；`package.json` 依赖条目数不变 |
| A-18 | P1 | 操作日志与登录日志列表已加载；后端支持 `orderByColumn`/`isAsc` | 点击“操作人员”“操作时间”“消耗时间”“用户名称”“访问时间”表头切换排序 | 请求带 `orderByColumn` 与 `isAsc`；列表首行顺序随排序方向改变；`pageerror` 计数 = 0 |

> P0 断言 10 条，未超过模板上限；P1 断言只做组件/E2E/人工核对，不进入 P0 门禁。

## 3. 边界与异常（条数 ≥ 断言条数）

| 编号 | 场景 | 期望行为（可判定） |
|---|---|---|
| E-01 | 新增字典类型时字典名称为空或超过 100 字符 | 前端拦截，不发出 `POST /system/dict/type`；或后端 HTTP 200、`code≠200`、`msg` 非空；列表 `total` 不变 |
| E-02 | 新增字典类型时字典类型为空、超过 100 字符、以数字/大写字母开头或含非法字符 | HTTP 200、`code≠200`、`msg` 非空；字典类型未创建 |
| E-03 | 新增字典类型与已有 `dictType` 相同 | HTTP 200、`code=409`、`msg='数据库中已存在该记录，请联系管理员确认'`；列表 `total` 不变 |
| E-04 | 删除存在字典数据的字典类型 | HTTP 200、`code≠200`、`msg` 非空（后端文案含“已分配,不能删除”）；类型与数据均保留 |
| E-05 | 新增字典数据时标签或键值为空、超过 100 字符 | HTTP 200、`code≠200`、`msg` 非空；字典数据未创建 |
| E-06 | 删除多条字典数据 | HTTP 200、`code=200`；列表 `total` 减少数量等于选中条数 |
| E-07 | 使用已存在的参数键名再次新增参数 | 两次新增均 HTTP 200、`code=200`；列表 `total` 增加 2；前端不增加唯一性拦截 |
| E-08 | 删除系统内置参数 `sys.oss.previewListResource` | HTTP 200、`code≠200`、`msg` 非空（文案含“内置参数”与“不能删除”）；参数仍在列表 |
| E-09 | 参数键值超过 500 字符或参数名称为空 | HTTP 200、`code≠200`、`msg` 非空；参数未创建或未改变 |
| E-10 | 修改参数值后立即查询 `GET /system/config/configKey/{configKey}` | HTTP 200、`code=200`、`data` 等于修改后的值（缓存不返回旧值） |
| E-11 | 公告标题为空、超过 50 字符或含 `<script>` 字符 | HTTP 200、`code≠200`、`msg` 非空；公告未创建；编辑弹窗保持打开且已填内容不丢失 |
| E-12 | 公告列表筛选无匹配 | HTTP 200、`code=200`、`rows=[]`、`total=0`；页面显示空状态，不出现错误提示 |
| E-13 | 操作日志或登录日志筛选无匹配 | HTTP 200、`code=200`、`rows=[]`、`total=0`；分页器回到有效页码，不出现 `NaN` |
| E-14 | 操作日志的 `operParam` 或 `jsonResult` 不是合法 JSON | 详情弹窗按原始文本展示；`pageerror` 计数 = 0；不渲染堆栈文本 |
| E-15 | 导出接口返回 JSON 错误体（HTTP 200、`code≠200`） | 页面展示 `msg` 原文；浏览器不保存损坏文件；`pageerror` 计数 = 0 |
| E-16 | 登录日志勾选数量不等于 1 时尝试解锁 | 解锁入口不可用；不发出 `GET /monitor/logininfor/unlock/*` 请求 |
| E-17 | 解锁不存在的用户名 | HTTP 200、`code=200`；登录日志列表不变；页面提示成功或按后端返回展示 |
| E-18 | 清空操作日志或登录日志并确认 | HTTP 200、`code=200`；对应列表 `total=0`、`rows=[]` |
| E-19 | 上传空文件或上传接口返回业务失败 | 页面展示可理解错误；`total` 不增加；`pageerror` 计数 = 0 |
| E-20 | 无 `system:oss:upload` 权限的账号打开文件管理页 | “上传文件”“上传图片”按钮不渲染；直接调用上传接口返回 `code=403`、`msg='没有访问权限，请联系管理员授权'` |
| E-21 | 删除不存在的文件编号 | HTTP 200、`code≠200`、`msg` 非空；列表 `total` 不变；页面展示错误提示 |
| E-22 | 新增文件配置时 `configKey` 与已有配置重复 | HTTP 200、`code≠200`、`msg` 非空（文案含“配置key已存在”）；配置未创建；列表 `total` 不变 |
| E-23 | 删除系统内置文件配置 `ossConfigId=1` 或 `2` | HTTP 200、`code≠200`、`msg='系统内置, 不可删除!'`；配置仍在列表 |
| E-24 | 文件配置表单必填项为空或长度不在 2–100 字符 | 前端拦截，不发出新增/修改请求；已填内容不丢失 |
| E-25 | 列表页码超出总页数 | HTTP 200、`code=200`、`rows=[]`、`total` 等于筛选后的真实总数；页面回到有效页码或显示空状态，不出现 `NaN` |
| E-26 | 未携带令牌访问任一目标接口 | HTTP 401；响应体不包含业务数据；前端只跳转一次 `/auth`，`pageerror` 计数 = 0 |
| E-27 | 无对应权限码的账号调用目标写接口 | HTTP 200、`code=403`、`msg='没有访问权限，请联系管理员授权'`；业务数据不变 |
| E-28 | 无菜单权限的账号直接访问目标页面地址 | 落 403/404 页面；不渲染目标业务表格；`pageerror` 计数 = 0 |
| E-29 | 下载不存在的文件编号 | 页面展示错误提示或空结果；不保存损坏文件；`pageerror` 计数 = 0 |
| E-30 | 后端返回超过 `2^53-1` 的编号 | 前端按字符串保存与回传；编辑、删除请求中的编号与返回字符串完全一致，无精度丢失 |
| E-31 | 文件配置列表与详情渲染 | 页面文本中不出现 `secretKey` 的值；编辑表单的 `secretKey` 输入默认遮蔽 |
| E-32 | 连续点击“确定”3 次 | 只发出 1 个新增/修改请求；按钮进入加载态 |
| E-33 | 日期范围起止颠倒 | HTTP 200、`code=200`、`rows=[]`、`total=0`；页面不崩溃 |
| E-34 | 刷新字典缓存后立即读取 `GET /system/dict/data/type/{dictType}` | HTTP 200、`code=200`；返回数据与刷新前一致或包含最新字典数据；前端会话字典缓存被清除 |

## 4. 数据契约

### 4.1 共享响应封装

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `code` | number | 否 | — | `200` 成功；`401` 未认证；`403` 无权限；`409` 数据重复；`500` 业务失败 |
| `msg` | string | 否 | 失败时必有 | 人类可读文案；前端原样展示，不自行改写 |
| `rows` | array | 否 | 空数组，不为 `null` | 分页列表的数据数组 |
| `total` | number | 否 | 无数据时为 `0` | 筛选后的总条数 |
| `data` | object \| array \| string \| null | 是 | `null` 表示无数据 | 单对象、数组或字符串响应 |

- 编号类型 `Id = string \| number`：后端在 `[-(2^53-1), 2^53-1]` 内输出 number，
  超出范围输出 string；前端统一按字符串比较与回传。
- 时间字段类型 `string`，格式 `yyyy-MM-dd HH:mm:ss`，按后端字符串直接展示，不做时区换算。

### 4.2 接口与权限矩阵

| 模块 | 方法与路径 | 权限码 | 用途 |
|---|---|---|---|
| 字典类型 | `GET /system/dict/type/list` | `system:dict:list` | 分页列表 |
| 字典类型 | `POST /system/dict/type/export` | `system:dict:export` | 导出 |
| 字典类型 | `GET /system/dict/type/{dictId}` | `system:dict:query` | 详情 |
| 字典类型 | `POST /system/dict/type` | `system:dict:add` | 新增 |
| 字典类型 | `PUT /system/dict/type` | `system:dict:edit` | 修改 |
| 字典类型 | `DELETE /system/dict/type/{dictIds}` | `system:dict:remove` | 删除 |
| 字典类型 | `DELETE /system/dict/type/refreshCache` | `system:dict:remove` | 刷新字典缓存 |
| 字典类型 | `GET /system/dict/type/optionselect` | 无 | 字典类型下拉 |
| 字典数据 | `GET /system/dict/data/list` | `system:dict:list` | 分页列表 |
| 字典数据 | `POST /system/dict/data/export` | `system:dict:export` | 导出 |
| 字典数据 | `GET /system/dict/data/{dictCode}` | `system:dict:query` | 详情 |
| 字典数据 | `GET /system/dict/data/type/{dictType}` | 无 | 按类型取字典数据 |
| 字典数据 | `POST /system/dict/data` | `system:dict:add` | 新增 |
| 字典数据 | `PUT /system/dict/data` | `system:dict:edit` | 修改 |
| 字典数据 | `DELETE /system/dict/data/{dictCodes}` | `system:dict:remove` | 删除 |
| 参数 | `GET /system/config/list` | `system:config:list` | 分页列表 |
| 参数 | `POST /system/config/export` | `system:config:export` | 导出 |
| 参数 | `GET /system/config/{configId}` | `system:config:query` | 详情 |
| 参数 | `GET /system/config/configKey/{configKey}` | 无 | 按键名取值 |
| 参数 | `POST /system/config` | `system:config:add` | 新增 |
| 参数 | `PUT /system/config` | `system:config:edit` | 修改 |
| 参数 | `PUT /system/config/updateByKey` | `system:config:edit` | 按键名修改值 |
| 参数 | `DELETE /system/config/{configIds}` | `system:config:remove` | 删除 |
| 参数 | `DELETE /system/config/refreshCache` | `system:config:remove` | 刷新参数缓存 |
| 公告 | `GET /system/notice/list` | `system:notice:list` | 分页列表 |
| 公告 | `GET /system/notice/{noticeId}` | `system:notice:query` | 详情 |
| 公告 | `POST /system/notice` | `system:notice:add` | 新增 |
| 公告 | `PUT /system/notice` | `system:notice:edit` | 修改 |
| 公告 | `DELETE /system/notice/{noticeIds}` | `system:notice:remove` | 删除 |
| 操作日志 | `GET /monitor/operlog/list` | `monitor:operlog:list` | 分页列表 |
| 操作日志 | `POST /monitor/operlog/export` | `monitor:operlog:export` | 导出 |
| 操作日志 | `DELETE /monitor/operlog/{operIds}` | `monitor:operlog:remove` | 删除 |
| 操作日志 | `DELETE /monitor/operlog/clean` | `monitor:operlog:remove` | 清空 |
| 登录日志 | `GET /monitor/logininfor/list` | `monitor:logininfor:list` | 分页列表 |
| 登录日志 | `POST /monitor/logininfor/export` | `monitor:logininfor:export` | 导出 |
| 登录日志 | `DELETE /monitor/logininfor/{infoIds}` | `monitor:logininfor:remove` | 删除 |
| 登录日志 | `DELETE /monitor/logininfor/clean` | `monitor:logininfor:remove` | 清空 |
| 登录日志 | `GET /monitor/logininfor/unlock/{userName}` | `monitor:logininfor:unlock` | 解锁账号 |
| 文件 | `GET /resource/oss/list` | `system:oss:list` | 分页列表 |
| 文件 | `GET /resource/oss/listByIds/{ossIds}` | `system:oss:query` | 按编号取文件 |
| 文件 | `POST /resource/oss/upload`（multipart 字段 `file`） | `system:oss:upload` | 上传 |
| 文件 | `GET /resource/oss/download/{ossId}` | `system:oss:download` | 下载 |
| 文件 | `DELETE /resource/oss/{ossIds}` | `system:oss:remove` | 删除 |
| 文件配置 | `GET /resource/oss/config/list` | `system:ossConfig:list` | 分页列表 |
| 文件配置 | `GET /resource/oss/config/{ossConfigId}` | `system:ossConfig:list` | 详情 |
| 文件配置 | `POST /resource/oss/config` | `system:ossConfig:add` | 新增 |
| 文件配置 | `PUT /resource/oss/config` | `system:ossConfig:edit` | 修改 |
| 文件配置 | `DELETE /resource/oss/config/{ossConfigIds}` | `system:ossConfig:remove` | 删除 |
| 文件配置 | `PUT /resource/oss/config/changeStatus` | `system:ossConfig:edit` | 切换默认配置 |

- 除上述接口外，本 Packet 不调用任何新增后端端点。
- 前端按钮权限按对应接口权限码控制；预览开关的按钮权限按实际调用的
  `PUT /system/config/updateByKey` 要求，使用 `system:config:edit`（见 §7 签字确认项）。

### 4.3 字典类型（SysDictTypeVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `dictId` | `Id` | 否 | — | 字典主键 |
| `dictName` | string | 否 | — | 字典名称，≤100 |
| `dictType` | string | 否 | — | 字典类型，≤100，字母开头，仅小写字母/数字/下划线 |
| `remark` | string \| null | 是 | `null` 表示无备注 | 备注 |
| `createTime` | string \| null | 是 | `null` 表示未记录 | 创建时间 |

### 4.4 字典数据（SysDictDataVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `dictCode` | `Id` | 否 | — | 字典数据主键 |
| `dictSort` | number | 否 | 缺省为 `0` | 显示顺序，≥0 |
| `dictLabel` | string | 否 | — | 字典标签，≤100 |
| `dictValue` | string | 否 | — | 字典键值，≤100 |
| `dictType` | string | 否 | — | 所属字典类型，≤100 |
| `cssClass` | string \| null | 是 | `null` 表示无扩展样式 | 样式属性，≤100 |
| `listClass` | string \| null | 是 | `null` 等价 default | 回显样式：`default/primary/success/info/warning/danger` |
| `isDefault` | string \| null | 是 | `null` 等价 `'N'` | `'Y'` 是 / `'N'` 否；表单不编辑 |
| `remark` | string \| null | 是 | `null` 表示无备注 | 备注 |
| `createTime` | string \| null | 是 | `null` 表示未记录 | 创建时间 |

### 4.5 参数（SysConfigVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `configId` | `Id` | 否 | — | 参数主键 |
| `configName` | string | 否 | — | 参数名称，≤100 |
| `configKey` | string | 否 | — | 参数键名，≤100，允许重复 |
| `configValue` | string | 否 | — | 参数键值，≤500 |
| `configType` | string | 否 | — | `'Y'` 系统内置 / `'N'` 非内置 |
| `remark` | string \| null | 是 | `null` 表示无备注 | 备注 |
| `createTime` | string \| null | 是 | `null` 表示未记录 | 创建时间 |

### 4.6 公告（SysNoticeVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `noticeId` | `Id` | 否 | — | 公告主键 |
| `noticeTitle` | string | 否 | — | 公告标题，≤50，不含脚本字符 |
| `noticeType` | string | 否 | — | `'1'` 通知 / `'2'` 公告（以 `sys_notice_type` 字典为准） |
| `noticeContent` | string \| null | 是 | `null` 表示无内容 | 富文本 HTML |
| `status` | string | 否 | — | `'0'` 正常 / `'1'` 关闭（以 `sys_notice_status` 字典为准） |
| `remark` | string \| null | 是 | `null` 表示无备注 | 备注；列表与表单不展示 |
| `createBy` | `Id \| null` | 是 | `null` 表示未记录 | 创建者编号 |
| `createByName` | string \| null | 是 | `null` 表示未填充 | 创建者用户名；筛选“操作人员”时按用户名精确匹配后转为 `createBy` |
| `createTime` | string \| null | 是 | `null` 表示未记录 | 创建时间 |

### 4.7 操作日志（SysOperLogVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `operId` | `Id` | 否 | — | 日志主键 |
| `tenantId` | string \| null | 是 | `null` 表示未记录 | 租户编号；前端不展示 |
| `title` | string \| null | 是 | `null` 表示无模块名 | 系统模块 |
| `businessType` | number \| null | 是 | `null` 表示未知类型 | 业务类型，取值以 `sys_oper_type` 字典为准 |
| `businessTypes` | number[] \| null | 是 | 缺省等价 `[]` | 业务类型多选筛选参数 |
| `method` | string \| null | 是 | `null` 表示未记录 | 方法名称 |
| `requestMethod` | string \| null | 是 | `null` 表示未记录 | 请求方式 |
| `operatorType` | number \| null | 是 | `null` 表示未知 | 操作类别 |
| `operName` | string \| null | 是 | `null` 表示未记录 | 操作人员 |
| `deptName` | string \| null | 是 | `null` 表示未填充 | 部门名称 |
| `operUrl` | string \| null | 是 | `null` 表示未记录 | 请求地址 |
| `operIp` | string \| null | 是 | `null` 表示未记录 | 操作地址 |
| `operLocation` | string \| null | 是 | `null` 表示未解析 | 操作地点 |
| `operParam` | string \| null | 是 | `null` 表示无参数 | 请求参数原文，可能是合法 JSON 或普通文本 |
| `jsonResult` | string \| null | 是 | `null` 表示无返回 | 返回参数原文，可能是合法 JSON 或普通文本 |
| `status` | number \| null | 是 | `null` 表示未知 | `0` 正常 / `1` 异常 |
| `errorMsg` | string \| null | 是 | `null` 表示无异常 | 异常信息 |
| `operTime` | string \| null | 是 | `null` 表示未记录 | 操作时间 |
| `costTime` | number \| null | 是 | `null` 表示未记录 | 消耗时间，单位毫秒 |

### 4.8 登录日志（SysLogininforVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `infoId` | `Id` | 否 | — | 日志主键 |
| `tenantId` | string \| null | 是 | `null` 表示未记录 | 租户编号；前端不展示 |
| `userName` | string \| null | 是 | `null` 表示未记录 | 用户名称 |
| `clientKey` | string \| null | 是 | `null` 表示未记录 | 客户端 key |
| `deviceType` | string \| null | 是 | `null` 表示未记录 | 设备类型，取值以 `sys_device_type` 字典为准 |
| `status` | string | 否 | — | `'0'` 成功 / `'1'` 失败（以 `sys_common_status` 字典为准） |
| `ipaddr` | string \| null | 是 | `null` 表示未记录 | 登录地址 |
| `loginLocation` | string \| null | 是 | `null` 表示未解析 | 登录地点 |
| `browser` | string \| null | 是 | `null` 表示未记录 | 浏览器 |
| `os` | string \| null | 是 | `null` 表示未记录 | 操作系统 |
| `msg` | string \| null | 是 | `null` 表示无提示 | 提示消息 |
| `loginTime` | string \| null | 是 | `null` 表示未记录 | 访问时间 |

### 4.9 文件（SysOssVo）与上传响应（SysOssUploadVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `ossId` | `Id` | 否 | — | 文件主键 |
| `fileName` | string | 否 | — | 存储文件名 |
| `originalName` | string \| null | 是 | `null` 表示未记录 | 上传时的原始文件名 |
| `fileSuffix` | string \| null | 是 | `null` 表示无后缀 | 文件后缀，带点或不带点均按后端原值展示 |
| `url` | string | 否 | — | 访问地址 |
| `ext1` | string \| null | 是 | `null` 表示无扩展 | 扩展字段；前端不展示 |
| `createTime` | string \| null | 是 | `null` 表示未记录 | 创建时间 |
| `createBy` | `Id \| null` | 是 | `null` 表示未记录 | 上传人编号 |
| `createByName` | string \| null | 是 | `null` 表示未填充 | 上传人用户名 |
| `service` | string \| null | 是 | `null` 表示未记录 | 服务商 |
| `url`（上传响应） | string | 否 | — | 上传后的访问地址 |
| `fileName`（上传响应） | string | 否 | — | 上传后的存储文件名 |
| `ossId`（上传响应） | `Id` | 否 | — | 新建文件编号，字符串或数字 |

### 4.10 文件配置（SysOssConfigVo）

| 字段 | 类型 | 可空 | 空值语义 | 说明 |
|---|---|---|---|---|
| `ossConfigId` | `Id` | 否 | — | 配置主键 |
| `configKey` | string | 否 | — | 配置 key，2–100，唯一 |
| `accessKey` | string | 否 | — | 访问密钥，2–100 |
| `secretKey` | string | 否 | — | 私有密钥，2–100；列表不展示，表单单选框遮蔽 |
| `bucketName` | string | 否 | — | 桶名称，2–100 |
| `prefix` | string \| null | 是 | `null` 等价空字符串 | 前缀 |
| `endpoint` | string | 否 | — | 访问站点，2–100 |
| `domain` | string \| null | 是 | `null` 等价空字符串 | 自定义域名 |
| `isHttps` | string | 否 | — | `'Y'` 是 / `'N'` 否 |
| `region` | string \| null | 是 | `null` 等价空字符串 | 域 |
| `status` | string | 否 | — | `'0'` 默认（是）/ `'1'` 非默认（否） |
| `ext1` | string \| null | 是 | `null` 等价空字符串 | 扩展字段；前端不展示 |
| `remark` | string \| null | 是 | `null` 表示无备注 | 备注 |
| `accessPolicy` | string | 否 | — | `'0'` private / `'1'` public / `'2'` custom |

### 4.11 列表查询参数

| 接口 | 参数 | 类型 | 语义 |
|---|---|---|---|
| 全部列表 | `pageNum` | number | 页码，默认 1 |
| 全部列表 | `pageSize` | number | 每页条数，默认 10 |
| 字典类型列表 | `dictName` | string | 模糊匹配字典名称 |
| 字典类型列表 | `dictType` | string | 模糊匹配字典类型 |
| 字典类型列表 | `params[beginTime]` / `params[endTime]` | string | `createTime` 范围 |
| 字典数据列表 | `dictSort` | number | 精确匹配排序值 |
| 字典数据列表 | `dictLabel` | string | 模糊匹配标签 |
| 字典数据列表 | `dictType` | string | 精确匹配类型 |
| 参数列表 | `configName` | string | 模糊匹配参数名称 |
| 参数列表 | `configType` | string | 精确匹配 `Y`/`N` |
| 参数列表 | `configKey` | string | 模糊匹配参数键名 |
| 参数列表 | `params[beginTime]` / `params[endTime]` | string | `createTime` 范围 |
| 公告列表 | `noticeTitle` | string | 模糊匹配标题 |
| 公告列表 | `noticeType` | string | 精确匹配类型 |
| 公告列表 | `createByName` | string | 按用户名查 `createBy` 后精确匹配创建者 |
| 操作日志列表 | `operIp` | string | 模糊匹配地址 |
| 操作日志列表 | `title` | string | 模糊匹配模块 |
| 操作日志列表 | `operName` | string | 模糊匹配操作人员 |
| 操作日志列表 | `businessType` 或 `businessTypes` | number / number[] | 精确匹配业务类型 |
| 操作日志列表 | `status` | number | 精确匹配状态 |
| 操作日志列表 | `params[beginTime]` / `params[endTime]` | string | `operTime` 范围 |
| 登录日志列表 | `ipaddr` | string | 模糊匹配地址 |
| 登录日志列表 | `userName` | string | 模糊匹配用户名称 |
| 登录日志列表 | `status` | string | 精确匹配状态 |
| 登录日志列表 | `params[beginTime]` / `params[endTime]` | string | `loginTime` 范围 |
| 文件列表 | `fileName` | string | 模糊匹配存储文件名 |
| 文件列表 | `originalName` | string | 模糊匹配原始文件名 |
| 文件列表 | `fileSuffix` | string | 精确匹配后缀 |
| 文件列表 | `url` | string | 精确匹配地址 |
| 文件列表 | `service` | string | 精确匹配服务商 |
| 文件列表 | `createBy` | `Id` | 精确匹配上传人 |
| 文件列表 | `params[beginCreateTime]` / `params[endCreateTime]` | string | `createTime` 范围 |
| 文件配置列表 | `configKey` | string | 精确匹配配置 key |
| 文件配置列表 | `bucketName` | string | 模糊匹配桶名称 |
| 文件配置列表 | `status` | string | 精确匹配 `0`/`1` |
| 全部列表 | `orderByColumn` / `isAsc` | string | 排序字段与方向，后端支持时生效 |

- 公告列表不支持的筛选：`status`、`params[beginTime]`、`params[endTime]`；前端不渲染这些筛选控件。
- 日期范围控件绑定 `params` 对象，不把 `beginTime`/`endTime` 平铺到查询根对象。

### 4.12 表单校验约束（前端与后端双重校验）

| 表单 | 字段 | 约束 |
|---|---|---|
| 字典类型表单 | `dictName` | 必填，≤100 字符 |
| 字典类型表单 | `dictType` | 必填，≤100 字符，匹配 `^[a-z][a-z0-9_]*$` |
| 字典类型表单 | `remark` | 可选 |
| 字典数据表单 | `dictLabel` | 必填，≤100 字符 |
| 字典数据表单 | `dictValue` | 必填，≤100 字符；同一类型下允许重复 |
| 字典数据表单 | `dictType` | 只读继承当前选中类型，必填 |
| 字典数据表单 | `dictSort` | 整数，≥0 |
| 字典数据表单 | `cssClass` | 可选，≤100 字符 |
| 字典数据表单 | `listClass` | 可选，取值 `default/primary/success/info/warning/danger` |
| 字典数据表单 | `remark` | 可选 |
| 参数表单 | `configName` | 必填，≤100 字符 |
| 参数表单 | `configKey` | 必填，≤100 字符；允许重复 |
| 参数表单 | `configValue` | 必填，≤500 字符 |
| 参数表单 | `configType` | 取值 `'Y'`/`'N'`，默认 `'Y'` |
| 参数表单 | `remark` | 可选 |
| 公告表单 | `noticeTitle` | 必填，≤50 字符，不含脚本字符 |
| 公告表单 | `noticeType` | 必填，取值 `'1'`/`'2'` |
| 公告表单 | `status` | 取值 `'0'`/`'1'` |
| 公告表单 | `noticeContent` | 可选；通过编辑器输出 HTML |
| 文件配置表单 | `configKey` | 必填，2–100 字符，唯一 |
| 文件配置表单 | `accessKey` | 必填，2–100 字符 |
| 文件配置表单 | `secretKey` | 必填，2–100 字符；输入遮蔽 |
| 文件配置表单 | `bucketName` | 必填，2–100 字符 |
| 文件配置表单 | `endpoint` | 必填，2–100 字符；表单展示 `http://` 或 `https://` 协议前缀 |
| 文件配置表单 | `accessPolicy` | 必填，取值 `'0'`/`'1'`/`'2'` |
| 文件配置表单 | `isHttps` | 取值 `'Y'`/`'N'`，默认 `'N'` |
| 文件配置表单 | `prefix`、`domain`、`region`、`remark` | 可选 |
| 文件配置表单 | `status` | 新增默认 `'1'`（非默认） |

## 5. 非功能约束

- **性能口径（上线回顾指标，不计入 DoD）**：本地 Docker 栈 + Edge 最新版下，8 个页面列表
  接口 P95 ≤ 2s；页面路由切换 ≤ 500ms（不含接口耗时）；导出请求发起后 2s 内开始返回响应体。
  交付阶段不压测，交付后 30 天回顾抽样核对；未达标登记为改进项，不阻断本次验收。
- **安全（鉴权 / 脱敏）**：全部请求携带 `Authorization: Bearer <token>` 与 `clientid`；
  按钮权限按 §4.2 权限码控制；`secretKey` 只在编辑表单内以遮蔽输入出现，列表、详情、日志、
  控制台与 trace 中不得出现明文；令牌、验证码、`secretKey` 不得写入日志或报告。
- **富文本安全**：公告内容只通过 tiptap 编辑器（ProseMirror）解析与回显，不使用未经净化的
  `v-html` 直接渲染公告正文；历史 `ql-*` 类在进入编辑器前归一化为编辑器可识别的样式，
  不新增消毒依赖。
- **合规（留痕 / 审计）**：写操作由后端 `@Log` 记录，前端不重复上报敏感内容；导出文件由后端
  生成，前端不重新拼装列。
- **可观测（必须输出）**：请求失败时展示后端 `msg`；页面不得吞异常；`console.error` 只允许输出
  脱敏后的接口路径与错误码，不得输出请求体中的密码、令牌或 `secretKey`。
- **兼容性**：桌面端现代浏览器；不做移动端/响应式专项适配；不新增语言包；不修改全局主题。

## 6. 状态流转

| 实体 | 状态 | 合法迁移 | 非法迁移与拒绝 |
|---|---|---|---|
| 公告 | `'0'` 正常 ↔ `'1'` 关闭 | 任意方向可转 | 无额外后端拒绝 |
| 参数 | `configType='Y'` 内置 / `'N'` 非内置 | 新增时选定；编辑时保留原值 | 内置参数删除 → `code≠200` |
| 字典类型 | 存在 / 删除 | 无字典数据引用时可删除 | 存在字典数据 → `code≠200`；重复类型 → `code=409` |
| 文件配置 | `status='0'` 默认 ↔ `'1'` 非默认 | 仅允许一条为默认；切换时其余行置 `'1'` | 内置配置删除 → `code≠200`；重复 key → `code≠200` |
| 文件配置 | `accessPolicy='0'/'1'/'2'` | 新增或编辑时选定 | 无额外后端拒绝 |
| 登录账号锁定 | 锁定 / 解锁 | 执行解锁后清除失败计数 | 勾选数量不等于 1 时不发起解锁 |

## 7. Non-goals（必填）

- **本期不做**：
  - 客户端管理（`system/client`）、租户、租户套餐（`system/tenant`、`system/tenantPackage`）；
    用户、角色、菜单、部门、岗位（已由 `REQ-20261103-002` / `REQ-20261104-003` 交付）。
  - 监控（在线用户、缓存监控）、代码生成、演示页面、工作流与任务、个人中心、修改密码、头像上传。
  - 修改 `platform/` 任何文件，包括接口、字段、错误码、权限码、SQL 与配置。
  - 新增前端依赖；新增全局 vxe renderer；修改 `packages/**` 上游实现。
  - 移动端/响应式专项适配、新增语言包、视觉重设计、plus-ui SVG 图标资产搬迁。
  - 公告的阅读状态、消息中心、SSE 推送处理、未读计数；公告详情独立页。
  - 公告按状态或时间范围筛选（后端不支持）；参数键名与字典数据键值的唯一性校验（后端不提供）。
  - 文件上传的大小/类型策略改造；重新定义导出列或文件格式；导出列以后端既有实现为准。
  - 改变后端权限判定规则；前端只消费 `permissions` 与 `roles`。
  - 字典拖拽排序、批量导入、字典数据独立页之外的新增入口。
- **不兼容**：
  - 不保证与 plus-ui 的 DOM 结构或 CSS 类名一致；只保证用户可见行为与数据契约一致。
  - 不保证后端拒绝文案逐字一致，除本 Packet 明确写出的 `msg` 原文外。
  - 不保证超出 JS 安全整数范围的 ID 以 number 形式出现；前端统一兼容 number/string。
  - 不保证新 tiptap 编辑器产出的 HTML 与 plus-ui quill 逐字节一致；只保证正文文本与对齐/字号效果。
- **签字确认项（签字即确认以下默认处置）**：
  1. 文件管理页“预览开关”按钮使用 `system:config:edit`。plus-ui 基线使用
     `system:oss:edit`，但基线权限表中不存在该权限码，且实际调用的
     `PUT /system/config/updateByKey` 校验 `system:config:edit`；不修改 `platform/`。
  2. 隐藏字典数据页 `/system/dict-data/index/:dictId` 按用户 2026-11-07 的选择实现为独立页；
     plus-ui 基线为双栏单页，隐藏菜单在原基线中无对应组件。
  3. 参数键名允许重复、字典数据键值允许重复，与后端既有行为一致；前端不新增唯一性校验。
  4. 公告列表不提供状态与时间范围筛选，与后端查询条件一致。
  5. `client/*`、`tenant/*`、`tenantPackage` 不在本 Packet；CLAR-011 的 tenant 冲突
     留待后续 REQ 单独裁决。

## 8. Golden Samples（3 正例 + 1 反例）

| 类型 | 输入 | 期望输出 |
|---|---|---|
| 正例 | `POST /system/dict/data`：`{dictType:"spec004_dict_type", dictLabel:"Spec004 标签三", dictValue:"spec004_value_c", dictSort:3, listClass:"primary"}` | `code=200`；`GET /system/dict/data/list?dictType=spec004_dict_type&dictLabel=Spec004 标签三` 返回 `total=1`，行含上述标签与键值 |
| 正例 | `PUT /system/config/updateByKey`：`{configKey:"spec004.config.key", configValue:"spec004-value-b"}`，随后 `GET /system/config/configKey/spec004.config.key` | 修改与查询均 `code=200`；查询 `data='spec004-value-b'` |
| 正例 | `PUT /resource/oss/config/changeStatus`：`{ossConfigId:<spec004_oss_config id>, configKey:"spec004_oss_config", status:"0"}`，随后 `GET /resource/oss/config/list?status=0` | 修改 `code=200`；列表 `total=1`，唯一默认行的 `configKey='spec004_oss_config'`；结束时恢复 `ossConfigId=1` 为默认 |
| **反例** | `DELETE /system/dict/type/{spec004_dict_type 的 dictId}`（该类型下存在字典数据） | **HTTP 200、body `code≠200`、`msg` 非空（含“已分配,不能删除”）；字典类型与字典数据均保留** |

## 9. 变更与签字

| 版本 | 变更 | 日期 | 签字人 |
|---|---|---|---|
| 1.0 | 初版：由 `specs/003-system-auxiliary/spec.md` 断言化生成；覆盖 8 个视图；数据契约与后端控制器/BO/VO 逐项核对；补齐 E-01～E-34 与 Non-goals | 2026-11-07 | PM：aoyousky（2026-11-07）；业务：Jim Liu（2026-11-07，确认 §7 五项）；架构：Jiankui Zhang（2026-11-07，L2） |

> 本 Packet 已于 2026-11-07 完成签字；签字确认项 5 条已确认。签字后如需变更断言，按版本升版并重新签字。

### FR → A-xx 映射

| 原条目 | 断言 | 状态 |
|---|---|---|
| FR-001 8 个视图与占位页替换 | A-02、A-10 | 已映射 |
| FR-002 分页/筛选/三态 | A-01、A-03、A-04、A-05、A-06、A-07、A-08、A-14、E-25 | 已映射 |
| FR-003 权限码控制入口与按钮 | A-09、A-12、E-20、E-26、E-27、E-28 | 已映射 |
| FR-004 成功提示/失败展示 msg | A-01～A-08、E-07、E-15 | 已映射 |
| FR-005 敏感操作二次确认 | A-13 | 已映射（P1 交互） |
| FR-006 ID/时间字符串契约 | §4.1、E-30 | 已映射 |
| FR-007 不吞异常、无堆栈文本 | A-14、E-14、E-26 | 已映射 |
| FR-008 字典双栏联动 | A-01 | 已映射 |
| FR-009 字典类型筛选与列 | A-01 | 已映射 |
| FR-010 字典类型 CRUD/导出/刷新 | A-01、E-03、E-04、E-34 | 已映射 |
| FR-011 字典类型表单校验 | E-01、E-02、E-03 | 已映射 |
| FR-012 字典数据筛选与 CRUD | A-01、A-02、E-05、E-06 | 已映射 |
| FR-013 字典数据表单校验 | E-05、§4.12 | 已映射 |
| FR-014 字典类型删除保护/缓存清理 | A-01、E-04、E-34 | 已映射 |
| FR-015 隐藏字典数据页 | A-02、A-10 | 已映射 |
| FR-016 参数筛选与列 | A-03 | 已映射 |
| FR-017 参数 CRUD/导出/刷新 | A-03、E-08、E-10 | 已映射 |
| FR-018 参数表单校验/无唯一性校验 | E-07、E-09、§4.12 | 已映射 |
| FR-019 内置参数删除保护/刷新 | A-03、E-08 | 已映射 |
| FR-020 公告筛选与列 | A-04、E-12 | 已映射 |
| FR-021 公告 CRUD/类型/状态 | A-04、E-11 | 已映射 |
| FR-022 公告表单与富文本 | A-04、A-11、E-11 | 已映射 |
| FR-023 历史 ql-* 兼容与注入防护 | A-11、§5 | 已映射 |
| FR-024 操作日志筛选与列 | A-05、E-13 | 已映射 |
| FR-025 操作日志排序 | A-18 | 已映射（P1） |
| FR-026 操作日志详情/删除/清空/导出 | A-05、E-14、E-15、E-18 | 已映射 |
| FR-027 参数 JSON/原文展示 | A-05、E-14 | 已映射 |
| FR-028 登录日志筛选与列 | A-06、E-13 | 已映射 |
| FR-029 登录日志排序 | A-18 | 已映射（P1） |
| FR-030 登录日志删除/清空/导出/解锁单选 | A-06、A-15、E-16、E-18 | 已映射 |
| FR-031 解锁语义 | A-06、E-17 | 已映射 |
| FR-032 文件筛选与列 | A-07 | 已映射 |
| FR-033 上传/下载/删除 | A-07、E-19、E-20、E-21、E-29 | 已映射 |
| FR-034 图片预览条件 | A-12 | 已映射（P1） |
| FR-035 预览开关写入 | A-12 | 已映射（P1） |
| FR-036 配置管理入口 | A-08、A-10 | 已映射 |
| FR-037 下载错误处理 | E-29 | 已映射 |
| FR-038 文件配置筛选与列 | A-08 | 已映射 |
| FR-039 文件配置 CRUD/默认切换 | A-08、A-16、E-22 | 已映射 |
| FR-040 文件配置表单/密钥遮蔽 | E-24、E-31、§4.12 | 已映射 |
| FR-041 默认配置唯一/失败回滚 | A-08、A-16 | 已映射 |
| FR-042 内置文件配置删除保护 | A-08、E-23 | 已映射 |
| FR-043 后端零改动 | A-17 | 已映射（P1，shell 检查） |
| FR-044 依赖与 packages 零改动 | A-17 | 已映射（P1，shell 检查） |
| FR-045 大整数 ID 兼容 | E-30 | 已映射 |

### UNVERIFIABLE 清单

本 Packet 无无法判定的行为断言。以下为不进入 P0 门禁的核对项：

| 条目 | 原因 | 建议核对方式 |
|---|---|---|
| 导出文件列顺序 | `spec.md` 只约定列集合，未约定顺序 | 断言列集合包含约定字段；顺序以后端导出文件为准 |
| 二次确认文案 | 无既有页面文案基线 | 只断言“确认后才发起请求”的行为，不比对文案 |
| tiptap 产出 HTML 与 quill 的差异 | 两个编辑器序列化方式不同 | 只断言正文文本与对齐/字号效果，不比对 HTML 字符串 |
| 性能 P95 | 交付阶段不做压测 | 上线后 30 天回顾抽样核对 |

### 后端事实（实现时不得违背）

1. **字典类型重复**：数据库唯一约束 `(tenant_id, dict_type)`；重复时全局处理器返回
   HTTP 200、`code=409`、`msg='数据库中已存在该记录，请联系管理员确认'`。
2. **参数键名与字典数据键值**：后端无唯一约束、无服务端唯一性校验；前端不得自行拒绝重复值。
3. **字典类型删除**：存在字典数据时抛出业务异常，`code≠200`；错误文案含“已分配,不能删除”。
4. **内置参数删除**：`configType='Y'` 的参数删除被拒绝，文案含“内置参数”与“不能删除”。
5. **文件配置删除**：`ossConfigId` 属于内置集合时抛出 `系统内置, 不可删除!`。
6. **文件配置默认切换**：`changeStatus` 先把全部配置置为 `'1'`，再更新目标行为 `'0'`，
   并写入 Redis 默认配置 key；成功后同一时间仅一条默认。
7. **登录解锁**：`GET /monitor/logininfor/unlock/{userName}` 对任意用户名均返回 `code=200`；
   仅当 Redis 中存在该用户失败计数时删除计数；不解锁不存在的账号也不报错。
8. **公告查询**：只支持 `noticeTitle` 模糊、`noticeType` 精确、`createByName` 转 `createBy`；
   不支持 `status` 与时间范围。
9. **操作日志无详情端点**：详情数据来自列表行；`operParam`、`jsonResult` 为字符串原文。
10. **OSS 列表日期参数**：使用 `params[beginCreateTime]` / `params[endCreateTime]`；
    其余列表日期参数使用 `params[beginTime]` / `params[endTime]`。
11. **文件上传**：`POST /resource/oss/upload` 使用 multipart 字段 `file`，返回
    `{url, fileName, ossId}`；上传失败时列表不增加记录。
12. **预览开关**：读取 `sys.oss.previewListResource` 使用无权限的
    `GET /system/config/configKey/{configKey}`；写入使用 `PUT /system/config/updateByKey`，
    需要 `system:config:edit`。
13. **文件下载**：`GET /resource/oss/download/{ossId}` 返回二进制附件；失败时返回错误结构。
14. **菜单地址**：隐藏字典数据页为 `/system/dict-data/index/:dictId`，隐藏文件配置页为
    `/system/oss-config/index`（由 `getRouters` 的 `path` 与父路径拼接）。

### 新增的 E-xx（由断言化补出）

E-01～E-06 字典边界、E-07 参数重复键、E-09 参数长度、E-10 缓存一致性、E-12 公告空列表、
E-15 导出错误体、E-16/E-17 解锁边界、E-19/E-20/E-21 上传与删除边界、E-25 分页越界、
E-26/E-27/E-28 鉴权与越权、E-29 下载不存在、E-30 大整数、E-31 密钥遮蔽、E-32 重复提交、
E-33 日期颠倒、E-34 字典缓存刷新，为 `spec.md` 未逐条覆盖、断言化时补出的边界。

### 新增的 Non-goals（由断言化补出）

- 不保证 DOM/CSS 与 plus-ui 一致。
- 不保证除本 Packet 明确写出的 `msg` 外的拒绝文案逐字一致。
- 不保证大整数 ID 以 number 出现。
- 不重新定义导出列与文件格式。
- 不做公告阅读状态、消息中心与 SSE 处理。
- 不做参数/字典数据唯一性校验。
- 不做客户端、租户与租户套餐。
</content>
</write_file>
