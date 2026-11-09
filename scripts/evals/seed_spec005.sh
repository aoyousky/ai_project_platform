#!/usr/bin/env bash
# REQ-20261108-006（SPEC-005 v1.4）评测夹具。
#
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 用法：
#   bash scripts/evals/seed_spec005.sh base
#   bash scripts/evals/seed_spec005.sh volatile   # 需 EVAL_SPEC005_TOKENS_FILE
#
# 两阶段原因：A-01/A-02/A-05 的登录日志与在线数是确定值。真实登录会写入
# sys_logininfor 与 online_tokens 键，因此顺序必须是：
#   base（用户/部门/角色/流程夹具）→ spec005_tokens.mjs 生成 3 个令牌
#   → volatile（重置日志/公告/在线键，保留 3 个真实令牌）
#   → HTTP 探针（全程直取令牌，不再触发登录）。
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"

TENANT_A='000000'
TENANT_B='900005'                  # 仅评测夹具使用，无 sys_tenant 依赖
ADMIN_A_ID=900005220000000001
LIMITED_ID=900005220000000002
ADMIN_B_ID=900005800000000001
INITIATOR_ID=900005210000000001    # 待办发起人（非 admin_a，避免污染 initiatedTotal）
TOP_USERS=951                      # 286+248+193+126+98
SPECIAL_USERS=48                   # admin_a + limited + 46 在线用户
TARGET_USERS=1286
TARGET_DEPTS=36
ONLINE_SYNTHETIC=46

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PYTHON_BIN="${EVAL_PYTHON:-python}"

mysql_exec() {
  docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
    mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}"
}

mysql_scalar() {
  docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
    mysql --default-character-set=utf8mb4 -uroot -N -s "${MYSQL_DATABASE}" |
    tr -d ' \t\r\n'
}

seed_base() {
  # 先清理上一轮残留，再按剩余存量反推需要新增的用户数。
  mysql_exec <<SQL
SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET SESSION cte_max_recursion_depth = 100000;

-- Warm-Flow 夹具（保留 9.00005x 十亿段，远离业务雪花 ID）
DELETE FROM flow_task WHERE id BETWEEN 900005130000000000 AND 900005130000000999;
DELETE FROM flow_his_task WHERE id BETWEEN 900005140000000000 AND 900005140000000999;
DELETE FROM flow_user WHERE id BETWEEN 900005150000000000 AND 900005150000000999;
DELETE FROM flow_instance WHERE id BETWEEN 900005120000000000 AND 900005120000000999;
DELETE FROM flow_node WHERE id BETWEEN 900005110000000000 AND 900005110000000999;
DELETE FROM flow_definition WHERE id BETWEEN 900005100000000000 AND 900005100000000999;

-- 用户/角色/部门清理（spec005_* 命名与租户 B 全量）
DELETE ur FROM sys_user_role ur JOIN sys_user u ON u.user_id = ur.user_id
  WHERE u.user_name LIKE 'spec005_%' OR u.tenant_id = '${TENANT_B}';
DELETE up FROM sys_user_post up JOIN sys_user u ON u.user_id = up.user_id
  WHERE u.user_name LIKE 'spec005_%' OR u.tenant_id = '${TENANT_B}';
DELETE FROM sys_user WHERE user_name LIKE 'spec005_%' OR tenant_id = '${TENANT_B}';
DELETE FROM sys_role_menu WHERE role_id IN (900005000000000201, 900005000000000202, 900005000000000203);
DELETE FROM sys_role WHERE role_id IN (900005000000000201, 900005000000000202, 900005000000000203);
DELETE FROM sys_dept WHERE (dept_id BETWEEN 900005000000000000 AND 900005000000001999)
  OR (dept_id BETWEEN 900005900000000000 AND 900005900000000999);
SQL

  local existing_users existing_depts max_dept_users new_depts filler_depts filler
  existing_users=$(printf "SELECT count(*) FROM sys_user WHERE tenant_id='%s' AND del_flag='0';\n" "${TENANT_A}" | mysql_scalar)
  existing_depts=$(printf "SELECT count(*) FROM sys_dept WHERE tenant_id='%s' AND del_flag='0';\n" "${TENANT_A}" | mysql_scalar)
  max_dept_users=$(printf "SELECT coalesce(max(c),0) FROM (SELECT count(*) c FROM sys_user WHERE tenant_id='%s' AND del_flag='0' GROUP BY dept_id) t;\n" "${TENANT_A}" | mysql_scalar)

  if (( max_dept_users > 98 )); then
    echo "FAIL: 存量部门最大人数 ${max_dept_users} > 98，会挤掉 Top5 第 5 名（人力资源部 98）；请清理存量夹具。" >&2
    exit 1
  fi
  new_depts=$(( TARGET_DEPTS - existing_depts ))
  if (( new_depts < 6 )); then
    new_depts=6
  fi
  filler_depts=$(( new_depts - 5 ))
  filler=$(( TARGET_USERS - existing_users - TOP_USERS - SPECIAL_USERS ))
  if (( filler < 0 )); then
    echo "FAIL: 存量用户 ${existing_users} 过多，无法在 ${TARGET_USERS} 总量内安排 Top5+特殊账号；请清理存量夹具。" >&2
    exit 1
  fi

  mysql_exec <<SQL
SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET SESSION cte_max_recursion_depth = 100000;
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);
SET @existing_users := ${existing_users};

-- 部门：存量 ${existing_depts} + 新增 ${new_depts} = 36（存量大于 30 时保底 6 个）
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${new_depts})
SELECT 900005000000000000 + n, '${TENANT_A}', 0, '0',
       CASE n
         WHEN 1 THEN '运营中心'
         WHEN 2 THEN '技术中心'
         WHEN 3 THEN '客户成功部'
         WHEN 4 THEN '财务部'
         WHEN 5 THEN '人力资源部'
         ELSE CONCAT('spec005_filler_dept_', n - 5)
       END,
       900 + n, '0', '0', 1, NOW()
FROM seq;

-- Top5 部门用户：286/248/193/126/98
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${TOP_USERS})
SELECT 900005210000000000 + n, '${TENANT_A}',
       900005000000000000 + CASE
         WHEN n <= 286 THEN 1
         WHEN n <= 534 THEN 2
         WHEN n <= 727 THEN 3
         WHEN n <= 853 THEN 4
         ELSE 5
       END,
       CONCAT('spec005_top_', LPAD(n, 4, '0')), CONCAT('Spec005 Top ', n),
       'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW()
FROM seq;

-- 普通补齐用户，均分到非 Top5 部门；特殊账号全部落在 dept 6
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${filler})
SELECT 900005230000000000 + n, '${TENANT_A}',
       900005000000000000 + 6 + ((n - 1) % ${filler_depts}),
       CONCAT('spec005_f_', LPAD(n, 4, '0')), CONCAT('Spec005 Filler ', n),
       'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW()
FROM seq;

-- 特殊账号：admin_a / limited / 46 个在线用户名（供 Redis 在线数映射）
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES
  (${ADMIN_A_ID}, '${TENANT_A}', 900005000000000006, 'spec005_admin_a', 'Spec005 Admin A', 'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW()),
  (${LIMITED_ID}, '${TENANT_A}', 900005000000000006, 'spec005_limited', 'Spec005 Limited', 'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW());
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${ONLINE_SYNTHETIC})
SELECT 900005220000000000 + 2 + n, '${TENANT_A}', 900005000000000006,
       CONCAT('spec005_online_', n), CONCAT('Spec005 Online ', n),
       'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW()
FROM seq;

-- 角色：admin_a 全量权限码 / limited 仅公告 / 租户 B 仅用户+部门
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly, status, del_flag, create_by, create_time)
VALUES
  (900005000000000201, '${TENANT_A}', 'Spec005 管理员', 'spec005_admin_a', 900, '1', 1, 1, '0', '0', 1, NOW()),
  (900005000000000202, '${TENANT_A}', 'Spec005 仅公告', 'spec005_limited', 901, '1', 1, 1, '0', '0', 1, NOW()),
  (900005000000000203, '${TENANT_B}', 'Spec005 租户B管理员', 'spec005_admin_b', 900, '1', 1, 1, '0', '0', 1, NOW());
INSERT INTO sys_user_role (user_id, role_id) VALUES
  (${ADMIN_A_ID}, 900005000000000201),
  (${LIMITED_ID}, 900005000000000202),
  (${ADMIN_B_ID}, 900005000000000203);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (900005000000000201, 1), (900005000000000201, 2), (900005000000000201, 108),
  (900005000000000201, 100), (900005000000000201, 103), (900005000000000201, 107),
  (900005000000000201, 109), (900005000000000201, 117), (900005000000000201, 500),
  (900005000000000201, 501),
  (900005000000000202, 1), (900005000000000202, 107),
  (900005000000000203, 1), (900005000000000203, 100), (900005000000000203, 103);

-- 租户 B：3 个部门、42 个用户（14/14/14），部门名不与 A 重叠
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES
  (900005900000000001, '${TENANT_B}', 0, '0', '租户B客户一组', 901, '0', '0', 1, NOW()),
  (900005900000000002, '${TENANT_B}', 0, '0', '租户B客户二组', 902, '0', '0', 1, NOW()),
  (900005900000000003, '${TENANT_B}', 0, '0', '租户B海外组', 903, '0', '0', 1, NOW());
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 42)
SELECT 900005800000000000 + n, '${TENANT_B}', 900005900000000000 + ((n - 1) % 3) + 1,
       CASE n WHEN 1 THEN 'spec005_admin_b' ELSE CONCAT('spec005_b_', LPAD(n, 4, '0')) END,
       CONCAT('Spec005 B ', n), 'sys_user', '', '', '0', @pwd, '0', '0', 1, NOW()
FROM seq;

-- 流程定义：normal（默认 72h）、fast（评测启动参数覆盖 1h）、progress（无审批节点）
INSERT INTO flow_definition (id, flow_code, flow_name, model_value, category, version, is_publish, form_custom, form_path, activity_status, create_time, create_by, del_flag, tenant_id)
VALUES
  (900005100000000001, 'spec005_normal', '费用报销', 'CLASSICS', NULL, '1', 1, 'N', NULL, 1, NOW(), 1, '0', '${TENANT_A}'),
  (900005100000000002, 'fast', '加急审批', 'CLASSICS', NULL, '1', 1, 'N', NULL, 1, NOW(), 1, '0', '${TENANT_A}'),
  (900005100000000003, 'spec005_progress', '合同审批', 'CLASSICS', NULL, '1', 1, 'N', NULL, 1, NOW(), 1, '0', '${TENANT_A}');
INSERT INTO flow_node (id, node_type, definition_id, node_code, node_name, version, create_time, create_by, del_flag, tenant_id)
VALUES
  (900005110000000001, 1, 900005100000000001, 'manager', '部门经理审批', '1', NOW(), 1, '0', '${TENANT_A}'),
  (900005110000000002, 1, 900005100000000001, 'finance', '财务审批', '1', NOW(), 1, '0', '${TENANT_A}'),
  (900005110000000003, 1, 900005100000000002, 'fastApprove', '加急审批', '1', NOW(), 1, '0', '${TENANT_A}'),
  (900005110000000004, 2, 900005100000000003, 'legal', '法务审批', '1', NOW(), 1, '0', '${TENANT_A}');

-- 7 条待办实例（发起人不是 admin_a）
INSERT INTO flow_instance (id, definition_id, business_id, node_type, node_code, node_name, variable, flow_status, activity_status, create_time, create_by, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 7)
SELECT 900005120000000000 + n, 900005100000000001, CONCAT('SPEC005-TODO-', n), 1, 'task', '审批',
       NULL, '1', 1, NOW(), '${INITIATOR_ID}', NOW(), '0', '${TENANT_A}'
FROM seq;

-- 12 个我发起实例：3 运行中 + 9 已完成
INSERT INTO flow_instance (id, definition_id, business_id, node_type, node_code, node_name, flow_status, activity_status, create_time, create_by, update_time, del_flag, tenant_id)
VALUES
  (900005120000000011, 900005100000000001, 'SPEC005-RUN-11', 1, 'manager', '部门经理审批', '1', 1, NOW(), '${ADMIN_A_ID}', DATE_SUB(NOW(), INTERVAL 1 HOUR), '0', '${TENANT_A}'),
  (900005120000000012, 900005100000000001, 'SPEC005-RUN-12', 1, 'finance', '财务审批', '1', 1, NOW(), '${ADMIN_A_ID}', DATE_SUB(NOW(), INTERVAL 2 HOUR), '0', '${TENANT_A}'),
  (900005120000000013, 900005100000000003, 'SPEC005-RUN-13', 2, 'legal', '法务审批', '1', 1, NOW(), '${ADMIN_A_ID}', DATE_SUB(NOW(), INTERVAL 3 HOUR), '0', '${TENANT_A}');
INSERT INTO flow_instance (id, definition_id, business_id, node_type, node_code, node_name, flow_status, activity_status, create_time, create_by, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 9)
SELECT 900005120000000020 + n, 900005100000000001, CONCAT('SPEC005-DONE-', n), 1, 'end', '完成',
       '2', 1, DATE_SUB(NOW(), INTERVAL 20 DAY), '${ADMIN_A_ID}', DATE_SUB(NOW(), INTERVAL 10 DAY), '0', '${TENANT_A}'
FROM seq;

-- 7 条待办：2 超时 / 3 今天到期 / 2 未来 7 天，全部默认 SLA=72h
INSERT INTO flow_task (id, definition_id, instance_id, node_code, node_name, node_type, flow_status, form_custom, create_time, create_by, update_time, del_flag, tenant_id)
VALUES
  (900005130000000001, 900005100000000001, 900005120000000001, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 4 DAY) + INTERVAL 8 HOUR, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 4 DAY) + INTERVAL 8 HOUR, '0', '${TENANT_A}'),
  (900005130000000002, 900005100000000001, 900005120000000002, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 4 DAY) + INTERVAL 20 HOUR, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 4 DAY) + INTERVAL 20 HOUR, '0', '${TENANT_A}'),
  (900005130000000003, 900005100000000001, 900005120000000003, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:57' HOUR_SECOND, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:57' HOUR_SECOND, '0', '${TENANT_A}'),
  (900005130000000004, 900005100000000001, 900005120000000004, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:58' HOUR_SECOND, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:58' HOUR_SECOND, '0', '${TENANT_A}'),
  (900005130000000005, 900005100000000001, 900005120000000005, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:59' HOUR_SECOND, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 3 DAY) + INTERVAL '23:59:59' HOUR_SECOND, '0', '${TENANT_A}'),
  (900005130000000006, 900005100000000001, 900005120000000006, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 2 DAY) + INTERVAL 9 HOUR, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 2 DAY) + INTERVAL 9 HOUR, '0', '${TENANT_A}'),
  (900005130000000007, 900005100000000001, 900005120000000007, 'task', '审批', 1, '1', 'N', DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR, '${INITIATOR_ID}', DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR, '0', '${TENANT_A}');

-- 待办处理人：admin_a 与 limited 各 7 条（A-06 要求 limited 的 todoTotal=7）
INSERT INTO flow_user (id, type, processed_by, associated, create_time, create_by, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 14)
SELECT 900005150000000000 + n, '1',
       CASE WHEN n <= 7 THEN '${ADMIN_A_ID}' ELSE '${LIMITED_ID}' END,
       900005130000000000 + ((n - 1) % 7) + 1,
       NOW(), '1', NOW(), '0', '${TENANT_A}'
FROM seq;

-- 32 条已办：11×3h + 1×5.4h(fast) 落在 7 天窗口；20 条 10 天前
INSERT INTO flow_his_task (id, definition_id, instance_id, task_id, node_code, node_name, node_type, approver, cooperate_type, skip_type, flow_status, form_custom, create_time, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 32)
SELECT 900005140000000000 + n,
       CASE WHEN n = 12 THEN 900005100000000002 ELSE 900005100000000001 END,
       900005120000000020 + ((n - 1) % 9) + 1,
       900005140000000000 + n,
       'task', '审批', 1, '${ADMIN_A_ID}', 0, '', '2', 'N',
       CASE
         WHEN n <= 11 THEN DATE_SUB(NOW(), INTERVAL (10 + n) HOUR) - INTERVAL 3 HOUR
         WHEN n = 12 THEN DATE_SUB(NOW(), INTERVAL 12 HOUR) - INTERVAL 324 MINUTE
         ELSE DATE_SUB(NOW(), INTERVAL 10 DAY) - INTERVAL 2 HOUR
       END,
       CASE
         WHEN n <= 11 THEN DATE_SUB(NOW(), INTERVAL (10 + n) HOUR)
         WHEN n = 12 THEN DATE_SUB(NOW(), INTERVAL 12 HOUR)
         ELSE DATE_SUB(NOW(), INTERVAL 10 DAY)
       END,
       '0', '${TENANT_A}'
FROM seq;

-- 5 条抄送记录（approver 非 admin_a，不计入 doneTotal）
INSERT INTO flow_his_task (id, definition_id, instance_id, task_id, node_code, node_name, node_type, approver, cooperate_type, skip_type, flow_status, form_custom, create_time, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
SELECT 900005140000000040 + n, 900005100000000001, 900005120000000021, 900005140000000040 + n,
       'task', '抄送', 1, '${INITIATOR_ID}', 0, '', 'copy', 'N', NOW(), NOW(), '0', '${TENANT_A}'
FROM seq;
INSERT INTO flow_user (id, type, processed_by, associated, create_time, create_by, update_time, del_flag, tenant_id)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
SELECT 900005150000000020 + n, '4', '${ADMIN_A_ID}', 900005140000000040 + n, NOW(), '1', NOW(), '0', '${TENANT_A}'
FROM seq;

-- 运行中实例的已完成节点（approver 非 admin_a，仅用于 flowProgress 的 doneNodes）
INSERT INTO flow_his_task (id, definition_id, instance_id, task_id, node_code, node_name, node_type, approver, cooperate_type, skip_type, flow_status, form_custom, create_time, update_time, del_flag, tenant_id)
VALUES
  (900005140000000051, 900005100000000001, 900005120000000011, 900005140000000051, 'manager', '部门经理审批', 1, '${INITIATOR_ID}', 0, '', '2', 'N', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), '0', '${TENANT_A}'),
  (900005140000000052, 900005100000000001, 900005120000000012, 900005140000000052, 'finance', '财务审批', 1, '${INITIATOR_ID}', 0, '', '2', 'N', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), '0', '${TENANT_A}');
SQL

  "${PYTHON_BIN}" "${SCRIPT_DIR}/spec005_redis_seed.py" --flush-all
  echo "seeded(base): existing_users=${existing_users} new_depts=${new_depts} filler=${filler} top=${TOP_USERS} special=${SPECIAL_USERS} tenant_b=42"
}

seed_volatile() {
  local tokens_file="${EVAL_SPEC005_TOKENS_FILE:-}"
  if [[ -z "${tokens_file}" || ! -f "${tokens_file}" ]]; then
    echo "FAIL: volatile 需要 EVAL_SPEC005_TOKENS_FILE 指向已生成的令牌 JSON" >&2
    exit 1
  fi

  mysql_exec <<SQL
SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET SESSION cte_max_recursion_depth = 100000;

-- 登录/操作/公告全量重置为确定夹具
DELETE FROM sys_logininfor WHERE tenant_id = '${TENANT_A}';
DELETE FROM sys_oper_log WHERE tenant_id = '${TENANT_A}';
DELETE FROM sys_notice WHERE tenant_id = '${TENANT_A}';

-- D-6～D 成功登录：142/168/153/201/187/226/213（合计 1290）
INSERT INTO sys_logininfor (info_id, tenant_id, user_name, client_key, device_type, ipaddr, login_location, browser, os, status, msg, login_time)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1290)
SELECT 900005400000000000 + n, '${TENANT_A}', CONCAT('spec005_login_', (n % 50) + 1),
       '', '', '10.12.1.1', '上海市', 'Edge', 'Windows', '0', '登录成功',
       DATE_SUB(CURDATE(), INTERVAL CASE
         WHEN n <= 142 THEN 6
         WHEN n <= 310 THEN 5
         WHEN n <= 463 THEN 4
         WHEN n <= 664 THEN 3
         WHEN n <= 851 THEN 2
         WHEN n <= 1077 THEN 1
         ELSE 0
       END DAY) + INTERVAL (8 + (n % 10)) HOUR
FROM seq;

-- 5 条操作日志，其中 3 条失败（todayErrorLogTotal=3）
INSERT INTO sys_oper_log (oper_id, tenant_id, title, business_type, method, request_method, operator_type, oper_name, dept_name, oper_url, oper_ip, oper_location, oper_param, json_result, status, error_msg, oper_time, cost_time)
VALUES
  (900005410000000001, '${TENANT_A}', '用户管理-新增用户', 2, 'SysUserController.add', 'POST', 1, 'spec005_admin', '运营中心', '/system/user', '10.12.1.1', '上海市', '{}', '{}', 1, '模拟失败', CURDATE() + INTERVAL 1 MINUTE, 12),
  (900005410000000002, '${TENANT_A}', '角色管理-修改角色', 3, 'SysRoleController.edit', 'PUT', 1, 'spec005_admin', '运营中心', '/system/role', '10.12.1.1', '上海市', '{}', '{}', 0, '', CURDATE() + INTERVAL 2 MINUTE, 8),
  (900005410000000003, '${TENANT_A}', '在线用户-强退用户', 3, 'SysUserOnlineController.forceLogout', 'DELETE', 1, 'spec005_admin', '运营中心', '/monitor/online', '10.12.1.1', '上海市', '{}', '{}', 1, '模拟失败', CURDATE() + INTERVAL 3 MINUTE, 5),
  (900005410000000004, '${TENANT_A}', '通知公告-新增公告', 2, 'SysNoticeController.add', 'POST', 1, 'spec005_admin', '运营中心', '/system/notice', '10.12.1.1', '上海市', '{}', '{}', 0, '', CURDATE() + INTERVAL 4 MINUTE, 9),
  (900005410000000005, '${TENANT_A}', '部门管理-修改部门', 3, 'SysDeptController.edit', 'PUT', 1, 'spec005_admin', '运营中心', '/system/dept', '10.12.1.1', '上海市', '{}', '{}', 1, '模拟失败', CURDATE() + INTERVAL 5 MINUTE, 7);

-- 3 条公告：标题与顺序为 A-05 的种子口径
INSERT INTO sys_notice (notice_id, tenant_id, notice_title, notice_type, notice_content, status, create_by, create_time)
VALUES
  (900005420000000001, '${TENANT_A}', '系统升级通知', '1', '本周六凌晨进行系统升级。', '0', 1, CURDATE() + INTERVAL 12 HOUR),
  (900005420000000002, '${TENANT_A}', '安全提醒：请更新密码', '2', '请及时更新登录密码。', '0', 1, CURDATE() + INTERVAL 11 HOUR),
  (900005420000000003, '${TENANT_A}', '国庆值班安排', '2', '国庆期间值班安排如下。', '0', 1, CURDATE() + INTERVAL 10 HOUR);
SQL

  "${PYTHON_BIN}" "${SCRIPT_DIR}/spec005_redis_seed.py" \
    --tokens-file "${tokens_file}" --synthetic "${ONLINE_SYNTHETIC}"
  echo "seeded(volatile): loginTrend=142/168/153/201/187/226/213 operErrors=3 notices=3 onlineA=$((ONLINE_SYNTHETIC + 2))"
}

case "${1:-}" in
  base) seed_base ;;
  volatile) seed_volatile ;;
  *)
    echo "用法: bash scripts/evals/seed_spec005.sh {base|volatile}" >&2
    exit 2
    ;;
esac
