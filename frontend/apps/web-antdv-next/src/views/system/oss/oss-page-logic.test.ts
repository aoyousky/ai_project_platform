import type { Oss } from '#/api/system/oss/types';

import { describe, expect, it } from 'vitest';

import {
  buildOssQuery,
  buildPreviewTogglePayload,
  downloadFileName,
  isPreviewableImage,
  isPreviewEnabled,
  nextPreviewValue,
  toUploadSummary,
} from './oss-page-logic';

const PAGE = { currentPage: 2, pageSize: 20 };

const oss: Oss = {
  ossId: '900004000000000021',
  fileName: 'spec004_upload.txt',
  fileSuffix: '.txt',
  originalName: 'spec004_upload.txt',
  service: 'minio',
  url: 'http://127.0.0.1:9000/aoyou/spec004_upload.txt',
};

describe('oss-page-logic', () => {
  it('预览后缀白名单：png/jpg/jpeg 且开关为 true 才预览', () => {
    expect(isPreviewableImage('.PNG', true)).toBe(true);
    expect(isPreviewableImage('jpg', true)).toBe(true);
    expect(isPreviewableImage('jpeg', true)).toBe(true);
    expect(isPreviewableImage('png', false)).toBe(false);
    expect(isPreviewableImage('.txt', true)).toBe(false);
    expect(isPreviewableImage(null, true)).toBe(false);
    expect(isPreviewableImage(undefined, true)).toBe(false);
  });

  it('开关值判断：仅字符串 true（忽略大小写与空白）为开启', () => {
    expect(isPreviewEnabled('true')).toBe(true);
    expect(isPreviewEnabled(' TRUE ')).toBe(true);
    expect(isPreviewEnabled('false')).toBe(false);
    expect(isPreviewEnabled(null)).toBe(false);
    expect(isPreviewEnabled(undefined)).toBe(false);
    expect(isPreviewEnabled('')).toBe(false);
  });

  it('切换值：开启转 false，其余转 true', () => {
    expect(nextPreviewValue('true')).toBe('false');
    expect(nextPreviewValue(' TRUE ')).toBe('false');
    expect(nextPreviewValue('false')).toBe('true');
    expect(nextPreviewValue(null)).toBe('true');
  });

  it('开关载荷：固定 configKey，值为切换后的目标值', () => {
    expect(buildPreviewTogglePayload('true')).toEqual({
      configKey: 'sys.oss.previewListResource',
      configValue: 'false',
    });
  });

  it('下载文件名回退：原名 → 存储名 → download', () => {
    expect(downloadFileName(oss)).toBe('spec004_upload.txt');
    expect(
      downloadFileName({ ...oss, originalName: '   ' }),
    ).toBe('spec004_upload.txt');
    expect(
      downloadFileName({ fileName: '  ', originalName: null }),
    ).toBe('download');
  });

  it('上传响应映射：ossId 统一为字符串，文件名缺失时回退原始文件名', () => {
    expect(
      toUploadSummary(
        {
          fileName: '',
          ossId: '900004000000000021',
          url: 'http://127.0.0.1:9000/aoyou/spec004_upload.png',
        },
        'spec004_upload.png',
      ),
    ).toEqual({
      fileName: 'spec004_upload.png',
      originalName: 'spec004_upload.png',
      ossId: '900004000000000021',
      url: 'http://127.0.0.1:9000/aoyou/spec004_upload.png',
    });

    expect(toUploadSummary(null, 'spec004_upload.txt').ossId).toBe('');
  });

  it('查询：创建时间写入 params.beginCreateTime / endCreateTime，空白条件移除', () => {
    const query = buildOssQuery(
      {
        dateRange: ['2026-11-01', '2026-11-08'],
        fileName: 'spec004_upload',
        fileSuffix: '',
        originalName: '',
        service: '',
      },
      PAGE,
    );

    expect(query).toEqual({
      fileName: 'spec004_upload',
      pageNum: 2,
      pageSize: 20,
      params: { beginCreateTime: '2026-11-01', endCreateTime: '2026-11-08' },
    });
  });

  it('查询：无日期范围时不发送 params，导出可复用', () => {
    expect(buildOssQuery({ originalName: 'spec004_upload.png' })).toEqual({
      originalName: 'spec004_upload.png',
    });
  });
});
