import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/** 后端 `/system/user/getInfo` 的 `data`（契约 §2） */
interface RuoYiUserInfoResult {
  permissions?: string[];
  roles?: string[];
  user: {
    avatar?: null | string;
    dept?: null | { deptName?: string };
    nickName?: string;
    userId: number | string;
    userName: string;
  };
}

/** 首页常量路由（FR-015） */
const HOME_PATH = '/index';

/**
 * 后端用户画像 → Vben `UserInfo`（data-model §2.2）。
 * `userId` 字符串化，避免雪花 ID 超出 JS 安全整数；`dept` 可能为 null。
 */
export function toVbenUserInfo(data: RuoYiUserInfoResult): UserInfo {
  const user = data.user ?? ({} as RuoYiUserInfoResult['user']);
  return {
    avatar: user.avatar ?? '',
    desc: user.dept?.deptName ?? '',
    homePath: HOME_PATH,
    realName: user.nickName ?? '',
    roles: data.roles ?? [],
    token: '',
    userId: user.userId === undefined ? '' : String(user.userId),
    username: user.userName ?? '',
  };
}

/**
 * 获取用户信息。
 */
export async function getUserInfoApi(): Promise<UserInfo> {
  const data = await requestClient.get<RuoYiUserInfoResult>(
    '/system/user/getInfo',
  );
  return toVbenUserInfo(data);
}
