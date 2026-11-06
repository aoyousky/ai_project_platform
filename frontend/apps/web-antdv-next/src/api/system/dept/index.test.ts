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
  addDeptApi,
  deleteDeptApi,
  getDeptApi,
  getDeptExcludeChildApi,
  getDeptListApi,
  updateDeptApi,
} from './index';

describe('api/system/dept 契约（D-01 ~ D-06）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue([]);
    mocks.del.mockResolvedValue(null);
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
  });

  it('D-01 列表：GET /system/dept/list，flat 数组', async () => {
    const query = { deptName: '研发' };

    await getDeptListApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/system/dept/list', {
      params: query,
    });
  });

  it('D-02 排除自身及下级：GET /system/dept/list/exclude/{deptId}', async () => {
    await getDeptExcludeChildApi('100');

    expect(mocks.get).toHaveBeenCalledWith('/system/dept/list/exclude/100');
  });

  it('D-03 详情：GET /system/dept/{deptId}', async () => {
    await getDeptApi('100');

    expect(mocks.get).toHaveBeenCalledWith('/system/dept/100');
  });

  it('D-04/D-05 新增与修改：POST/PUT /system/dept', async () => {
    const form = { deptName: '测试部', orderNum: 1, parentId: '100' };

    await addDeptApi(form);
    await updateDeptApi({ ...form, deptId: '101' });

    expect(mocks.post).toHaveBeenCalledWith('/system/dept', form);
    expect(mocks.put).toHaveBeenCalledWith('/system/dept', {
      ...form,
      deptId: '101',
    });
  });

  it('D-06 删除：DELETE /system/dept/{deptId}', async () => {
    await deleteDeptApi('101');

    expect(mocks.del).toHaveBeenCalledWith('/system/dept/101');
  });
});
