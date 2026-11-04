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
  addPostApi,
  deletePostApi,
  exportPostApi,
  getPostApi,
  getPostDeptTreeApi,
  getPostListApi,
  updatePostApi,
} from './index';

describe('api/system/post 契约（P-01 ~ P-07）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.del.mockResolvedValue(null);
    mocks.post.mockResolvedValue(null);
    mocks.put.mockResolvedValue(null);
    mocks.downloadBlob.mockResolvedValue(undefined);
  });

  it('P-01 列表：GET /system/post/list，条件走 query', async () => {
    const query = { pageNum: 1, pageSize: 10, postCode: 'ceo' };

    await getPostListApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/system/post/list', {
      params: query,
    });
  });

  it('P-02 导出：POST /system/post/export，参数放 query', async () => {
    const query = { postName: '总裁' };

    await exportPostApi(query);

    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      '/system/post/export',
      expect.objectContaining({ params: query }),
    );
  });

  it('P-03 详情：GET /system/post/{postId}', async () => {
    await getPostApi('7');

    expect(mocks.get).toHaveBeenCalledWith('/system/post/7');
  });

  it('P-04/P-05 新增与修改：POST/PUT /system/post', async () => {
    const form = {
      deptId: '100',
      postCode: 'spec003_post',
      postName: '测试岗位',
      postSort: 1,
    };

    await addPostApi(form);
    await updatePostApi({ ...form, postId: '7', status: '1' });

    expect(mocks.post).toHaveBeenCalledWith('/system/post', form);
    expect(mocks.put).toHaveBeenCalledWith('/system/post', {
      ...form,
      postId: '7',
      status: '1',
    });
  });

  it('P-06 删除：逗号分隔 ID', async () => {
    await deletePostApi(['7', 8]);

    expect(mocks.del).toHaveBeenCalledWith('/system/post/7,8');
  });

  it('P-07 部门树：GET /system/post/deptTree', async () => {
    await getPostDeptTreeApi();

    expect(mocks.get).toHaveBeenCalledWith('/system/post/deptTree');
  });
});
