import { describe, expect, it } from 'vitest';

import {
  applicationRows,
  formatStatusTimestamp,
  isSensitiveKey,
  maskPropertySources,
  tailLines,
} from './admin-page-logic';

/**
 * SPEC-008 §4.1：Admin 监控的数据转换。
 * 空值语义与真实 0 分开；敏感键一律脱敏（A-11）。
 */
describe('admin-page-logic', () => {
  it('应用行：name/status/实例数；缺 instances 视为 0', () => {
    expect(
      applicationRows([
        {
          name: 'aoyou-admin',
          status: 'UP',
          instances: [{ id: 'i-1', statusInfo: { status: 'UP' } }],
        },
        { name: 'broken', status: 'DOWN' },
      ]),
    ).toEqual([
      { name: 'aoyou-admin', status: 'UP', instanceCount: 1 },
      { name: 'broken', status: 'DOWN', instanceCount: 0 },
    ]);
  });

  it('状态时间：UTC ISO 转 Asia/Shanghai 的 YYYY-MM-DD HH:mm:ss；空值显示「—」', () => {
    expect(formatStatusTimestamp('2026-11-12T00:30:57.753291Z')).toBe(
      '2026-11-12 08:30:57',
    );
    expect(formatStatusTimestamp(null)).toBe('—');
    expect(formatStatusTimestamp(undefined)).toBe('—');
    expect(formatStatusTimestamp('')).toBe('—');
    expect(formatStatusTimestamp('not-a-date')).toBe('—');
  });

  it('敏感键只按末段精确匹配，避免 keyboard 之类误伤', () => {
    expect(isSensitiveKey('spring.datasource.password')).toBe(true);
    expect(isSensitiveKey('DB_PASSWORD')).toBe(true);
    expect(isSensitiveKey('metadata.userpassword')).toBe(true);
    expect(isSensitiveKey('accessKey')).toBe(true);
    expect(isSensitiveKey('my.secretkey')).toBe(true);
    expect(isSensitiveKey('auth.token')).toBe(true);
    expect(isSensitiveKey('keyboard.layout')).toBe(false);
    expect(isSensitiveKey('server.port')).toBe(false);
    expect(isSensitiveKey('monkey')).toBe(false);
  });

  it('环境配置：敏感值显示 ***，非敏感值原样，空对象为空行', () => {
    expect(
      maskPropertySources([
        {
          name: 'systemEnvironment',
          properties: {
            DB_PASSWORD: 'secret-value',
            'keyboard.layout': 'us',
            'server.port': '8080',
          },
        },
        { name: 'empty', properties: {} },
      ]),
    ).toEqual([
      {
        name: 'systemEnvironment',
        rows: [
          { key: 'DB_PASSWORD', value: '***' },
          { key: 'keyboard.layout', value: 'us' },
          { key: 'server.port', value: '8080' },
        ],
      },
      { name: 'empty', rows: [] },
    ]);
  });

  it('日志只保留尾部 N 行；空文本返回空数组', () => {
    expect(tailLines('a\nb\nc', 2)).toEqual(['b', 'c']);
    expect(tailLines('a\nb\nc\n', 2)).toEqual(['b', 'c']);
    expect(tailLines('', 200)).toEqual([]);
    expect(tailLines('a', 1)).toEqual(['a']);
  });

  it('日志令牌样式字符串脱敏：Bearer 与 SNAIL-JOB-AUTH 后的值显示 ***', () => {
    expect(
      tailLines(
        [
          'curl -H "Authorization: Bearer eyJhbGciOi.sig" http://localhost',
          'SNAIL-JOB-AUTH: abc.def; namespace=dev',
          'normal line keeps the token word visible',
        ].join('\n'),
        10,
      ),
    ).toEqual([
      'curl -H "Authorization: Bearer ***" http://localhost',
      'SNAIL-JOB-AUTH: ***; namespace=dev',
      'normal line keeps the token word visible',
    ]);
  });
});
