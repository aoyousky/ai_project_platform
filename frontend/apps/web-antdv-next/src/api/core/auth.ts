import { requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数（契约 §1 POST /auth/login） */
  export interface LoginParams {
    code?: string;
    grantType?: string;
    password?: string;
    username?: string;
    uuid?: string;
  }

  /** 登录接口返回的 `data` */
  export interface LoginResult {
    access_token: string;
    expire_in: number;
  }

  /** 图形验证码（契约 §1 GET /auth/code） */
  export interface CaptchaResult {
    captchaEnabled: boolean;
    img: string;
    uuid: string;
  }
}

/**
 * 登录。
 * 请求体由传输层加密（`isEncrypt` 头），`clientId` / `grantType` 由前端补齐（plus-ui 既有行为）。
 * 返回 Vben 会话层期望的 `{ accessToken }`。
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const result = await requestClient.post<AuthApi.LoginResult>(
    '/auth/login',
    {
      ...data,
      clientId: import.meta.env.VITE_APP_CLIENT_ID,
      grantType: data.grantType ?? 'password',
    },
    {
      headers: {
        isEncrypt: 'true',
        isToken: false,
        repeatSubmit: false,
      },
    },
  );

  return { accessToken: result?.access_token ?? '' };
}

/**
 * 获取图形验证码。
 */
export async function getCodeImageApi() {
  return requestClient.get<AuthApi.CaptchaResult>('/auth/code', {
    headers: { isToken: false },
  });
}

/**
 * 退出登录。
 * 服务端注销令牌；前端无论成败都清本地会话（FR-004 / E-13，由 store 保证）。
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

/**
 * 获取当前用户权限码。
 * RuoYi 不单独提供权限码接口，权限随 `/system/user/getInfo` 下发（契约 §2）。
 */
export async function getAccessCodesApi(): Promise<string[]> {
  const info = await requestClient.get<{
    permissions?: string[];
  }>('/system/user/getInfo');
  return info?.permissions ?? [];
}
