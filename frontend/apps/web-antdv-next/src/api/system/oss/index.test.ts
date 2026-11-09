import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  downloadFileFromBlobPart: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: mocks.del,
    get: mocks.get,
    post: mocks.post,
  },
}));

vi.mock('@vben/utils', () => ({
  downloadFileFromBlobPart: mocks.downloadFileFromBlobPart,
}));

import {
  delOssApi,
  downloadOssApi,
  getOssByIdsApi,
  listOssApi,
  uploadOssApi,
} from './index';

/**
 * 文件 API 契约（SPEC-004 §2 / contracts §4.9）。
 * 5 个端点：列表、按编号取文件、上传、下载、删除。
 */
describe('api/system/oss 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.del.mockResolvedValue(null);
    mocks.get.mockResolvedValue({ rows: [], total: 0 });
    mocks.post.mockResolvedValue(null);
  });

  it('列表：GET /resource/oss/list，条件走 query，返回 {rows,total}', async () => {
    const query = {
      fileName: 'spec004_upload',
      fileSuffix: '.png',
      originalName: 'spec004_upload.png',
      pageNum: 1,
      pageSize: 10,
      params: { beginCreateTime: '2026-11-01', endCreateTime: '2026-11-08' },
      service: 'minio',
    };
    mocks.get.mockResolvedValue({
      rows: [
        {
          ossId: '900004000000000021',
          originalName: 'spec004_upload.png',
          url: 'http://127.0.0.1:9000/aoyou/spec004_upload.png',
        },
      ],
      total: 1,
    });

    const result = await listOssApi(query);

    expect(mocks.get).toHaveBeenCalledWith('/resource/oss/list', {
      params: query,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.ossId).toBe('900004000000000021');
  });

  it('按编号取文件：GET /resource/oss/listByIds/{逗号分隔编号}', async () => {
    mocks.get.mockResolvedValue([{ ossId: '1' }, { ossId: '2' }]);

    await expect(getOssByIdsApi([1, '900004000000000021'])).resolves.toEqual([
      { ossId: '1' },
      { ossId: '2' },
    ]);
    expect(mocks.get).toHaveBeenCalledWith(
      '/resource/oss/listByIds/1,900004000000000021',
    );
  });

  it('上传：POST /resource/oss/upload，FormData 字段名为 file', async () => {
    const file = new File(['Spec004 上传文本'], 'spec004_upload.txt', {
      type: 'text/plain',
    });
    mocks.post.mockResolvedValue({
      fileName: 'spec004_upload.txt',
      ossId: '900004000000000021',
      url: 'http://127.0.0.1:9000/aoyou/spec004_upload.txt',
    });

    const result = await uploadOssApi(file);

    const body = mocks.post.mock.calls[0]?.[1];
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(mocks.post).toHaveBeenCalledWith(
      '/resource/oss/upload',
      expect.any(FormData),
      // 请求实例默认 JSON 头会被 Axios 转成 JSON 请求体，必须显式清空；
      // 默认 10s 超时对对象存储上传偏短
      {
        headers: { 'Content-Type': undefined },
        timeout: 60_000,
      },
    );
    expect(result.ossId).toBe('900004000000000021');
  });

  it('下载成功：GET /resource/oss/download/{ossId}，交给 downloadFileFromBlobPart', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    mocks.get.mockResolvedValue({
      data: blob,
      headers: { 'content-type': 'image/png' },
    });

    await downloadOssApi('900004000000000021', 'spec004_upload.png');

    expect(mocks.get).toHaveBeenCalledWith(
      '/resource/oss/download/900004000000000021',
      {
        params: undefined,
        responseReturn: 'raw',
        responseType: 'blob',
      },
    );
    expect(mocks.downloadFileFromBlobPart).toHaveBeenCalledWith({
      fileName: 'spec004_upload.png',
      source: blob,
    });
  });

  it('下载失败（HTTP 200 + JSON 错误体）：抛出后端 msg，不保存文件（E-29）', async () => {
    const blob = new Blob([JSON.stringify({ msg: '文件数据不存在!' })], {
      type: 'application/json',
    });
    mocks.get.mockResolvedValue({
      data: blob,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });

    await expect(
      downloadOssApi('900004000000000099', 'missing.png'),
    ).rejects.toThrow('文件数据不存在!');
    expect(mocks.downloadFileFromBlobPart).not.toHaveBeenCalled();
  });

  it('删除：DELETE /resource/oss/{逗号分隔编号}，编号先归一化为字符串（E-30）', async () => {
    await delOssApi([1, '900004000000000021']);

    expect(mocks.del).toHaveBeenCalledWith(
      '/resource/oss/1,900004000000000021',
    );
  });
});
