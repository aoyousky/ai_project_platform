import { beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadFileFromBlobPart, get, post } = vi.hoisted(() => ({
  downloadFileFromBlobPart: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, post },
}));

vi.mock('@vben/utils', () => ({
  downloadFileFromBlobPart,
}));

import { downloadBlob, getDictDataByTypeApi } from './common';

describe('api/system/common', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('按 dictType 请求字典数据', async () => {
    get.mockResolvedValue([{ dictLabel: '正常', dictValue: '0' }]);

    await expect(getDictDataByTypeApi('sys_normal_disable')).resolves.toEqual([
      { dictLabel: '正常', dictValue: '0' },
    ]);
    expect(get).toHaveBeenCalledWith(
      '/system/dict/data/type/sys_normal_disable',
    );
  });

  it('导出成功：raw + blob，交给 downloadFileFromBlobPart', async () => {
    const blob = new Blob(['file'], { type: 'application/vnd.ms-excel' });
    post.mockResolvedValue({
      data: blob,
      headers: { 'content-type': 'application/vnd.ms-excel' },
    });

    await downloadBlob('/system/user/export', {
      fileName: '用户数据.xlsx',
      params: { userName: 'ry' },
    });

    expect(post).toHaveBeenCalledWith('/system/user/export', undefined, {
      params: { userName: 'ry' },
      responseReturn: 'raw',
      responseType: 'blob',
    });
    expect(downloadFileFromBlobPart).toHaveBeenCalledWith({
      fileName: '用户数据.xlsx',
      source: blob,
    });
  });

  it('导出失败（HTTP 200 + JSON）：抛出后端 msg，不下载文件', async () => {
    const blob = new Blob([JSON.stringify({ msg: '导出失败' })], {
      type: 'application/json',
    });
    post.mockResolvedValue({
      data: blob,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });

    await expect(downloadBlob('/system/user/export')).rejects.toThrow(
      '导出失败',
    );
    expect(downloadFileFromBlobPart).not.toHaveBeenCalled();
  });

  it('导出失败且 msg 为空时使用兜底文案', async () => {
    const blob = new Blob([JSON.stringify({ code: 500 })], {
      type: 'application/json',
    });
    post.mockResolvedValue({
      data: blob,
      headers: { 'content-type': 'application/json' },
    });

    await expect(downloadBlob('/system/user/export')).rejects.toThrow(
      '导出失败',
    );
  });
});
