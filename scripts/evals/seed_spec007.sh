#!/usr/bin/env bash
# REQ-20261111-007 评测夹具：系统监控（SPEC-007 §2）。
# 仅允许指向本地 Docker 测试栈，禁止用于生产库。
#
# 用法：bash scripts/evals/seed_spec007.sh
# 依赖：docker 容器 awp-mysql（EVAL_MYSQL_CONTAINER 可覆盖）
#
# 幂等：按固定 ID 与业务键双向清理后重建。
# 在线会话不在此脚本内伪造：SPEC-007 §2 要求 `spec007_online` 的 2 个会话
# 由两次真实登录创建，E2E 用例通过 `loginWithCaptcha` 建立（见
# frontend/tests/e2e/spec007-assertions.spec.ts）。
# 脚本输出只含夹具 ID/账号名，不打印密码。
set -euo pipefail

MYSQL_CONTAINER="${EVAL_MYSQL_CONTAINER:-awp-mysql}"
MYSQL_DATABASE="${EVAL_MYSQL_DATABASE:-aoyou}"
MYSQL_ROOT_PASSWORD="${EVAL_MYSQL_ROOT_PASSWORD:-root}"

# 固定夹具 ID（与 trace / eval cases 对齐）
ONLINE_ROLE_ID=900007000000000001      # spec007_online 角色（全量监控权限）
LIMITED_ROLE_ID=900007000000000002     # spec007_limited 角色（仅在线列表）
NO_MONITOR_ROLE_ID=900007000000000003  # spec007_no_monitor 角色（无 monitor 权限）
ONLINE_USER_ID=900007000000000011
LIMITED_USER_ID=900007000000000012
NO_MONITOR_USER_ID=900007000000000013

# 系统监控菜单基线（plus-ui 内置）
MONITOR_DIR_ID=2       # 系统监控目录
ONLINE_MENU_ID=109     # 在线用户（monitor:online:list）
CACHE_MENU_ID=113      # 缓存监控（monitor:cache:list）
ADMIN_MENU_ID=117      # Admin 监控（monitor:admin:list）
SNAILJOB_MENU_ID=120   # 任务调度中心（monitor:snailjob:list）
ONLINE_QUERY_ID=1046   # monitor:online:query
ONLINE_BATCH_ID=1047   # monitor:online:batchLogout
ONLINE_FORCE_ID=1048   # monitor:online:forceLogout

SQL=$(cat <<SQL
SET @pwd := (SELECT password FROM sys_user WHERE user_id = 1);

-- 1) 清理：账号、角色、角色菜单（按固定 ID 与业务键）
DELETE FROM sys_user_role
  WHERE user_id IN (${ONLINE_USER_ID}, ${LIMITED_USER_ID}, ${NO_MONITOR_USER_ID})
     OR role_id IN (${ONLINE_ROLE_ID}, ${LIMITED_ROLE_ID}, ${NO_MONITOR_ROLE_ID});
DELETE FROM sys_user
  WHERE user_id IN (${ONLINE_USER_ID}, ${LIMITED_USER_ID}, ${NO_MONITOR_USER_ID})
     OR user_name IN ('spec007_online', 'spec007_limited', 'spec007_no_monitor');
DELETE FROM sys_role_menu
  WHERE role_id IN (${ONLINE_ROLE_ID}, ${LIMITED_ROLE_ID}, ${NO_MONITOR_ROLE_ID});
DELETE FROM sys_role
  WHERE role_id IN (${ONLINE_ROLE_ID}, ${LIMITED_ROLE_ID}, ${NO_MONITOR_ROLE_ID})
     OR role_key IN ('spec007_online', 'spec007_limited', 'spec007_no_monitor');

-- 2) 角色
INSERT INTO sys_role
  (role_id, tenant_id, role_name, role_key, role_sort, data_scope, status, del_flag, create_by, create_time)
VALUES
  (${ONLINE_ROLE_ID}, '000000', 'Spec007 在线用户角色', 'spec007_online', 907, '1', '0', '0', 1, NOW()),
  (${LIMITED_ROLE_ID}, '000000', 'Spec007 仅列表角色', 'spec007_limited', 908, '1', '0', '0', 1, NOW()),
  (${NO_MONITOR_ROLE_ID}, '000000', 'Spec007 无监控角色', 'spec007_no_monitor', 909, '1', '0', '0', 1, NOW());

-- 3) 角色菜单：在线角色具备全部 monitor:*；受限角色仅列表；无监控角色无 monitor 菜单
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (${ONLINE_ROLE_ID}, ${MONITOR_DIR_ID}),
  (${ONLINE_ROLE_ID}, ${ONLINE_MENU_ID}),
  (${ONLINE_ROLE_ID}, ${CACHE_MENU_ID}),
  (${ONLINE_ROLE_ID}, ${ADMIN_MENU_ID}),
  (${ONLINE_ROLE_ID}, ${SNAILJOB_MENU_ID}),
  (${ONLINE_ROLE_ID}, ${ONLINE_QUERY_ID}),
  (${ONLINE_ROLE_ID}, ${ONLINE_BATCH_ID}),
  (${ONLINE_ROLE_ID}, ${ONLINE_FORCE_ID}),
  (${LIMITED_ROLE_ID}, ${MONITOR_DIR_ID}),
  (${LIMITED_ROLE_ID}, ${ONLINE_MENU_ID}),
  (${LIMITED_ROLE_ID}, ${ONLINE_QUERY_ID});

-- 4) 账号（密码复用 admin 的 bcrypt，避免明文）
INSERT INTO sys_user
  (user_id, tenant_id, dept_id, user_name, nick_name, user_type, email, phonenumber,
   sex, password, status, del_flag, create_by, create_time)
VALUES
  (${ONLINE_USER_ID}, '000000', 103, 'spec007_online', 'Spec007 Online', 'sys_user',
   '', '', '2', @pwd, '0', '0', 1, NOW()),
  (${LIMITED_USER_ID}, '000000', 103, 'spec007_limited', 'Spec007 Limited', 'sys_user',
   '', '', '2', @pwd, '0', '0', 1, NOW()),
  (${NO_MONITOR_USER_ID}, '000000', 103, 'spec007_no_monitor', 'Spec007 No Monitor', 'sys_user',
   '', '', '2', @pwd, '0', '0', 1, NOW());

INSERT INTO sys_user_role (user_id, role_id) VALUES
  (${ONLINE_USER_ID}, ${ONLINE_ROLE_ID}),
  (${LIMITED_USER_ID}, ${LIMITED_ROLE_ID}),
  (${NO_MONITOR_USER_ID}, ${NO_MONITOR_ROLE_ID});
SQL
)

docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" "${MYSQL_CONTAINER}" \
  mysql --default-character-set=utf8mb4 -uroot "${MYSQL_DATABASE}" <<<"${SQL}"

echo "seeded: onlineUser=${ONLINE_USER_ID} limitedUser=${LIMITED_USER_ID} noMonitorUser=${NO_MONITOR_USER_ID} roles=${ONLINE_ROLE_ID},${LIMITED_ROLE_ID},${NO_MONITOR_ROLE_ID}"
