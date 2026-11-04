import type { VbenFormSchema } from '@vben/common-ui';

import type { CaptchaState } from './login-model';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

/**
 * 登录表单 schema。
 *
 * `captchaEnabled=false` 时不生成验证码字段（E-02）；
 * 验证码组件由调用方注入（markRaw 后的 SFC），使本模块不依赖 UI 框架。
 */
export function buildLoginSchema(
  captcha: CaptchaState,
  captchaComponent: any,
  refreshCaptcha: () => Promise<void> | void,
): VbenFormSchema[] {
  const schemas: VbenFormSchema[] = [
    {
      component: 'VbenInput',
      componentProps: {
        autocomplete: 'username',
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        autocomplete: 'current-password',
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];

  if (captcha.enabled) {
    schemas.push({
      component: captchaComponent,
      componentProps: {
        imageSrc: captcha.imageSrc,
        onRefresh: refreshCaptcha,
      },
      fieldName: 'code',
      rules: z.string().min(1, { message: $t('authentication.code') }),
    });
  }

  return schemas;
}
