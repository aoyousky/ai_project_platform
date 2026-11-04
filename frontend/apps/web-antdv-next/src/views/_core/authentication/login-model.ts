import type { AuthApi } from '#/api';

import { reactive, ref } from 'vue';

/** 图形验证码状态：`/auth/code` 的唯一真相源 */
export interface CaptchaState {
  /** 后端 `captchaEnabled`；false 时表单不渲染验证码字段（E-02） */
  enabled: boolean;
  /** `data:image/gif;base64,...`，点击刷新时变化（A-02） */
  imageSrc: string;
  /** 后端下发的验证码会话 uuid，随登录请求体提交 */
  uuid: string;
}

export interface LoginDeps {
  /** 拉取图形验证码（真实实现为 `getCodeImageApi`） */
  fetchCaptcha: () => Promise<AuthApi.CaptchaResult | undefined>;
  /** 提交登录（真实实现为 `authStore.authLogin`） */
  login: (params: Record<string, any>) => Promise<unknown>;
}

/**
 * 登录页状态与提交逻辑（与组件解耦，便于单测）。
 *
 * 边界：
 * - `captchaEnabled=false`：登录体不含 `code`/`uuid`（E-02）；
 * - 登录失败：重新拉取验证码，图片 src 变化（E-01、A-02）；
 * - 提交节流：并发调用只发出 1 次登录请求（E-14）。
 */
export function useLoginModel(deps: LoginDeps) {
  const captcha = reactive<CaptchaState>({
    enabled: true,
    imageSrc: '',
    uuid: '',
  });
  const submitting = ref(false);

  async function refreshCaptcha() {
    const result = await deps.fetchCaptcha();
    captcha.enabled = result?.captchaEnabled !== false;
    captcha.uuid = captcha.enabled ? (result?.uuid ?? '') : '';
    captcha.imageSrc =
      captcha.enabled && result?.img
        ? `data:image/gif;base64,${result.img}`
        : '';
  }

  async function submit(values: Record<string, any>) {
    if (submitting.value) {
      return;
    }
    submitting.value = true;
    try {
      await deps.login({
        password: values?.password,
        username: values?.username,
        ...(captcha.enabled
          ? { code: values?.code, uuid: captcha.uuid }
          : {}),
      });
    } catch (error) {
      // 验证码一次性：失败后必须重新获取（E-01）
      await refreshCaptcha();
      throw error;
    } finally {
      submitting.value = false;
    }
  }

  return {
    captcha,
    refreshCaptcha,
    submit,
    submitting,
  };
}
