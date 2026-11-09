# Data Model: 系统管理辅助模块

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Source of truth**: `specs/SPEC-004-system-auxiliary.md` §4.1–§4.12、§6（签字版）
**Constraint**: 本文件只做前端消费侧建模，不修改后端契约；字段名、类型、可空性、空值语义与
Packet §4 逐字一致。类型别名以 `frontend/apps/web-antdv-next/src/utils/system/id.ts` 的
`Id = string | number` 为准。

## 1. 共享类型

```ts
type Id = string | number;
type StatusString = '0' | '1';
type ConfigType = 'Y' | 'N';
type NoticeType = '1' | '2';
type YesNo = 'Y' | 'N';
type AccessPolicy = '0' | '1' | '2';
type ListClass = 'default' | 'primary' | 'success' | 'info' | 'warning' | 'danger';

interface PageResult<T> {
  rows: T[];   // 空列表为空数组，不为 null
  total: number; // 无数据为 0
}

interface PageQuery {
  pageNum: number; // 默认 1
  pageSize: number; // 默认 10
  orderByColumn?: string;
  isAsc?: string; // 'asc' | 'desc'
  params?: Record<string, unknown>; // 日期范围放这里
}
```

**共享标量规则**（Packet §4.1）：
- `Id`：`[-(2^53-1), 2^53-1]` 内为 number，超出为 string；前端一律用 `toIdKey()` 比较，
  请求路径拼接用 `normalizeIds()`，不 `Number()` 转换。
- 时间：`string`，格式 `yyyy-MM-dd HH:mm:ss`；直接展示，不解析时区、不改格式。
- 金额/大小：本特性无金额；`costTime` 单位为毫秒，直接展示数值。
- 布尔：后端以 `'Y'/'N'` 字符串表达；前端不转 boolean 存储，提交时原样回传。

## 2. 实体总览

| 实体 | 类型名 | 来源接口 | 主要页面 | 关系 |
|---|---|---|---|---|
| 字典类型 | `DictType` | `GET /system/dict/type/list` | 字典管理 | 1 个类型对应 N 条字典数据（按 `dictType` 字符串关联，非 ID） |
| 字典数据 | `DictData` | `GET /system/dict/data/list`、`GET /system/dict/data/type/{dictType}` | 字典管理、隐藏字典数据页 | N 条数据归属 1 个类型；`dictType` 是关联键 |
| 参数 | `Config` | `GET /system/config/list` | 参数设置 | 独立；`configKey` 允许重复 |
| 公告 | `Notice` | `GET /system/notice/list` | 通知公告 | `createBy` 指向用户；列表通过 `createByName` 辅助显示 |
| 操作日志 | `OperLog` | `GET /monitor/operlog/list` | 操作日志 | 独立审计记录；`tenantId` 不展示 |
| 登录日志 | `Logininfor` | `GET /monitor/logininfor/list` | 登录日志 | 独立审计记录；`tenantId` 不展示 |
| 文件 | `Oss` | `GET /resource/oss/list` | 文件管理 | `createBy` 指向用户；`ossId` 是下载/删除键 |
| 上传响应 | `OssUpload` | `POST /resource/oss/upload` | 文件管理 | 上传成功后返回，用于刷新列表 |
| 文件配置 | `OssConfig` | `GET /resource/oss/config/list` | 隐藏文件配置页 | 全局至多 1 条 `status='0'`；`secretKey` 只进表单 |

**字典双栏关系**：`DictType` 是父；`DictData` 通过 `dictType` 关联，不是 `dictId`。
隐藏字典数据页 URL 携带 `:dictId`，进入后先 `GET /system/dict/type/{dictId}` 取回
`dictType`，再按 `dictType` 查数据（见 §4.9 派生模型）。

## 3. 字典类型 `DictType`（Packet §4.3）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `dictId` | `Id` | 否 | — | 表格 key、详情、删除路径 |
| `dictName` | string | 否 | — | 列显示；表单必填 ≤100 |
| `dictType` | string | 否 | — | 列显示；表单必填 ≤100，`^[a-z][a-z0-9_]*$` |
| `remark` | string \| null | 是 | `null` 无备注 | 列/表单；空提交为 `null` |
| `createTime` | string \| null | 是 | `null` 未记录 | 列显示；`null` 显示 `-` |

**派生 UI 字段**（不入契约）：`dictDataCount` 不请求后端，不使用（Packet 未定义该端点）。

## 4. 字典数据 `DictData`（Packet §4.4）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `dictCode` | `Id` | 否 | — | 表格 key、详情、删除路径 |
| `dictSort` | number | 否 | 缺省 `0` | 列/表单；整数 ≥0 |
| `dictLabel` | string | 否 | — | 列显示；表单必填 ≤100 |
| `dictValue` | string | 否 | — | 列显示；表单必填 ≤100；同类型允许重复 |
| `dictType` | string | 否 | — | 列表筛选精确匹配；表单只读继承 |
| `cssClass` | string \| null | 是 | `null` 无扩展样式 | 表单可选 ≤100 |
| `listClass` | string \| null | 是 | `null` 等价 `default` | 回显样式 Tag；表单可选枚举 |
| `isDefault` | string \| null | 是 | `null` 等价 `'N'` | 列表展示；表单不编辑 |
| `remark` | string \| null | 是 | `null` 无备注 | 表单可选 |
| `createTime` | string \| null | 是 | `null` 未记录 | 列显示 |

**显示规则**：`listClass` 映射 `Tag` 颜色；未知值按 `default` 渲染，不回写。
**表单模型** `DictDataForm = Pick<DictData, 'dictCode'?, 'dictType', 'dictLabel', 'dictValue',
'dictSort', 'cssClass', 'listClass', 'remark'>`；`isDefault` 不提交（Packet §4.4 说明）。

## 5. 参数 `Config`（Packet §4.5）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `configId` | `Id` | 否 | — | 表格 key、详情、删除路径 |
| `configName` | string | 否 | — | 列；表单必填 ≤100 |
| `configKey` | string | 否 | — | 列；表单必填 ≤100；允许重复，不做唯一性校验 |
| `configValue` | string | 否 | — | 列；表单必填 ≤500 |
| `configType` | string | 否 | — | `'Y'/'N'`；列显示“系统内置/否”；编辑保留原值 |
| `remark` | string \| null | 是 | `null` 无备注 | 表单可选 |
| `createTime` | string \| null | 是 | `null` 未记录 | 列显示 |

**按键更新模型** `ConfigKeyUpdate = { configKey: string; configValue: string }`，用于
`PUT /system/config/updateByKey`（OSS 预览开关也走此接口，见 §4.9）。

## 6. 公告 `Notice`（Packet §4.6）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `noticeId` | `Id` | 否 | — | 表格 key、详情、删除路径 |
| `noticeTitle` | string | 否 | — | 列；表单必填 ≤50，不含 `<`/`>` |
| `noticeType` | string | 否 | — | `'1'` 通知 / `'2'` 公告；列用 `sys_notice_type` 字典 |
| `noticeContent` | string \| null | 是 | `null` 无内容 | 富文本 HTML；只进 tiptap，不进 `v-html` |
| `status` | string | 否 | — | `'0'` 正常 / `'1'` 关闭；列用 `sys_notice_status` 字典 |
| `remark` | string \| null | 是 | `null` 无备注 | 列表与表单不展示（Packet §4.6） |
| `createBy` | `Id \| null` | 是 | `null` 未记录 | 不直接展示；筛选按用户名转 `createBy` |
| `createByName` | string \| null | 是 | `null` 未填充 | 列“创建者”；筛选输入用户名 |
| `createTime` | string \| null | 是 | `null` 未记录 | 列显示 |

**筛选模型** `NoticeQuery = { pageNum, pageSize, noticeTitle?, noticeType?, createByName? }`；
不含 `status` 与时间范围（Packet §4.11、§7.4）。

## 7. 操作日志 `OperLog`（Packet §4.7）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `operId` | `Id` | 否 | — | 表格 key、删除 |
| `tenantId` | string \| null | 是 | `null` 未记录 | 不展示 |
| `title` | string \| null | 是 | `null` 无模块名 | 列；筛选模糊 |
| `businessType` | number \| null | 是 | `null` 未知 | 列用 `sys_oper_type` 字典 |
| `businessTypes` | number[] \| null | 是 | 缺省 `[]` | 筛选多选；仅此筛选参数 |
| `method` | string \| null | 是 | `null` 未记录 | 详情 |
| `requestMethod` | string \| null | 是 | `null` 未记录 | 列/详情 |
| `operatorType` | number \| null | 是 | `null` 未知 | 详情，按 `sys_operator_type` 字典 |
| `operName` | string \| null | 是 | `null` 未记录 | 列；筛选模糊 |
| `deptName` | string \| null | 是 | `null` 未填充 | 列/详情 |
| `operUrl` | string \| null | 是 | `null` 未记录 | 详情 |
| `operIp` | string \| null | 是 | `null` 未记录 | 列；筛选模糊 |
| `operLocation` | string \| null | 是 | `null` 未解析 | 列/详情 |
| `operParam` | string \| null | 是 | `null` 无参数 | 详情；JSON 解析成功则格式化，否则原文 |
| `jsonResult` | string \| null | 是 | `null` 无返回 | 详情；同上 |
| `status` | number \| null | 是 | `null` 未知 | 列：`0` 正常 / `1` 异常；筛选精确 |
| `errorMsg` | string \| null | 是 | `null` 无异常 | 详情 |
| `operTime` | string \| null | 是 | `null` 未记录 | 列；时间范围筛选 |
| `costTime` | number \| null | 是 | `null` 未记录 | 列，毫秒 |

**筛选模型** `OperLogQuery = { pageNum, pageSize, operIp?, title?, operName?,
businessTypes?: number[], status?: number, params?: { beginTime?, endTime? },
orderByColumn?, isAsc? }`。

## 8. 登录日志 `Logininfor`（Packet §4.8）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `infoId` | `Id` | 否 | — | 表格 key、删除 |
| `tenantId` | string \| null | 是 | `null` 未记录 | 不展示 |
| `userName` | string \| null | 是 | `null` 未记录 | 列；筛选模糊 |
| `clientKey` | string \| null | 是 | `null` 未记录 | 列，展示为客户端 |
| `deviceType` | string \| null | 是 | `null` 未记录 | 列，用 `sys_device_type` 字典 |
| `status` | string | 否 | — | `'0'` 成功 / `'1'` 失败；列用 `sys_common_status` |
| `ipaddr` | string \| null | 是 | `null` 未记录 | 列；筛选模糊 |
| `loginLocation` | string \| null | 是 | `null` 未解析 | 列 |
| `browser` | string \| null | 是 | `null` 未记录 | 列 |
| `os` | string \| null | 是 | `null` 未记录 | 列 |
| `msg` | string \| null | 是 | `null` 无提示 | 列/详情 |
| `loginTime` | string \| null | 是 | `null` 未记录 | 列；时间范围筛选 |

**筛选模型** `LogininforQuery = { pageNum, pageSize, ipaddr?, userName?, status?,
params?: { beginTime?, endTime? }, orderByColumn?, isAsc? }`。
**解锁模型**：仅当勾选行数 = 1 时启用“解锁”，取该行 `userName` 调用
`GET /monitor/logininfor/unlock/{userName}`；否则按钮禁用（E-17、A-15）。

## 9. 文件 `Oss` 与上传响应 `OssUpload`（Packet §4.9）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `ossId` | `Id` | 否 | — | 表格 key、下载/删除路径 |
| `fileName` | string | 否 | — | 列，存储文件名 |
| `originalName` | string \| null | 是 | `null` 未记录 | 列；筛选模糊 |
| `fileSuffix` | string \| null | 是 | `null` 无后缀 | 列原值展示，不补点 |
| `url` | string | 否 | — | 列链接；复制/预览用 |
| `ext1` | string \| null | 是 | `null` 无扩展 | 不展示 |
| `createTime` | string \| null | 是 | `null` 未记录 | 列；时间范围用 `beginCreateTime`/`endCreateTime` |
| `createBy` | `Id \| null` | 是 | `null` 未记录 | 筛选精确；不直接展示 |
| `createByName` | string \| null | 是 | `null` 未填充 | 列“上传人” |
| `service` | string \| null | 是 | `null` 未记录 | 列；筛选精确 |

**上传响应 `OssUpload`**：`{ url: string; fileName: string; ossId: Id }`，三者均非空；
上传成功后只用于提示与刷新，不写入本地缓存。

**派生 UI 状态**：
- `previewEnabled: boolean`：由 `GET /system/config/configKey/sys.oss.previewListResource`
  的 `data` 字符串判断（`'true'` → 开启）；读取失败按关闭渲染并 `message.error`。
- 文件列表行操作：下载对全部行可见（权限 `system:oss:download`），删除按
  `system:oss:remove`。

## 10. 文件配置 `OssConfig`（Packet §4.10）

| 字段 | 类型 | 可空 | 空值语义 | 前端用途/校验 |
|---|---|---|---|---|
| `ossConfigId` | `Id` | 否 | — | 表格 key、详情、删除、切换默认 |
| `configKey` | string | 否 | — | 列；表单必填 2–100，唯一（后端校验） |
| `accessKey` | string | 否 | — | 列可展示；表单必填 2–100 |
| `secretKey` | string | 否 | — | **列表不展示**；表单 `InputPassword` 遮蔽；不写日志/trace |
| `bucketName` | string | 否 | — | 列；表单必填 2–100 |
| `prefix` | string \| null | 是 | 等价空字符串 | 列/表单可选 |
| `endpoint` | string | 否 | — | 列；表单必填 2–100，展示协议前缀 |
| `domain` | string \| null | 是 | 等价空字符串 | 列/表单可选 |
| `isHttps` | string | 否 | — | `'Y'/'N'`；表单 Switch/Radio，默认 `'N'` |
| `region` | string \| null | 是 | 等价空字符串 | 表单可选 |
| `status` | string | 否 | — | `'0'` 默认 / `'1'` 非默认；列显示；行内切换调用 `changeStatus` |
| `ext1` | string \| null | 是 | 等价空字符串 | 不展示 |
| `remark` | string \| null | 是 | `null` 无备注 | 表单可选 |
| `accessPolicy` | string | 否 | — | `'0'` private / `'1'` public / `'2'` custom；表单必填 |

**表单模型** `OssConfigForm = Omit<OssConfig, 'ossConfigId' | 'ext1'> & { ossConfigId?: Id }`。
**状态约束**：全局至多一条 `status='0'`；切换默认用 `PUT /resource/oss/config/changeStatus`
（`{ ossConfigId, configKey, status: '0' }`），其余由后端置 `'1'`；内置配置删除返回
`msg='系统内置, 不可删除!'`（A-08）。
**展示约束**：列表列不含 `secretKey`；详情抽屉如需展示配置，同样排除 `secretKey` 与 `accessKey`。

## 11. 查询参数模型（Packet §4.11）

| 列表 | 模型 | 日期范围键 |
|---|---|---|
| 字典类型 | `DictTypeQuery`：`dictName?`, `dictType?`, `params` | `beginTime`/`endTime` |
| 字典数据 | `DictDataQuery`：`dictSort?`, `dictLabel?`, `dictType?` | 无 |
| 参数 | `ConfigQuery`：`configName?`, `configType?`, `configKey?`, `params` | `beginTime`/`endTime` |
| 公告 | `NoticeQuery`：`noticeTitle?`, `noticeType?`, `createByName?` | 无（不支持） |
| 操作日志 | `OperLogQuery`：`operIp?`, `title?`, `operName?`, `businessTypes?`, `status?`, `params` | `beginTime`/`endTime` |
| 登录日志 | `LogininforQuery`：`ipaddr?`, `userName?`, `status?`, `params` | `beginTime`/`endTime` |
| 文件 | `OssQuery`：`fileName?`, `originalName?`, `fileSuffix?`, `url?`, `service?`, `createBy?`, `params` | `beginCreateTime`/`endCreateTime` |
| 文件配置 | `OssConfigQuery`：`configKey?`, `bucketName?`, `status?` | 无 |

**实现约束**：
- 日期范围用 `#/utils/system/query` 的 `addDateRange(query, range)`（默认写 `params[beginTime]`
  与 `params[endTime]`）；文件列表单独把键名改为 `beginCreateTime`/`endCreateTime`。
- 空字符串不发送：`removeEmptyParams` 或查询组装时删除；`0` 与 `false` 保留。
- `businessTypes` 为空数组时不发送；非空时发送数组。

## 12. 表单校验模型（Packet §4.12）

| 表单 | 字段 | 规则 | 前端组件 |
|---|---|---|---|
| 字典类型 | `dictName` | 必填 ≤100 | `Input` |
| 字典类型 | `dictType` | 必填 ≤100，`^[a-z][a-z0-9_]*$` | `Input` |
| 字典类型 | `remark` | 可选 | `Textarea` |
| 字典数据 | `dictLabel` | 必填 ≤100 | `Input` |
| 字典数据 | `dictValue` | 必填 ≤100 | `Input` |
| 字典数据 | `dictType` | 只读继承，必填 | `Input`（disabled） |
| 字典数据 | `dictSort` | 整数 ≥0 | `InputNumber` |
| 字典数据 | `cssClass` | 可选 ≤100 | `Input` |
| 字典数据 | `listClass` | 可选枚举 | `Select` |
| 字典数据 | `remark` | 可选 | `Textarea` |
| 参数 | `configName` | 必填 ≤100 | `Input` |
| 参数 | `configKey` | 必填 ≤100 | `Input` |
| 参数 | `configValue` | 必填 ≤500 | `Textarea` |
| 参数 | `configType` | `'Y'/'N'`，默认 `'Y'` | `RadioGroup` |
| 参数 | `remark` | 可选 | `Textarea` |
| 公告 | `noticeTitle` | 必填 ≤50，不含 `<`/`>` | `Input` |
| 公告 | `noticeType` | 必填 `'1'/'2'` | `RadioGroup` |
| 公告 | `status` | `'0'/'1'` | `RadioGroup`；新增默认 `'0'` |
| 公告 | `noticeContent` | 可选 | `Tiptap`（编辑器输出 HTML） |
| 文件配置 | `configKey` | 必填 2–100 | `Input` |
| 文件配置 | `accessKey` | 必填 2–100 | `Input` |
| 文件配置 | `secretKey` | 必填 2–100，遮蔽 | `InputPassword` |
| 文件配置 | `bucketName` | 必填 2–100 | `Input` |
| 文件配置 | `endpoint` | 必填 2–100 | `Input`（带前缀） |
| 文件配置 | `accessPolicy` | 必填 `'0'/'1'/'2'` | `RadioGroup` |
| 文件配置 | `isHttps` | `'Y'/'N'`，默认 `'N'` | `RadioGroup` |
| 文件配置 | `prefix`/`domain`/`region`/`remark` | 可选 | `Input`/`Textarea` |
| 文件配置 | `status` | 新增默认 `'1'` | 隐藏/只读 |

## 13. 状态流转（Packet §6）

| 实体 | 状态 | 合法迁移 | 非法迁移处理 |
|---|---|---|---|
| 公告 | `'0'` ↔ `'1'` | 任意方向 | 无额外拒绝 |
| 参数 | `configType='Y'/'N'` | 新增选定；编辑保留 | 内置参数删除 → `code≠200`，展示 `msg` |
| 字典类型 | 存在/删除 | 无数据引用时删除 | 有数据 → `code≠200`（含“已分配,不能删除”）；重复 → `code=409` |
| 文件配置 | `'0'` ↔ `'1'` | 仅一条默认；切换后其余置 `'1'` | 内置删除 → `code≠200`；重复 key → `code≠200` |
| 登录账号 | 锁定/解锁 | 解锁后清除失败计数 | 勾选数 ≠ 1 不发起 |

## 14. 客户端派生模型与不变量

- `DictDataPageContext`（隐藏页）：`{ dictId: Id; dictType: string | null }`；
  `dictType` 为 `null` 时页面展示空状态与错误提示，不请求数据列表。
- `Notice.contentHtml`：只允许 tiptap 输出的 HTML；历史 `ql-*` 经
  `legacy-notice-html.ts` 归一化后进入编辑器；任何情况下不进入 `v-html`。
- `Oss.previewEnabled`：布尔视图状态，真实值只在 config 接口；切换失败时回滚。
- `OssConfig` 列表视图不含 `secretKey`/`accessKey` 之外的敏感字段；任何日志/报告不出现
  `secretKey` 明文。
- 所有列表：`rows` 为空时显示表格空状态，不发第二次请求；页码越界按
  `resolveOutOfRangePage` 回到最后一页（E-25）。
