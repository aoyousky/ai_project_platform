#!/usr/bin/env bash
# REQ-20261104-003 评测夹具：角色/菜单/部门/岗位（SPEC-003 §2 预置数据）。
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 用法：bash scripts/evals/seed_spec003.sh
# 依赖：docker 容器 awp-mysql（可用 EVAL_MYSQL_CONTAINER 覆盖）
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"

DEPT_ID=900003000000000001          # spec003_dept（根部门）
CHILD_DEPT_ID=900003000000000002    # spec003_dept_child（子部门）
USER_DEPT_ID=900003000000000003     # spec003_dept_user（含用户）
POST_DEPT_ID=900003000000000004     # spec003_dept_post（含岗位）
EMPTY_DEPT_ID=900003000000000005    # spec003_dept_empty
ROLE_ID=900003000000000006          # spec003_role
ASSIGNED_ROLE_ID=900003000000000007 # spec003_assigned（已分配用户）
MENU_ADMIN_ROLE_ID=900003000000000010
USER_ID=900003000000000011          # spec003_user
MENU_ADMIN_USER_ID=900003000000000012
POST_ID=900003000000000013          # spec003_post_ref（被用户引用）
DIR_MENU_ID=900003000000000014      # spec003_dir
SUB_MENU_ID=900003000000000015      # spec003_menu
BUTTON_MENU_ID=900003000000000016   # spec003_button

SQL=$(cat <<SQL
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);

DELETE FROM sys_user_role WHERE user_id IN (${USER_ID}, ${MENU_ADMIN_USER_ID});
DELETE FROM sys_user_post WHERE user_id IN (${USER_ID}, ${MENU_ADMIN_USER_ID});
DELETE FROM sys_user WHERE user_id IN (${USER_ID}, ${MENU_ADMIN_USER_ID});
DELETE FROM sys_role_menu WHERE role_id IN (${ROLE_ID}, ${ASSIGNED_ROLE_ID}, ${MENU_ADMIN_ROLE_ID});
DELETE FROM sys_role_dept WHERE role_id = ${ROLE_ID};
DELETE FROM sys_role WHERE role_id IN (${ROLE_ID}, ${ASSIGNED_ROLE_ID}, ${MENU_ADMIN_ROLE_ID});
DELETE FROM sys_post WHERE post_id = ${POST_ID};
DELETE FROM sys_menu WHERE menu_id IN (${DIR_MENU_ID}, ${SUB_MENU_ID}, ${BUTTON_MENU_ID});
DELETE FROM sys_dept WHERE dept_id IN (${CHILD_DEPT_ID}, ${USER_DEPT_ID}, ${POST_DEPT_ID}, ${EMPTY_DEPT_ID}, ${DEPT_ID});

-- 部门树：根 + 子部门，另有含用户 / 含岗位 / 空部门
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${DEPT_ID}, '000000', 0, '0', 'Spec003 部门', 900, '0', '0', 1, NOW());
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${CHILD_DEPT_ID}, '000000', ${DEPT_ID}, '0,${DEPT_ID}', 'Spec003 子部门', 1, '0', '0', 1, NOW());
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${USER_DEPT_ID}, '000000', ${DEPT_ID}, '0,${DEPT_ID}', 'Spec003 用户部门', 2, '0', '0', 1, NOW());
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${POST_DEPT_ID}, '000000', ${DEPT_ID}, '0,${DEPT_ID}', 'Spec003 岗位部门', 3, '0', '0', 1, NOW());
INSERT INTO sys_dept (dept_id, tenant_id, parent_id, ancestors, dept_name, order_num, status, del_flag, create_by, create_time)
VALUES (${EMPTY_DEPT_ID}, '000000', 0, '0', 'Spec003 空部门', 901, '0', '0', 1, NOW());

-- 角色：可编辑角色 / 已分配用户角色（保护用例）/ 仅菜单权限码角色（A-09）
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${ROLE_ID}, '000000', 'Spec003 角色', 'spec003_role', 900, '1', '0', '0', 1, NOW());
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${ASSIGNED_ROLE_ID}, '000000', 'Spec003 已分配角色', 'spec003_assigned', 901, '1', '0', '0', 1, NOW());
INSERT INTO sys_role (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES (${MENU_ADMIN_ROLE_ID}, '000000', 'Spec003 菜单权限角色', 'spec003_menu_admin', 902, '1', '0', '0', 1, NOW());

-- 菜单：目录 + 子菜单 + 按钮（A-03 / A-18 前置）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time)
VALUES (${DIR_MENU_ID}, 'Spec003 目录', 0, 900, 'spec003', NULL, 1, 0, 'M', '0', '0', NULL, '#', 1, NOW());
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time)
VALUES (${SUB_MENU_ID}, 'Spec003 菜单', ${DIR_MENU_ID}, 1, 'menu', 'system/role/index', 1, 0, 'C', '0', '0', 'spec003:menu:list', '#', 1, NOW());
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time)
VALUES (${BUTTON_MENU_ID}, 'Spec003 按钮', ${SUB_MENU_ID}, 1, '', NULL, 1, 0, 'F', '0', '0', 'spec003:menu:add', '#', 1, NOW());

-- 菜单权限角色只绑定系统菜单权限码（不含 superadmin / 租户管理员角色）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT ${MENU_ADMIN_ROLE_ID}, menu_id FROM sys_menu
WHERE perms IN ('system:menu:list', 'system:menu:query', 'system:menu:add', 'system:menu:edit', 'system:menu:remove');

-- 岗位：被 spec003_user 引用（A-12 删除保护）
INSERT INTO sys_post (post_id, tenant_id, dept_id, post_code, post_category, post_name, post_sort, status, create_by, create_time)
VALUES (${POST_ID}, '000000', ${POST_DEPT_ID}, 'spec003_post_ref', '', 'Spec003 引用岗位', 900, '0', 1, NOW());

-- 用户：spec003_user（绑定 spec003_assigned 与 spec003_post_ref）/ spec003_menu_admin
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${USER_ID}, '000000', ${USER_DEPT_ID}, 'spec003_user', 'Spec003 User', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());
INSERT INTO sys_user (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, password, status, del_flag, create_by, create_time)
VALUES (${MENU_ADMIN_USER_ID}, '000000', ${DEPT_ID}, 'spec003_menu_admin', 'Spec003 MenuAdmin', 'sys_user', '', '', '2', @pwd, '0', '0', 1, NOW());

INSERT INTO sys_user_role (user_id, role_id) VALUES (${USER_ID}, ${ASSIGNED_ROLE_ID});
INSERT INTO sys_user_role (user_id, role_id) VALUES (${MENU_ADMIN_USER_ID}, ${MENU_ADMIN_ROLE_ID});
INSERT INTO sys_user_post (user_id, post_id) VALUES (${USER_ID}, ${POST_ID});
SQL
)

docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
  mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}" <<<"${SQL}"

echo "seeded: dept=${DEPT_ID} role=${ROLE_ID} assigned=${ASSIGNED_ROLE_ID} user=${USER_ID} menuAdmin=${MENU_ADMIN_USER_ID} post=${POST_ID} menus=${DIR_MENU_ID},${SUB_MENU_ID},${BUTTON_MENU_ID}"
