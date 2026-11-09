#!/usr/bin/env bash
# REQ-20261107-005 评测夹具：系统管理辅助模块（SPEC-004 §2 预置数据）。
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 用法：bash scripts/evals/seed_spec004.sh
# 依赖：docker 容器 awp-mysql（可用 EVAL_MYSQL_CONTAINER 覆盖）
#
# 幂等：先按固定 ID/业务键清理本需求夹具及其 E2E 残留，再插入。
# 不删除内置配置 ossConfigId=1/2，不删除内置参数 sys.oss.previewListResource。
# 数据库凭据只从环境/容器读取，不打印；脚本输出只含夹具 ID/名称。
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"
BACKEND_CONTAINER="${EVAL_BACKEND_CONTAINER:-awp-backend}"

# MinIO endpoint 必须随后端运行位置切换：
# - 后端在 compose 容器内：用服务名 minio:9000；
# - 后端在宿主机（CI / 本机 java -jar）：用映射端口 127.0.0.1:9000。
# 可用 EVAL_OSS_ENDPOINT 显式覆盖。
OSS_ENDPOINT="${EVAL_OSS_ENDPOINT:-}"
if [[ -z "${OSS_ENDPOINT}" ]]; then
  if docker inspect -f '{{.State.Running}}' "${BACKEND_CONTAINER}" 2>/dev/null | grep -q true; then
    OSS_ENDPOINT="minio:9000"
  else
    OSS_ENDPOINT="127.0.0.1:9000"
  fi
fi

# 固定夹具 ID（与 scripts/evals/run_eval.py 的 EVAL_SPEC004_* 默认值一一对应）
DICT_TYPE_ID=900004000000000001       # spec004_dict_type
DICT_DATA_A_ID=900004000000000002     # spec004_value_a
DICT_DATA_B_ID=900004000000000003     # spec004_value_b
CONFIG_ID=900004000000000004          # spec004.config.key
NOTICE_ID=900004000000000005          # Spec004 公告
OPER_LOG_ID=900004000000000006        # Spec004 操作
LOGININFOR_ID=900004000000000007      # spec004_lock
LIMITED_ROLE_ID=900004000000000008    # spec004_limited 角色
LIMITED_USER_ID=900004000000000009    # spec004_limited 账号
OSS_CONFIG_ID=900004000000000010      # spec004_oss_config 残留清理目标（初始不存在）
OSS_LIMITED_ROLE_ID=900004000000000011  # spec004_oss_limited 角色（仅文件列表/查询/下载）
OSS_LIMITED_USER_ID=900004000000000012  # spec004_oss_limited 账号（E-20）

SQL=$(cat <<SQL
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);

-- 1) 清理：按固定 ID 与业务键双向清理，覆盖上次 E2E 留下的数据。
DELETE FROM sys_user_role
  WHERE user_id IN (${LIMITED_USER_ID}, ${OSS_LIMITED_USER_ID})
     OR role_id IN (${LIMITED_ROLE_ID}, ${OSS_LIMITED_ROLE_ID});
DELETE FROM sys_user
  WHERE user_id IN (${LIMITED_USER_ID}, ${OSS_LIMITED_USER_ID});
DELETE FROM sys_role_menu
  WHERE role_id IN (${LIMITED_ROLE_ID}, ${OSS_LIMITED_ROLE_ID});
DELETE FROM sys_role
  WHERE role_id IN (${LIMITED_ROLE_ID}, ${OSS_LIMITED_ROLE_ID});

DELETE FROM sys_dict_data
  WHERE dict_code IN (${DICT_DATA_A_ID}, ${DICT_DATA_B_ID})
     OR dict_type = 'spec004_dict_type';
DELETE FROM sys_dict_type
  WHERE dict_id = ${DICT_TYPE_ID} OR dict_type = 'spec004_dict_type';

DELETE FROM sys_config
  WHERE config_id = ${CONFIG_ID} OR config_key LIKE 'spec004%';

DELETE FROM sys_notice
  WHERE notice_id = ${NOTICE_ID} OR notice_title LIKE 'Spec004 公告%';

DELETE FROM sys_oper_log
  WHERE oper_id = ${OPER_LOG_ID}
     OR (title = 'Spec004 操作' AND oper_name = 'spec004_operator');

DELETE FROM sys_logininfor
  WHERE info_id = ${LOGININFOR_ID} OR user_name = 'spec004_lock';

-- A-07 上传夹具的数据库残留（对象文件不删除，仅清理列表记录）
DELETE FROM sys_oss
  WHERE original_name LIKE 'spec004_upload%' OR file_name LIKE 'spec004_upload%';

-- 文件配置：仅清理本需求新增项，保留内置 ossConfigId=1/2
DELETE FROM sys_oss_config
  WHERE oss_config_id = ${OSS_CONFIG_ID} OR config_key = 'spec004_oss_config';

-- 2) 字典类型 + 2 条字典数据
INSERT INTO sys_dict_type
  (dict_id, tenant_id, dict_name, dict_type, create_dept, create_by, create_time, remark)
VALUES
  (${DICT_TYPE_ID}, '000000', 'Spec004 字典类型', 'spec004_dict_type', 103, 1, NOW(), 'REQ-20261107-005 评测夹具');

INSERT INTO sys_dict_data
  (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type,
   css_class, list_class, is_default, create_dept, create_by, create_time, remark)
VALUES
  (${DICT_DATA_A_ID}, '000000', 1, 'Spec004 标签一', 'spec004_value_a', 'spec004_dict_type',
   '', 'primary', 'N', 103, 1, NOW(), 'REQ-20261107-005 评测夹具'),
  (${DICT_DATA_B_ID}, '000000', 2, 'Spec004 标签二', 'spec004_value_b', 'spec004_dict_type',
   '', 'default', 'N', 103, 1, NOW(), 'REQ-20261107-005 评测夹具');

-- 3) 非内置参数
INSERT INTO sys_config
  (config_id, tenant_id, config_name, config_key, config_value, config_type,
   create_dept, create_by, create_time, remark)
VALUES
  (${CONFIG_ID}, '000000', 'Spec004 参数', 'spec004.config.key', 'spec004-value-a', 'N',
   103, 1, NOW(), 'REQ-20261107-005 评测夹具');

-- 4) 公告：历史 ql-* 类，供 A-11 归一化与计算样式断言
INSERT INTO sys_notice
  (notice_id, tenant_id, notice_title, notice_type, notice_content, status,
   create_dept, create_by, create_time, remark)
VALUES
  (${NOTICE_ID}, '000000', 'Spec004 公告', '1',
   '<p class="ql-align-center">Spec004 居中正文</p><p><span class="ql-size-large">Spec004 大字号文本</span></p><p>Spec004 普通正文</p>',
   '0', 103, 1, NOW(), 'REQ-20261107-005 评测夹具');

-- 5) 操作日志：请求参数与返回参数均为合法 JSON
INSERT INTO sys_oper_log
  (oper_id, tenant_id, title, business_type, method, request_method, operator_type,
   oper_name, dept_name, oper_url, oper_ip, oper_location, oper_param, json_result,
   status, error_msg, oper_time, cost_time)
VALUES
  (${OPER_LOG_ID}, '000000', 'Spec004 操作', 1, 'com.aoyou.web.controller.system.SysDictTypeController.add',
   'POST', 1, 'spec004_operator', 'Spec004 部门', '/system/dict/type', '127.0.0.1', '内网IP',
   '{"key":"value"}', '{"code":200,"msg":"操作成功"}', 0, '', NOW(), 123);

-- 6) 登录日志：失败状态（status='1'），用于解锁与筛选
INSERT INTO sys_logininfor
  (info_id, tenant_id, user_name, client_key, device_type, ipaddr, login_location,
   browser, os, status, msg, login_time)
VALUES
  (${LOGININFOR_ID}, '000000', 'spec004_lock', 'pc', 'pc', '127.0.0.1', '内网IP',
   'Chrome', 'Windows', '1', '密码错误', NOW());

-- 7) 受限账号：仅字典菜单 + system:dict:list/system:dict:query
INSERT INTO sys_role
  (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES
  (${LIMITED_ROLE_ID}, '000000', 'Spec004 受限角色', 'spec004_limited', 904, '1', '0', '0', 1, NOW());

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (${LIMITED_ROLE_ID}, 1),     -- 系统管理目录
  (${LIMITED_ROLE_ID}, 105),   -- 字典管理（system:dict:list）
  (${LIMITED_ROLE_ID}, 1026);  -- 字典查询（system:dict:query）

INSERT INTO sys_user
  (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber,
   sex, password, status, del_flag, create_by, create_time)
VALUES
  (${LIMITED_USER_ID}, '000000', 103, 'spec004_limited', 'Spec004 Limited', 'sys_user',
   '', '', '2', @pwd, '0', '0', 1, NOW());

INSERT INTO sys_user_role (user_id, role_id)
VALUES (${LIMITED_USER_ID}, ${LIMITED_ROLE_ID});

-- 7b) 文件页受限账号：可打开文件管理页（列表/查询/下载），无上传/删除权限（E-20）
INSERT INTO sys_role
  (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES
  (${OSS_LIMITED_ROLE_ID}, '000000', 'Spec004 文件受限角色', 'spec004_oss_limited', 905, '1', '0', '0', 1, NOW());

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (${OSS_LIMITED_ROLE_ID}, 1),     -- 系统管理目录
  (${OSS_LIMITED_ROLE_ID}, 118),   -- 文件管理（system:oss:list）
  (${OSS_LIMITED_ROLE_ID}, 1600),  -- 文件查询
  (${OSS_LIMITED_ROLE_ID}, 1602);  -- 文件下载

INSERT INTO sys_user
  (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber,
   sex, password, status, del_flag, create_by, create_time)
VALUES
  (${OSS_LIMITED_USER_ID}, '000000', 103, 'spec004_oss_limited', 'Spec004 OSS Limited', 'sys_user',
   '', '', '2', @pwd, '0', '0', 1, NOW());

INSERT INTO sys_user_role (user_id, role_id)
VALUES (${OSS_LIMITED_USER_ID}, ${OSS_LIMITED_ROLE_ID});

-- 8) 内置参数与文件默认项归一化（只改状态/端点，不删除内置配置/参数）
UPDATE sys_config
  SET config_value = 'true'
  WHERE config_key = 'sys.oss.previewListResource';

UPDATE sys_oss_config SET status = '1';
UPDATE sys_oss_config
  SET status = '0',
      endpoint = '${OSS_ENDPOINT}'
  WHERE oss_config_id = 1;
SQL
)

docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
  mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}" <<<"${SQL}"

# 后端启动时把 sys_oss_config 缓存进 Redis；直接改库不会刷新缓存。
# 后端在容器内时重启一次，让 init() 重新加载 endpoint；宿主机后端（CI）的
# endpoint 与基线一致，无需重启。重启只影响测试栈，不触碰数据卷。
# E2E 用例开始前的幂等补种设置 EVAL_SKIP_RESTART=1：此时后端正在被用例使用，
# 重启会造成数秒停机；门禁阶段的首次 seed 已完成缓存刷新。
if [[ "${EVAL_SKIP_RESTART:-0}" != "1" ]] \
  && docker inspect -f '{{.State.Running}}' "${BACKEND_CONTAINER}" 2>/dev/null | grep -q true; then
  docker restart "${BACKEND_CONTAINER}" >/dev/null
fi

echo "seeded: dictType=${DICT_TYPE_ID} dictData=${DICT_DATA_A_ID},${DICT_DATA_B_ID} config=${CONFIG_ID} notice=${NOTICE_ID} operLog=${OPER_LOG_ID} logininfor=${LOGININFOR_ID} limitedUser=${LIMITED_USER_ID} limitedRole=${LIMITED_ROLE_ID} ossLimitedUser=${OSS_LIMITED_USER_ID} ossLimitedRole=${OSS_LIMITED_ROLE_ID} ossEndpoint=${OSS_ENDPOINT}"
