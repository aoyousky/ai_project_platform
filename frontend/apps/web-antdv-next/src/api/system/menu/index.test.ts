import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: mocks.del,
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
  },
}));

import {
  addMenuApi,
  cascadeDeleteMenuApi,
  deleteMenuApi,
  getMenuApi,
  getMenuListApi,
  getMenuTreeSelectApi,
  updateMenuApi,
} from './index';

describe('api/system/menu 契约（M-01 ~ M-08）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue([]);
    mocks.del.mockResolvedValue(null);
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
  });

  it('M-01 列表：GET /system/menu/list，flat 数组', async () => {
    const query = { menuName: '系统管理' };
    mocks.get.mockResolvedValue([{ menuId: 1 }]);

    await expect(getMenuListApi(query)).resolves.toEqual([{ menuId: 1 }]);
    expect(mocks.get).toHaveBeenCalledWith('/system/menu/list', {
      params: query,
    });
  });

  it('M-02 详情：GET /system/menu/{menuId}', async () => {
    await getMenuApi('1820000000000000001');

    expect(mocks.get).toHaveBeenCalledWith(
      '/system/menu/1820000000000000001',
    );
  });

  it('M-03 菜单树：GET /system/menu/treeselect', async () => {
    await getMenuTreeSelectApi({ status: '0' });

    expect(mocks.get).toHaveBeenCalledWith('/system/menu/treeselect', {
      params: { status: '0' },
    });
  });

  it('M-05/M-06 新增与修改：POST/PUT /system/menu，JSON body', async () => {
    const form = {
      menuName: '角色管理',
      menuType: 'C' as const,
      orderNum: 1,
      parentId: '0',
    };

    await addMenuApi(form);
    await updateMenuApi({ ...form, menuId: '2' });

    expect(mocks.post).toHaveBeenCalledWith('/system/menu', form);
    expect(mocks.put).toHaveBeenCalledWith('/system/menu', {
      ...form,
      menuId: '2',
    });
  });

  it('M-07 单删：DELETE /system/menu/{menuId}', async () => {
    await deleteMenuApi('3');

    expect(mocks.del).toHaveBeenCalledWith('/system/menu/3');
  });

  it('M-08 级联删除：逗号分隔 ID（调用方负责收集后代）', async () => {
    await cascadeDeleteMenuApi(['3', 4, '5']);

    expect(mocks.del).toHaveBeenCalledWith('/system/menu/cascade/3,4,5');
  });
});
