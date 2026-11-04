#!/usr/bin/env bash
# REQ-20261103-002 评测夹具：在本地/CI 测试库预置部门、用户与角色。
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 用法：bash scripts/evals/seed_spec002.sh
# 依赖：docker 容器 awp-mysql（可用 EVAL_MYSQL_CONTAINER 覆盖）
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"

DEPT_ID=900000000000000001
USER_ID=900000000000000002
LIMITED_USER_ID=900000000000000003
DELETE_USER_ID=900000000000000004
ROLE_ID=900000000000000006
LIMITED_ROLE_ID=900000000000000007

SQL=$(cat <<SQL
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);

DELETE FROM sys_user_role WHERE user_id IN (${USER_ID}, ${LIMITED_USER_ID}, ${DELETE_USER_ID});
DELETE FROM sys_user_post WHERE user_id IN (${USER_ID}, ${LIMITED_USER_ID}, ${DELETE_USER_ID});
DELETE FROM sys_user WHERE user_id IN (${USER_ID}, ${LIMITED_USER_ID}, ${DELETE_USER_ID});
DELETE FROM sys_role WHERE role_id IN (${ROLE_ID}, ${LIMITED_ROLE_ID});
DELETE FROM sys_dept WHERE dept_id = ${DEPT_ID};

INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${DEPT_ID}, '000000', 0, '0', 'Spec002 部门', 1, '0', '0', 1, NOW());

INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${ROLE_ID}, '000000', 'Spec002 角色', 'spec002_role', 900, '1', '0', '0', 1, NOW());
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${LIMITED_ROLE_ID}, '000000', 'Spec002 无权限角色', 'spec002_noperm', 901, '5', '0', '0', 1, NOW());

INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${USER_ID}, '000000', ${DEPT_ID}, 'spec002_user', 'Spec002 User', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${LIMITED_USER_ID}, '000000', ${DEPT_ID}, 'spec002_limited', 'Spec002 Limited', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${DELETE_USER_ID}, '000000', ${DEPT_ID}, 'spec002_delete', 'Spec002 Delete', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());

-- spec002_user 初始不分配角色 R（A-06 前置）；limited 用户只绑定无权限角色。
INSERT INTO sys_user_role (user_id, role_id) VALUES (${LIMITED_USER_ID}, ${LIMITED_ROLE_ID});
SQL
)

docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
  mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}" <<<"${SQL}"

echo "seeded: dept=${DEPT_ID} user=${USER_ID} limited=${LIMITED_USER_ID} delete=${DELETE_USER_ID} role=${ROLE_ID} limitedRole=${LIMITED_ROLE_ID}"
