import type { OssConfig } from '#/api/system/oss/config-types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDefaultSwitch,
  buildOssConfigDefaults,
  buildOssConfigPayload,
  buildOssConfigQuery,
  buildSetDefaultPayload,
  createOssConfigFormSchema,
  endpointDisplay,
  protocolPrefix,
  statusLabel,
} from './oss-config-page-logic';

const config: OssConfig = {
  accessKey: 'spec004_access_key',
  accessPolicy: '0',
  bucketName: 'spec004_bucket_name',
  configKey: 'spec004_oss_config',
  domain: '',
  endpoint: '127.0.0.1:9000',
  isHttps: 'N',
  ossConfigId: '900004000000000010',
  prefix: '',
  region: '',
  remark: '',
  secretKey: 'spec004_secret_key',
  status: '1',
};

describe('oss-config-page-logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('查询：空白条件移除，分页参数保留', () => {
    expect(
      buildOssConfigQuery(
        { bucketName: '', configKey: 'spec004_oss_config', status: '1' },
        { currentPage: 2, pageSize: 20 },
      ),
    ).toEqual({
      configKey: 'spec004_oss_config',
      pageNum: 2,
      pageSize: 20,
      status: '1',
    });
  });

  it('状态展示：0=默认、1=非默认，未知值原样返回', () => {
    expect(statusLabel('0')).toBe('默认');
    expect(statusLabel('1')).toBe('非默认');
    expect(statusLabel('X')).toBe('X');
  });

  it('协议前缀：isHttps=Y 为 https，其余为 http', () => {
    expect(protocolPrefix('Y')).toBe('https://');
    expect(protocolPrefix('N')).toBe('http://');
    expect(protocolPrefix('')).toBe('http://');
  });

  it('访问站点展示：按 isHttps 补协议，已带协议不重复拼接', () => {
    expect(endpointDisplay('127.0.0.1:9000', 'N')).toBe(
      'http://127.0.0.1:9000',
    );
    expect(endpointDisplay('127.0.0.1:9000', 'Y')).toBe(
      'https://127.0.0.1:9000',
    );
    expect(endpointDisplay('http://example.com', 'N')).toBe(
      'http://example.com',
    );
    expect(endpointDisplay('https://example.com', 'N')).toBe(
      'https://example.com',
    );
  });

  it('新增默认值：isHttps=N、accessPolicy=0、status=1（非默认）', () => {
    expect(buildOssConfigDefaults()).toMatchObject({
      accessPolicy: '0',
      isHttps: 'N',
      status: '1',
    });
  });

  it('表单：secretKey 使用 InputPassword 遮蔽输入（E-31）', () => {
    const schema = createOssConfigFormSchema();
    const secret = schema.find((item) => item.fieldName === 'secretKey');

    expect(secret?.component).toBe('InputPassword');
    expect(secret?.rules).toBeTruthy();
  });

  it('表单：configKey/accessKey/secretKey/bucketName/endpoint 必填 2–100', () => {
    const schema = createOssConfigFormSchema();
    const fields = [
      'accessKey',
      'bucketName',
      'configKey',
      'endpoint',
      'secretKey',
    ];

    for (const fieldName of fields) {
      const item = schema.find((entry) => entry.fieldName === fieldName);
      expect(item?.rules, fieldName).toBeTruthy();
    }
  });

  it('载荷：字段去空格，可选字段空值转 null，编辑带 ossConfigId 与原状态', () => {
    expect(
      buildOssConfigPayload(
        {
          ...buildOssConfigDefaults(),
          accessKey: ' spec004_access_key ',
          bucketName: ' spec004_bucket_name_v2 ',
          configKey: ' spec004_oss_config ',
          domain: '  ',
          endpoint: ' 127.0.0.1:9000 ',
          region: '  ',
          remark: '  ',
          secretKey: ' spec004_secret_key ',
        },
        '900004000000000010',
        '1',
      ),
    ).toEqual({
      accessKey: 'spec004_access_key',
      accessPolicy: '0',
      bucketName: 'spec004_bucket_name_v2',
      configKey: 'spec004_oss_config',
      domain: null,
      endpoint: '127.0.0.1:9000',
      isHttps: 'N',
      ossConfigId: '900004000000000010',
      prefix: null,
      region: null,
      remark: null,
      secretKey: 'spec004_secret_key',
      status: '1',
    });
  });

  it('载荷：新增默认 status=1 且不带 ossConfigId', () => {
    const payload = buildOssConfigPayload({
      ...buildOssConfigDefaults(),
      accessKey: 'spec004_access_key',
      bucketName: 'spec004_bucket_name',
      configKey: 'spec004_oss_config',
      endpoint: '127.0.0.1:9000',
      secretKey: 'spec004_secret_key',
    });

    expect(payload.status).toBe('1');
    expect(payload).not.toHaveProperty('ossConfigId');
  });

  it('切换默认载荷：status 固定为 0，带 ossConfigId 与 configKey', () => {
    expect(buildSetDefaultPayload(config)).toEqual({
      configKey: 'spec004_oss_config',
      ossConfigId: '900004000000000010',
      status: '0',
    });
  });

  it('切换默认成功：只调用一次 changeStatus 并重载列表', async () => {
    const row = { ...config };
    const changeStatus = vi.fn().mockResolvedValue(null);
    const reload = vi.fn().mockResolvedValue(undefined);

    await applyDefaultSwitch(row, changeStatus, reload);

    expect(changeStatus).toHaveBeenCalledWith({
      configKey: 'spec004_oss_config',
      ossConfigId: '900004000000000010',
      status: '0',
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(row.status).toBe('0');
  });

  it('切换默认失败：状态回滚为原值并重载列表（A-16）', async () => {
    const row = { ...config };
    const changeStatus = vi
      .fn()
      .mockRejectedValue(new Error('模拟 changeStatus 失败'));
    const reload = vi.fn().mockResolvedValue(undefined);

    await expect(applyDefaultSwitch(row, changeStatus, reload)).resolves.toBe(
      false,
    );

    expect(reload).toHaveBeenCalledTimes(1);
    expect(row.status).toBe('1');
  });
});
