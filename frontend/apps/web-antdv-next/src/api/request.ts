/**
 * RuoYi-Vue-Plus 传输适配（SPEC A-01、A-02、A-06、FR-012）
 *
 * 与 Vben 默认模板的差异：
 * - 成功码是 `code === 200`（不是 0）；
 * - 分页响应 `{code,msg,rows,total}` 没有 `data` 字段，按 `rows` 是否存在分派（C1）；
 * - 失败时展示后端 `msg` 原文（FR-012），不使用 HTTP 状态码通用文案；
 * - 登录等请求可选加密：`isEncrypt: true` 时生成 AES 密钥，RSA 加密后放 `encrypt-key` 头；
 * - 响应带 `encrypt-key` 头时先解密再解析；
 * - RuoYi 用 HTTP 200 + `code: 401` 表达未认证，需单独触发重新认证（E-12）。
 */
import type { AxiosResponse, RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'antdv-next';

import { useAuthStore } from '#/store';

import {
  buildEncryptHeader,
  decryptResponseBody,
  ENCRYPT_KEY_HEADER,
  encryptByAes,
} from './core/ruoyi-crypto';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

/** 302 以外、非 HTTP 层面的业务未认证码（RuoYi 固定值，不得自创） */
const BUSINESS_UNAUTHORIZED = 401;
/** RuoYi 成功码 */
const SUCCESS_CODE = 200;

/**
 * 响应体 → 调用方拿到的数据。
 * 分页响应优先：`{code,msg,rows,total}` → `{rows,total}`；否则取 `data`。
 */
export function resolveResponseData(body: any): any {
  if (body && typeof body === 'object' && 'rows' in body) {
    return { rows: body.rows, total: body.total };
  }
  return body?.data;
}

/**
 * 从错误对象中取出后端 `msg`。拦截器链上错误可能有两种形态：
 * axios 错误（含 `response`）或 `request()` 已拆包后的响应体。
 */
export function resolveErrorMessage(error: any): string {
  const msg =
    error?.response?.data?.msg ??
    error?.data?.msg ??
    error?.msg ??
    error?.message;
  return typeof msg === 'string' ? msg : '';
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /** 重新认证进行中标记：并发 401 只处理一次（E-12） */
  let reAuthenticating = false;

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    if (reAuthenticating) {
      return;
    }
    reAuthenticating = true;
    try {
      console.warn('Access token or refresh token is invalid or expired. ');
      const accessStore = useAccessStore();
      const authStore = useAuthStore();
      accessStore.setAccessToken(null);
      if (
        preferences.app.loginExpiredMode === 'modal' &&
        accessStore.isAccessChecked
      ) {
        accessStore.setLoginExpired(true);
      } else {
        await authStore.logout();
      }
    } finally {
      reAuthenticating = false;
    }
  }

  /**
   * 刷新token逻辑。
   * RuoYi-Vue-Plus 没有刷新令牌接口（`preferences.app.enableRefreshToken` 固定为 false），
   * 保留该函数只为满足拦截器签名；被调用说明配置出错，必须显式失败而不是静默重试。
   */
  async function doRefreshToken(): Promise<string> {
    throw new Error('RuoYi 后端未提供刷新令牌接口，enableRefreshToken 必须为 false');
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();
      const headers = config.headers as Record<string, any>;

      headers.Authorization = formatToken(accessStore.accessToken);
      headers['Accept-Language'] = preferences.app.locale;
      // 后端 RuoYi 的国际化读取 Content-Language（plus-ui 既有行为）
      headers['Content-Language'] = preferences.app.locale;
      headers['clientid'] = import.meta.env.VITE_APP_CLIENT_ID;

      // 传输加密：仅 POST/PUT 且调用方显式声明 isEncrypt（plus-ui 约定）。
      // 默认开启，只有显式 VITE_APP_ENCRYPT=false 才关闭（后端也须同步关闭）。
      const method = (config.method ?? '').toUpperCase();
      const isEncrypt =
        headers.isEncrypt === 'true' &&
        (method === 'POST' || method === 'PUT') &&
        import.meta.env.VITE_APP_ENCRYPT !== 'false';

      if (isEncrypt) {
        const { aesKey, encryptKey } = buildEncryptHeader(
          import.meta.env.VITE_APP_RSA_PUBLIC_KEY,
        );
        headers[ENCRYPT_KEY_HEADER] = encryptKey;
        config.data = encryptByAes(
          typeof config.data === 'string'
            ? config.data
            : JSON.stringify(config.data ?? {}),
          aesKey,
        );
        // axios 默认 transformRequest 会把字符串当作 JSON 再 stringify（外加引号），
        // 后端拿到的是 `"密文"` 而不是密文。密文必须原样发送。
        config.transformRequest = [(data: any) => data];
      }

      // 内部开关不外传
      delete headers.isEncrypt;
      delete headers.isToken;
      delete headers.repeatSubmit;

      return config;
    },
  });

  // 响应解密：必须在任何解析型拦截器之前（契约 §0）
  client.addResponseInterceptor({
    fulfilled: (response: AxiosResponse) => {
      const encryptKey = response.headers?.[ENCRYPT_KEY_HEADER];
      if (encryptKey && typeof response.data === 'string' && response.data) {
        response.data = JSON.parse(
          decryptResponseBody(
            response.data,
            String(encryptKey),
            import.meta.env.VITE_APP_RSA_PRIVATE_KEY,
          ),
        );
      }
      return response;
    },
  });

  // RuoYi 的业务未认证：HTTP 200 + code 401
  client.addResponseInterceptor({
    fulfilled: async (response: AxiosResponse) => {
      if (response.data?.code === BUSINESS_UNAUTHORIZED) {
        await doReAuthenticate();
        throw Object.assign({}, response, { response });
      }
      return response;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: resolveResponseData,
      successCode: SUCCESS_CODE,
    }),
  );

  // HTTP 401 的处理（RuoYi 主要走业务 401，此处兜底）
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用错误处理：展示后端 msg 原文（FR-012），401 已在上方处理，不再重复提示
  client.addResponseInterceptor({
    rejected: (error: any) => {
      if (error?.response?.data?.code === BUSINESS_UNAUTHORIZED) {
        return Promise.reject(error);
      }
      const msg = resolveErrorMessage(error);
      if (msg) {
        message.error(msg);
      }
      return Promise.reject(error);
    },
  });

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
