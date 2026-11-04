import { describe, expect, it, vi } from 'vitest';

// 只测字段装配与提交流程，不加载 UI 库与本项目的 schema 校验实现，避免重量级 barrel。
vi.mock('@vben/common-ui', () => ({
  z: {
    string: () => ({
      min: () => ({}),
    }),
  },
}));

vi.mock('@vben/locales', () => ({
  $t: (key: string) => key,
}));

const { useLoginModel } = await import('./login-model');
const { buildLoginSchema } = await import('./login-schema');

const DUMMY_CAPTCHA_COMPONENT = { name: 'DummyCaptcha' };

function enabledCaptcha() {
  return {
    captchaEnabled: true,
    img: 'AAAA',
    uuid: 'uuid-1',
  };
}

function disabledCaptcha() {
  return {
    captchaEnabled: false,
    img: '',
    uuid: '',
  };
}

describe('登录模型（US1）', () => {
  it('captchaEnabled=true 时渲染验证码字段，登录体带 code/uuid', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const model = useLoginModel({
      fetchCaptcha: vi.fn().mockResolvedValue(enabledCaptcha()),
      login,
    });
    await model.refreshCaptcha();

    const fields = buildLoginSchema(
      model.captcha,
      DUMMY_CAPTCHA_COMPONENT,
      model.refreshCaptcha,
    ).map((item) => item.fieldName);
    expect(fields).toEqual(['username', 'password', 'code']);
    expect(model.captcha.imageSrc).toBe('data:image/gif;base64,AAAA');

    await model.submit({
      code: '1234',
      password: 'admin123',
      username: 'admin',
    });
    expect(login).toHaveBeenCalledWith({
      code: '1234',
      password: 'admin123',
      username: 'admin',
      uuid: 'uuid-1',
    });
  });

  it('captchaEnabled=false 时不渲染验证码字段，登录体不含 code/uuid（E-02）', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const model = useLoginModel({
      fetchCaptcha: vi.fn().mockResolvedValue(disabledCaptcha()),
      login,
    });
    await model.refreshCaptcha();

    const fields = buildLoginSchema(
      model.captcha,
      DUMMY_CAPTCHA_COMPONENT,
      model.refreshCaptcha,
    ).map((item) => item.fieldName);
    expect(fields).toEqual(['username', 'password']);

    await model.submit({
      code: 'ignored',
      password: 'admin123',
      username: 'admin',
    });
    expect(login).toHaveBeenCalledWith({
      password: 'admin123',
      username: 'admin',
    });
  });

  it('登录失败后重新拉取验证码，图片 src 变化（E-01、A-02）', async () => {
    const fetchCaptcha = vi
      .fn()
      .mockResolvedValueOnce(enabledCaptcha())
      .mockResolvedValueOnce({
        captchaEnabled: true,
        img: 'BBBB',
        uuid: 'uuid-2',
      });
    const model = useLoginModel({
      fetchCaptcha,
      login: vi.fn().mockRejectedValue({ code: 500, msg: '验证码错误' }),
    });
    await model.refreshCaptcha();
    const before = model.captcha.imageSrc;

    await expect(
      model.submit({ code: '0000', password: 'admin123', username: 'admin' }),
    ).rejects.toMatchObject({ msg: '验证码错误' });

    expect(before).toBe('data:image/gif;base64,AAAA');
    expect(model.captcha.imageSrc).toBe('data:image/gif;base64,BBBB');
    expect(model.captcha.uuid).toBe('uuid-2');
    expect(model.submitting.value).toBe(false);
  });

  it('连续提交 3 次只发出 1 个登录请求（E-14）', async () => {
    let resolveLogin: (value?: unknown) => void = () => {};
    const login = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const model = useLoginModel({
      fetchCaptcha: vi.fn().mockResolvedValue(enabledCaptcha()),
      login,
    });
    await model.refreshCaptcha();
    const values = { code: '1234', password: 'admin123', username: 'admin' };

    const first = model.submit(values);
    const second = model.submit(values);
    const third = model.submit(values);
    resolveLogin();
    await Promise.all([first, second, third]);

    expect(login).toHaveBeenCalledTimes(1);
  });
});
