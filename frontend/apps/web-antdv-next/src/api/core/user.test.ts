import { describe, expect, it, vi } from 'vitest';

// 被测对象是纯映射函数；请求层与 UI 依赖不需要真实加载。
vi.mock('antdv-next', () => ({
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { toVbenUserInfo } from './user';

describe('toVbenUserInfo（后端 getInfo → Vben UserInfo）', () => {
  it('字段一一映射，首页固定 /index（data-model §2.2）', () => {
    const info = toVbenUserInfo({
      permissions: ['*:*:*'],
      roles: ['superadmin'],
      user: {
        avatar: '',
        dept: { deptName: '研发部门' },
        nickName: '超级管理员',
        userId: 1,
        userName: 'admin',
      },
    });

    expect(info).toEqual({
      avatar: '',
      desc: '研发部门',
      homePath: '/index',
      realName: '超级管理员',
      roles: ['superadmin'],
      token: '',
      userId: '1',
      username: 'admin',
    });
  });

  it('雪花 ID 字符串化，避免精度丢失', () => {
    const bigId = '1820000000000000001';
    const info = toVbenUserInfo({
      user: { userId: bigId, userName: 'u' },
    });

    expect(info.userId).toBe(bigId);
  });

  it('dept 为 null 时 desc 为空串；roles 缺省为空数组', () => {
    const info = toVbenUserInfo({
      user: { dept: null, nickName: '张三', userId: '2', userName: 'zhangsan' },
    });

    expect(info.desc).toBe('');
    expect(info.roles).toEqual([]);
  });

  it('avatar 为 null 时为空串（展示层回退默认头像）', () => {
    const info = toVbenUserInfo({
      user: { avatar: null, userId: 3, userName: 'u' },
    });

    expect(info.avatar).toBe('');
  });
});
