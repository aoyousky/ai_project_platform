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
  addUserApi,
  changeUserStatusApi,
  deleteUserApi,
  downloadUserImportTemplateApi,
  exportUserApi,
  getUserApi,
  getUserAuthRoleApi,
  getUserDeptTreeApi,
  getUserListApi,
  importUserDataApi,
  resetUserPwdApi,
  updateUserApi,
  updateUserAuthRoleApi,
} from './index';

describe('api/system/user 契约（U-01 ~ U-13）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({});
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
    mocks.del.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('U-01 列表：GET /system/user/list，查询条件走 query', async () => {
    const query = { pageNum: 1, pageSize: 10, userName: 'ry' };
    mocks.get.mockResolvedValue({ rows: [], total: 0 });

    await expect(getUserListApi(query)).resolves.toEqual({
      rows: [],
      total: 0,
    });
    expect(mocks.get).toHaveBeenCalledWith('/system/user/list', {
      params: query,
    });
  });

  it('U-02 导出：POST /system/user/export，参数必须在 query', async () => {
    const query = { userName: 'ry', params: { beginTime: '2026-01-01' } };

    await exportUserApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/system/user/export',
      expect.objectContaining({ params: query }),
    );
  });

  it('U-03 模板下载：POST /system/user/importTemplate', async () => {
    await downloadUserImportTemplateApi();

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/system/user/importTemplate',
      expect.objectContaining({ fileName: expect.stringContaining('.xlsx') }),
    );
  });

  it('U-04 导入：multipart + updateSupport query，不手写 Content-Type', async () => {
    const file = new File(['x'], 'user.xlsx');

    await importUserDataApi({ file, updateSupport: true });

    const [url, body, config] = mocks.post.mock.calls[0]!;
    expect(url).toBe('/system/user/importData');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config.params).toEqual({ updateSupport: true });
    expect(config.responseReturn).toBe('body');
    expect(config.headers?.['Content-Type']).toBeUndefined();
  });

  it('U-05 无 ID 预处理：保留尾部斜杠，避免与集合 POST 混淆', async () => {
    mocks.get.mockResolvedValue({ roles: [], posts: [], user: null });

    await getUserApi();

    expect(mocks.get).toHaveBeenCalledWith('/system/user/');
  });

  it('U-05 详情：GET /system/user/{userId}', async () => {
    await getUserApi('1820000000000000001');

    expect(mocks.get).toHaveBeenCalledWith(
      '/system/user/1820000000000000001',
    );
  });

  it('U-06 新增：POST /system/user，JSON body', async () => {
    const form = { userName: 'ry', nickName: '若依' };

    await addUserApi(form);

    expect(mocks.post).toHaveBeenCalledWith('/system/user', form);
  });

  it('U-07 修改：PUT /system/user，JSON body', async () => {
    const form = { userId: '2', userName: 'ry', nickName: '若依' };

    await updateUserApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/user', form);
  });

  it('U-08 删除：逗号分隔 ID，数字与字符串归一化', async () => {
    await deleteUserApi(['9', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/system/user/9,8');
  });

  it('U-09 重置密码：PUT + isEncrypt 头', async () => {
    const form = { userId: '9', password: 'abcd1234' };

    await resetUserPwdApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/user/resetPwd', form, {
      headers: { isEncrypt: 'true' },
    });
  });

  it('U-10 状态：PUT /system/user/changeStatus', async () => {
    const form = { status: '1', userId: '9' };

    await changeUserStatusApi(form);

    expect(mocks.put).toHaveBeenCalledWith('/system/user/changeStatus', form);
  });

  it('U-11 授权角色回显：GET /system/user/authRole/{userId}', async () => {
    await getUserAuthRoleApi('9');

    expect(mocks.get).toHaveBeenCalledWith('/system/user/authRole/9');
  });

  it('U-12 提交授权角色：query userId + 逗号分隔 roleIds', async () => {
    await updateUserAuthRoleApi('9', ['2', 1]);

    expect(mocks.put).toHaveBeenCalledWith('/system/user/authRole', null, {
      params: { roleIds: '2,1', userId: '9' },
    });
  });

  it('U-12 清空授权：roleIds 为空串', async () => {
    await updateUserAuthRoleApi('9', []);

    expect(mocks.put).toHaveBeenCalledWith('/system/user/authRole', null, {
      params: { roleIds: '', userId: '9' },
    });
  });

  it('U-13 部门树：GET /system/user/deptTree', async () => {
    mocks.get.mockResolvedValue([]);

    await getUserDeptTreeApi();

    expect(mocks.get).toHaveBeenCalledWith('/system/user/deptTree');
  });
});
