#!/usr/bin/env bash
# REQ-20261101-001 评测夹具：A-05 需要的「可进岗位页、无新增权限、进不了菜单页」账号。
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 为什么不用既有账号：
#   - spec002_limited 没有任何菜单授权，连 /system/post 都进不去（A-05 的第一句无意义）；
#   - spec003_readonly 同时有菜单页权限，A-05 第二句（访问 /system/menu 落 403/404）不成立。
#
# 用法：bash scripts/evals/seed_spec001.sh
# 依赖：docker 容器 awp-mysql（可用 EVAL_MYSQL_CONTAINER 覆盖）
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"

ROLE_ID=900001000000000001           # spec001_postonly_role
USER_ID=900001000000000002           # spec001_postonly
MENU_SYSTEM=1                        # 系统管理（目录）
MENU_POST=104                        # 岗位管理（system:post:list）
MENU_POST_QUERY=1021                 # 岗位查询（system:post:query）

SQL=$(cat <<SQL
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);

DELETE FROM sys_user_role WHERE user_id = ${USER_ID} OR role_id = ${ROLE_ID};
DELETE FROM sys_user WHERE user_id = ${USER_ID};
DELETE FROM sys_role_menu WHERE role_id = ${ROLE_ID};
DELETE FROM sys_role_dept WHERE role_id = ${ROLE_ID};
DELETE FROM sys_role WHERE role_id = ${ROLE_ID};

-- role_key 不用 admin：A-05 需要的是"普通账号"，且不能因为租户管理员角色绕过权限码。
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${ROLE_ID}, '000000', 'Spec001 岗位只读角色', 'spec001_postonly', 910, '1', '0', '0', 1, NOW());

-- 只授予岗位列表/查询，不授予新增、删除、导出；不授予菜单管理。
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (${ROLE_ID}, ${MENU_SYSTEM}),
  (${ROLE_ID}, ${MENU_POST}),
  (${ROLE_ID}, ${MENU_POST_QUERY});

INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${USER_ID}, '000000', 100, 'spec001_postonly', 'Spec001 PostOnly', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());

INSERT INTO sys_user_role (user_id, role_id) VALUES (${USER_ID}, ${ROLE_ID});
SQL
)

docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
  mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}" <<<"${SQL}"

echo "seeded: role=${ROLE_ID} user=${USER_ID} menus=${MENU_SYSTEM},${MENU_POST},${MENU_POST_QUERY}"
