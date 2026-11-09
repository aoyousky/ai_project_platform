# Contract: 后端接口消费清单

**Feature**: `specs/003-system-auxiliary` | **Date**: 2026-11-07
**Source**: `specs/SPEC-004-system-auxiliary.md` §4.1、§4.2、§4.11（签字版）
**Scope**: 仅消费以下端点；不新增端点、不修改 `platform/`、不自定义错误结构。
所有请求经 `#/api/request` 的 `requestClient`，默认携带 `Authorization: Bearer <token>` 与
`clientid`，成功码 `200`，失败展示后端 `msg`。

## 1. 共享约定

- 列表响应：`{ code: 200, msg, rows: T[], total: number }` → `requestClient` 解包为
  `PageResult<T> = { rows, total }`。
- 单对象响应：`{ code: 200, data: T }` → 解包为 `T`。
- 字符串响应：`{ code: 200, data: string }` → 解包为 `string`。
- 失败响应：HTTP 200 + `code≠200` 由拦截器 `message.error(msg)` 并 reject；HTTP 401 触发
  重新认证；HTTP 403 展示 `msg`；不吞异常。
- 分页参数：`pageNum`、`pageSize`；排序参数在支持的后端端点上发送 `orderByColumn`/`isAsc`。
- 日期范围：`params[beginTime]`/`params[endTime]`；文件列表例外为
  `params[beginCreateTime]`/`params[endCreateTime]`。
- 导出/下载：`responseReturn: 'raw'`、`responseType: 'blob'`；若响应体是 JSON
  （`{code,msg}`）则读取 `msg` 抛错，不保存文件。

## 2. 字典类型

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listDictTypeApi` | `GET /system/dict/type/list` | `system:dict:list` | `DictTypeQuery` | `PageResult<DictType>` |
| `getDictTypeApi` | `GET /system/dict/type/{dictId}` | `system:dict:query` | 路径 `Id` | `DictType` |
| `addDictTypeApi` | `POST /system/dict/type` | `system:dict:add` | `DictTypeForm` | `void` |
| `updateDictTypeApi` | `PUT /system/dict/type` | `system:dict:edit` | `DictTypeForm`（含 `dictId`） | `void` |
| `delDictTypeApi` | `DELETE /system/dict/type/{dictIds}` | `system:dict:remove` | 逗号分隔 `Id` | `void` |
| `refreshDictTypeCacheApi` | `DELETE /system/dict/type/refreshCache` | `system:dict:remove` | 无 | `void` |
| `optionselectDictTypeApi` | `GET /system/dict/type/optionselect` | 无 | 无 | `DictType[]` |
| `exportDictTypeApi` | `POST /system/dict/type/export` | `system:dict:export` | 当前查询（表单值） | `Blob` |
| `getDictDataByTypeApi`（复用 `api/system/common.ts`） | `GET /system/dict/data/type/{dictType}` | 无 | 路径 string | `DictData[]` |

**错误行为**：
- 删除仍被字典数据引用的类型：HTTP 200、`code≠200`、`msg` 含“已分配,不能删除”；页面
  `message.error(msg)`，列表不本地移除（A-01 反例）。
- 重复 `dictType`：`code=409`，展示 `msg`。
- 导出失败：JSON 错误体 → `throw Error(msg)`，页面展示，不触发下载。

## 3. 字典数据

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listDictDataApi` | `GET /system/dict/data/list` | `system:dict:list` | `DictDataQuery` | `PageResult<DictData>` |
| `getDictDataApi` | `GET /system/dict/data/{dictCode}` | `system:dict:query` | 路径 `Id` | `DictData` |
| `addDictDataApi` | `POST /system/dict/data` | `system:dict:add` | `DictDataForm` | `void` |
| `updateDictDataApi` | `PUT /system/dict/data` | `system:dict:edit` | `DictDataForm`（含 `dictCode`） | `void` |
| `delDictDataApi` | `DELETE /system/dict/data/{dictCodes}` | `system:dict:remove` | 逗号分隔 `Id` | `void` |
| `exportDictDataApi` | `POST /system/dict/data/export` | `system:dict:export` | 当前查询 | `Blob` |

**隐藏页数据链路**：`GET /system/dict/type/{dictId}` → `dictType` → `listDictDataApi({ dictType })`。
`dictId` 非法/不存在时后端返回 `code≠200`；页面展示 `msg` 与空状态，不调用第二次列表。

## 4. 参数

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listConfigApi` | `GET /system/config/list` | `system:config:list` | `ConfigQuery` | `PageResult<Config>` |
| `getConfigApi` | `GET /system/config/{configId}` | `system:config:query` | 路径 `Id` | `Config` |
| `getConfigKeyApi` | `GET /system/config/configKey/{configKey}` | 无 | 路径 string | `string` |
| `addConfigApi` | `POST /system/config` | `system:config:add` | `ConfigForm` | `void` |
| `updateConfigApi` | `PUT /system/config` | `system:config:edit` | `ConfigForm`（含 `configId`） | `void` |
| `updateConfigByKeyApi` | `PUT /system/config/updateByKey` | `system:config:edit` | `{ configKey, configValue }` | `void` |
| `delConfigApi` | `DELETE /system/config/{configIds}` | `system:config:remove` | 逗号分隔 `Id` | `void` |
| `refreshConfigCacheApi` | `DELETE /system/config/refreshCache` | `system:config:remove` | 无 | `void` |
| `exportConfigApi` | `POST /system/config/export` | `system:config:export` | 当前查询 | `Blob` |

**OSS 预览开关复用**：读 `getConfigKeyApi('sys.oss.previewListResource')`；
写 `updateConfigByKeyApi({ configKey: 'sys.oss.previewListResource', configValue: 'true'|'false' })`；
按钮权限 `system:config:edit`（Packet §7 签字项 1）。

## 5. 公告

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listNoticeApi` | `GET /system/notice/list` | `system:notice:list` | `NoticeQuery` | `PageResult<Notice>` |
| `getNoticeApi` | `GET /system/notice/{noticeId}` | `system:notice:query` | 路径 `Id` | `Notice` |
| `addNoticeApi` | `POST /system/notice` | `system:notice:add` | `NoticeForm` | `void` |
| `updateNoticeApi` | `PUT /system/notice` | `system:notice:edit` | `NoticeForm`（含 `noticeId`） | `void` |
| `delNoticeApi` | `DELETE /system/notice/{noticeIds}` | `system:notice:remove` | 逗号分隔 `Id` | `void` |

**说明**：公告无导出端点；列表不发送 `status`、`beginTime`、`endTime`（后端不支持）。
`createByName` 由后端按用户名解析为 `createBy` 精确匹配。

## 6. 操作日志

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listOperLogApi` | `GET /monitor/operlog/list` | `monitor:operlog:list` | `OperLogQuery` | `PageResult<OperLog>` |
| `delOperLogApi` | `DELETE /monitor/operlog/{operIds}` | `monitor:operlog:remove` | 逗号分隔 `Id` | `void` |
| `cleanOperLogApi` | `DELETE /monitor/operlog/clean` | `monitor:operlog:remove` | 无 | `void` |
| `exportOperLogApi` | `POST /monitor/operlog/export` | `monitor:operlog:export` | 当前查询 | `Blob` |

**筛选**：`businessTypes` 多选（数组，空数组不发送）与单选 `businessType` 二者按 Packet 允许；
前端只用 `businessTypes` 数组，避免双字段。排序支持 `orderByColumn`/`isAsc`（P1 A-18）。

## 7. 登录日志

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listLogininforApi` | `GET /monitor/logininfor/list` | `monitor:logininfor:list` | `LogininforQuery` | `PageResult<Logininfor>` |
| `delLogininforApi` | `DELETE /monitor/logininfor/{infoIds}` | `monitor:logininfor:remove` | 逗号分隔 `Id` | `void` |
| `cleanLogininforApi` | `DELETE /monitor/logininfor/clean` | `monitor:logininfor:remove` | 无 | `void` |
| `exportLogininforApi` | `POST /monitor/logininfor/export` | `monitor:logininfor:export` | 当前查询 | `Blob` |
| `unlockLogininforApi` | `GET /monitor/logininfor/unlock/{userName}` | `monitor:logininfor:unlock` | 路径 string | `void` |

**解锁约束**：勾选行数必须恰为 1；取该行 `userName`，不做 URL 手工解码之外的改写；
勾选 0 或 ≥2 时按钮禁用，不发起请求（E-17、A-15）。

## 8. 文件

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listOssApi` | `GET /resource/oss/list` | `system:oss:list` | `OssQuery` | `PageResult<Oss>` |
| `listOssByIdsApi` | `GET /resource/oss/listByIds/{ossIds}` | `system:oss:query` | 逗号分隔 `Id` | `Oss[]` |
| `uploadOssApi` | `POST /resource/oss/upload` | `system:oss:upload` | `FormData` 字段 `file` | `OssUpload` |
| `downloadOssApi` | `GET /resource/oss/download/{ossId}` | `system:oss:download` | 路径 `Id` | `Blob` |
| `delOssApi` | `DELETE /resource/oss/{ossIds}` | `system:oss:remove` | 逗号分隔 `Id` | `void` |

**上传**：
- `customRequest` 构造 `FormData`，只 append `file` 字段；不手动设置 `Content-Type`（由浏览器
  生成 boundary）。
- 成功：`message.success` + 刷新列表；失败：展示后端 `msg`，不插入临时行。
- 空文件：前端拦截，不发起请求（E-19）。

**下载**：
- `downloadOssApi` 用 `responseType: 'blob'`；若 `Content-Type` 为 JSON，读取 `msg` 抛错。
- 成功后用 `downloadFileFromBlobPart` 保存；文件名优先 `originalName`，无则 `fileName`。
- 下载失败不产生空文件（E-29）。

## 9. 文件配置

| 前端函数 | 方法/路径 | 权限码 | 请求 | 响应 |
|---|---|---|---|---|
| `listOssConfigApi` | `GET /resource/oss/config/list` | `system:ossConfig:list` | `OssConfigQuery` | `PageResult<OssConfig>` |
| `getOssConfigApi` | `GET /resource/oss/config/{ossConfigId}` | `system:ossConfig:list` | 路径 `Id` | `OssConfig` |
| `addOssConfigApi` | `POST /resource/oss/config` | `system:ossConfig:add` | `OssConfigForm` | `void` |
| `updateOssConfigApi` | `PUT /resource/oss/config` | `system:ossConfig:edit` | `OssConfigForm`（含 `ossConfigId`） | `void` |
| `delOssConfigApi` | `DELETE /resource/oss/config/{ossConfigIds}` | `system:ossConfig:remove` | 逗号分隔 `Id` | `void` |
| `changeOssConfigStatusApi` | `PUT /resource/oss/config/changeStatus` | `system:ossConfig:edit` | `{ ossConfigId, configKey, status }` | `void` |

**错误行为**：
- 删除内置配置：`code≠200`、`msg='系统内置, 不可删除!'`；页面展示原文（A-08）。
- 重复 `configKey`：`code≠200`，展示 `msg`。
- 切换默认：仅一条 `status='0'`；成功后刷新列表；失败回滚开关并提示。

## 10. 前端 API 文件布局

| 文件 | 导出 |
|---|---|
| `src/api/system/dict/types.ts` | `DictType`、`DictData`、`DictTypeQuery/Form`、`DictDataQuery/Form` |
| `src/api/system/dict/index.ts` | 字典类型 8 个函数 + 字典数据 6 个函数 |
| `src/api/system/config/types.ts` | `Config`、`ConfigQuery/Form`、`ConfigKeyUpdate` |
| `src/api/system/config/index.ts` | 参数 9 个函数 |
| `src/api/system/notice/types.ts` | `Notice`、`NoticeQuery/Form` |
| `src/api/system/notice/index.ts` | 公告 5 个函数 |
| `src/api/monitor/operlog/types.ts` | `OperLog`、`OperLogQuery` |
| `src/api/monitor/operlog/index.ts` | 操作日志 4 个函数 |
| `src/api/monitor/logininfor/types.ts` | `Logininfor`、`LogininforQuery` |
| `src/api/monitor/logininfor/index.ts` | 登录日志 5 个函数 |
| `src/api/system/oss/types.ts` | `Oss`、`OssUpload`、`OssQuery` |
| `src/api/system/oss/config-types.ts` | `OssConfig`、`OssConfigForm`、`OssConfigQuery` |
| `src/api/system/oss/index.ts` | 文件 5 个函数 |
| `src/api/system/oss/config.ts` | 文件配置 6 个函数 |
| `src/api/system/common.ts`（修改） | 复用 `getDictDataByTypeApi`、`downloadBlob`；新增 GET 二进制 helper |

**禁止**：页面内裸写 `axios`/`fetch`；在 `packages/**` 新增 API 封装；改动请求拦截器语义。
