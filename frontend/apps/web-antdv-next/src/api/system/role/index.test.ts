import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  downloadBlob: vi.fn(),
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

vi.mock('#/api/system/common', () => ({
  downloadBlob: mocks.downloadBlob,
}));

import {
  addRoleApi,
  cancelAuthUserAllApi,
  cancelAuthUserApi,
  changeRoleStatusApi,
  deleteRoleApi,
  exportRoleApi,
  getAllocatedUserListApi,
  getRoleApi,
  getRoleDeptTreeApi,
  getRoleListApi,
  getRoleMenuTreeApi,
  getUnallocatedUserListApi,
  selectAuthUserAllApi,
  updateRoleApi,
  updateRoleDataScopeApi,
} from './index';

describe('api/system/role 契约（R-01 ~ R-14）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({});
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
    mocks.del.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('R-01 列表：GET /system/role/list，条件走 query', async () => {
    const query = { pageNum: 1, pageSize: 10, roleName: '管理员' };
    mocks.get.mockResolvedValue({ rows: [], total: 0 });

    await expect(getRoleListApi(query)).resolves.toEqual({
      rows: [],
      total: 0,
    });
    expect(mocks.get).toHaveBeenCalledWith('/system/role/list', {
      params: query,
    });
  });

  it('R-02 导出：POST /system/role/export，参数放 query', async () => {
    const query = { roleName: '管理员' };

    await exportRoleApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/system/role/export',
      expect.objectContaining({ params: query }),
    );
  });

  it('R-03 详情：GET /system/role/{roleId}', async () => {
    await getRoleApi('1820000000000000001');

    expect(mocks.get).toHaveBeenCalledWith(
      '/system/role/1820000000000000001',
    );
  });

  it('R-04/R-05 新增与修改：POST/PUT /system/role，JSON body', async () => {
    const form = { menuIds: [], roleKey: 'spec003', roleName: '角色', roleSort: 1 };

    await addRoleApi(form);
    await updateRoleApi({ ...form, roleId: '1' });

    expect(mocks.post).toHaveBeenCalledWith('/system/role', form);
    expect(mocks.put).toHaveBeenCalledWith('/system/role', {
      ...form,
      roleId: '1',
    });
  });

  it('R-06 数据权限：PUT /system/role/dataScope，deptIds 必须为数组', async () => {
    const form = {
      dataScope: '2',
      deptCheckStrictly: true,
      deptIds: ['1', '2'],
      roleId: '9',
    };

    await updateRoleDataScopeApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/role/dataScope', form);
  });

  it('R-07 状态：PUT /system/role/changeStatus', async () => {
    await changeRoleStatusApi({ roleId: '9', status: '1' });

    expect(mocks.put).toHaveBeenCalledWith('/system/role/changeStatus', {
      roleId: '9',
      status: '1',
    });
  });

  it('R-08 删除：单个路径 + 逗号分隔 ID', async () => {
    await deleteRoleApi(['1', 2]);

    expect(mocks.del).toHaveBeenCalledWith('/system/role/1,2');
  });

  it('R-09/R-10 授权用户列表：allocatedList / unallocatedList 带 roleId', async () => {
    const query = { pageNum: 1, pageSize: 10, roleId: '9' };
    mocks.get.mockResolvedValue({ rows: [], total: 0 });

    await getAllocatedUserListApi(query);
    await getUnallocatedUserListApi(query);

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/system/role/authUser/allocatedList',
      { params: query },
    );
    expect(mocks.get).toHaveBeenNthCalledWith(
      2,
      '/system/role/authUser/unallocatedList',
      { params: query },
    );
  });

  it('R-11 单个取消授权：PUT + JSON body', async () => {
    const form = { roleId: '9', userId: '10' };

    await cancelAuthUserApi(form);

    expect(mocks.put).toHaveBeenCalledWith(
      '/system/role/authUser/cancel',
      form,
    );
  });

  it('R-12/R-13 批量授权：query + 逗号分隔 userIds，不用 body', async () => {
    await cancelAuthUserAllApi('9', ['10', 11]);
    await selectAuthUserAllApi('9', ['10', 11]);

    expect(mocks.put).toHaveBeenNthCalledWith(
      1,
      '/system/role/authUser/cancelAll',
      null,
      { params: { roleId: '9', userIds: '10,11' } },
    );
    expect(mocks.put).toHaveBeenNthCalledWith(
      2,
      '/system/role/authUser/selectAll',
      null,
      { params: { roleId: '9', userIds: '10,11' } },
    );
  });

  it('R-14 菜单树与部门树：GET roleMenuTreeselect / deptTree', async () => {
    mocks.get.mockResolvedValue({ checkedKeys: [], menus: [], depts: [] });

    await getRoleMenuTreeApi('9');
    await getRoleDeptTreeApi('9');

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/system/menu/roleMenuTreeselect/9',
    );
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/system/role/deptTree/9');
  });
});
