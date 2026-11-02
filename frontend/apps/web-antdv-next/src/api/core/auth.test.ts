import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  baseRequestClient: { get: vi.fn(), post: vi.fn() },
  requestClient: { get, post },
}));

const { getAccessCodesApi, getCodeImageApi, loginApi, logoutApi } = await import(
  './auth'
);

describe('auth API（契约 §1）', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_CLIENT_ID', 'client-id-from-env');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('登录补齐 clientId/grantType，并要求传输层加密', async () => {
    post.mockResolvedValue({ access_token: 'token-abc', expire_in: 7200 });

    const result = await loginApi({
      code: '1234',
      password: 'admin123',
      username: 'admin',
      uuid: 'ab12',
    });

    expect(post).toHaveBeenCalledWith(
      '/auth/login',
      {
        clientId: 'client-id-from-env',
        code: '1234',
        grantType: 'password',
        password: 'admin123',
        username: 'admin',
        uuid: 'ab12',
      },
      {
        headers: {
          isEncrypt: 'true',
          isToken: false,
          repeatSubmit: false,
        },
      },
    );
    // 后端字段 access_token → 会话层 accessToken
    expect(result).toEqual({ accessToken: 'token-abc' });
  });

  it('验证码接口不携带令牌', async () => {
    get.mockResolvedValue({
      captchaEnabled: true,
      img: '/9j/4AAQ',
      uuid: 'ab12',
    });

    await getCodeImageApi();

    expect(get).toHaveBeenCalledWith('/auth/code', {
      headers: { isToken: false },
    });
  });

  it('登出走带令牌的 requestClient', async () => {
    post.mockResolvedValue(undefined);

    await logoutApi();

    expect(post).toHaveBeenCalledWith('/auth/logout');
  });

  it('权限码取自 getInfo.permissions；缺省为空数组', async () => {
    get.mockResolvedValueOnce({ permissions: ['system:post:add'] });
    await expect(getAccessCodesApi()).resolves.toEqual(['system:post:add']);

    get.mockResolvedValueOnce({ permissions: [] });
    await expect(getAccessCodesApi()).resolves.toEqual([]);

    get.mockResolvedValueOnce({});
    await expect(getAccessCodesApi()).resolves.toEqual([]);
  });
});
