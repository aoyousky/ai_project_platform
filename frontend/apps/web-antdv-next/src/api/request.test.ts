import type { AxiosResponse, InternalAxiosRequestConfig } from '@vben/request';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decryptBase64,
  decryptByAes,
  decryptByRsa,
  encryptBase64,
  encryptByAes,
  encryptByRsa,
  generateAesKey,
} from './core/ruoyi-crypto';

const setAccessToken = vi.fn();
const setLoginExpired = vi.fn();
const logout = vi.fn();
const errorToast = vi.fn();

vi.mock('antdv-next', () => ({
  message: { error: errorToast, success: vi.fn(), warning: vi.fn() },
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: 'token-123',
    isAccessChecked: true,
    setAccessToken,
    setLoginExpired,
  }),
}));

vi.mock('#/store', () => ({
  useAuthStore: () => ({ logout }),
}));

const { requestClient } = await import('#/api/request');

/** 前端 `VITE_APP_RSA_PUBLIC_KEY`：请求方向加密用 */
const FRONTEND_ENCRYPT_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==';
/** 后端 `api-decrypt.privateKey`：请求方向解密用 */
const BACKEND_DECRYPT_PRIVATE_KEY =
  'MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAqhHyZfSsYourNxaY7Nt+PrgrxkiA50efORdI5U5lsW79MmFnusUA355oaSXcLhu5xxB38SMSyP2KvuKNPuH3owIDAQABAkAfoiLyL+Z4lf4Myxk6xUDgLaWGximj20CUf+5BKKnlrK+Ed8gAkM0HqoTt2UZwA5E2MzS4EI2gjfQhz5X28uqxAiEA3wNFxfrCZlSZHb0gn2zDpWowcSxQAgiCstxGUoOqlW8CIQDDOerGKH5OmCJ4Z21v+F25WaHYPxCFMvwxpcw99EcvDQIgIdhDTIqD2jfYjPTY8Jj3EDGPbH2HHuffvflECt3Ek60CIQCFRlCkHpi7hthhYhovyloRYsM+IS9h/0BzlEAuO0ktMQIgSPT3aFAgJYwKpqRYKlLDVcflZFCKY7u3UP8iWi1Qw0Y=';
/** 后端 `api-decrypt.publicKey`：响应方向加密用 */
const BACKEND_RESPONSE_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJnNwrj4hi/y3CCJu868ghCG5dUj8wZK++RNlTLcXoMmdZWEQ/u02RgD5LyLAXGjLOjbMtC+/J9qofpSGTKSx/MCAwEAAQ==';
/** 前端 `VITE_APP_RSA_PRIVATE_KEY`：响应方向解密用 */
const FRONTEND_DECRYPT_PRIVATE_KEY =
  'MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAmc3CuPiGL/LcIIm7zryCEIbl1SPzBkr75E2VMtxegyZ1lYRD+7TZGAPkvIsBcaMs6Nsy0L78n2qh+lIZMpLH8wIDAQABAkEAk82Mhz0tlv6IVCyIcw/s3f0E+WLmtPFyR9/WtV3Y5aaejUkU60JpX4m5xNR2VaqOLTZAYjW8Wy0aXr3zYIhhQQIhAMfqR9oFdYw1J9SsNc+CrhugAvKTi0+BF6VoL6psWhvbAiEAxPPNTmrkmrXwdm/pQQu3UOQmc2vCZ5tiKpW10CgJi8kCIFGkL6utxw93Ncj4exE/gPLvKcT+1Emnoox+O9kRXss5AiAMtYLJDaLEzPrAWcZeeSgSIzbL+ecokmFKSDDcRske6QIgSMkHedwND1olF8vlKsJUGK3BcdtM8w4Xq7BpSBwsloE=';

function fakeResponse(
  config: InternalAxiosRequestConfig,
  data: any,
  headers: Record<string, string> = {},
): AxiosResponse {
  return {
    config,
    data,
    headers,
    status: 200,
    statusText: 'OK',
  } as AxiosResponse;
}

describe('request（RuoYi 响应封装适配）', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_CLIENT_ID', 'client-id-from-env');
    vi.stubEnv('VITE_APP_RSA_PRIVATE_KEY', FRONTEND_DECRYPT_PRIVATE_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('分页响应 `{code,msg,rows,total}` → 返回 `{rows,total}`（C1、Golden Sample 3）', async () => {
    const rows = [{ postId: 1, postName: '测试岗位' }];
    const result = await requestClient.get('/system/post/list', {
      adapter: async (config) =>
        fakeResponse(config, { code: 200, msg: '查询成功', rows, total: 1 }),
    });

    expect(result).toEqual({ rows, total: 1 });
  });

  it('单对象响应 `{code,msg,data}` → 返回 `data`', async () => {
    const result = await requestClient.get('/system/user/getInfo', {
      adapter: async (config) =>
        fakeResponse(config, {
          code: 200,
          data: { user: { userName: 'admin' } },
          msg: '操作成功',
        }),
    });

    expect(result).toEqual({ user: { userName: 'admin' } });
  });

  it('分页响应 rows 为空数组时仍返回 `{rows:[],total:0}`（E-10）', async () => {
    const result = await requestClient.get('/system/post/list', {
      adapter: async (config) =>
        fakeResponse(config, { code: 200, msg: '查询成功', rows: [], total: 0 }),
    });

    expect(result).toEqual({ rows: [], total: 0 });
  });

  it('业务失败抛出后端 `msg`，并以该文案提示（FR-012）', async () => {
    const promise = requestClient.post(
      '/system/post',
      {},
      {
        adapter: async (config) =>
          fakeResponse(config, { code: 500, msg: '部门id不能为空' }),
      },
    );

    await expect(promise).rejects.toMatchObject({
      code: 500,
      msg: '部门id不能为空',
    });
    expect(errorToast).toHaveBeenCalledWith('部门id不能为空');
  });

  it('业务 401（HTTP 200 + code=401）触发重新认证，且不弹通用错误（E-12）', async () => {
    const promise = requestClient.get('/system/user/getInfo', {
      adapter: async (config) =>
        fakeResponse(config, { code: 401, msg: '认证失败，无法访问系统资源' }),
    });

    await expect(promise).rejects.toBeTruthy();
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(errorToast).not.toHaveBeenCalled();
  });

  it('响应头带 encrypt-key 时先解密再解析（契约 §0）', async () => {
    const aesKey = generateAesKey();
    const body = { code: 200, data: { secret: '解密后的值' }, msg: '操作成功' };
    const encryptKey = encryptByRsa(
      encryptBase64(aesKey),
      BACKEND_RESPONSE_PUBLIC_KEY,
    );

    const result = await requestClient.get('/system/user/getInfo', {
      adapter: async (config) =>
        fakeResponse(
          config,
          encryptByAes(JSON.stringify(body), aesKey),
          { 'encrypt-key': encryptKey },
        ),
    });

    expect(result).toEqual({ secret: '解密后的值' });
  });

  it('POST + isEncrypt：请求体 AES 加密，密钥经 RSA 放 encrypt-key 头（Golden Sample 1）', async () => {
    vi.stubEnv('VITE_APP_ENCRYPT', 'true');
    vi.stubEnv('VITE_APP_RSA_PUBLIC_KEY', FRONTEND_ENCRYPT_PUBLIC_KEY);

    let captured: any;
    await requestClient.post(
      '/auth/login',
      { password: 'admin123', username: 'admin' },
      {
        adapter: async (config) => {
          captured = config;
          return fakeResponse(config, {
            code: 200,
            data: { access_token: 'token-abc', expire_in: 7200 },
            msg: '操作成功',
          });
        },
        headers: { isEncrypt: 'true' },
      },
    );

    const encryptKey = captured.headers['encrypt-key'];
    expect(encryptKey).toBeTruthy();
    expect(typeof captured.data).toBe('string');
    expect(captured.data).not.toContain('admin123');

    // 后端视角：RSA 私钥解出 AES 密钥，再解出明文
    const aesKey = decryptBase64(
      decryptByRsa(encryptKey, BACKEND_DECRYPT_PRIVATE_KEY),
    );
    expect(JSON.parse(decryptByAes(captured.data, aesKey))).toEqual({
      password: 'admin123',
      username: 'admin',
    });
    // 内部开关不外传
    expect(captured.headers.isEncrypt).toBeUndefined();
  });

  it('请求头带 clientid 与 Bearer 令牌（契约 §0）', async () => {
    let captured: any;
    await requestClient.get('/system/post/list', {
      adapter: async (config) => {
        captured = config;
        return fakeResponse(config, { code: 200, rows: [], total: 0 });
      },
    });

    expect(captured.headers['clientid']).toBe('client-id-from-env');
    expect(captured.headers.Authorization).toBe('Bearer token-123');
  });
});
