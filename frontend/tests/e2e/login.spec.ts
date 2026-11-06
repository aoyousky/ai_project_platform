import { expect, test } from '@playwright/test';

import {
  APP_ENTRY_TIMEOUT,
  isBackendUp,
  loginWithCaptcha,
  readCaptchaCode,
  reserveCaptchaSlot,
  waitForCaptchaUuid,
} from './helpers';

/**
 * T020：登录页验收（A-01、A-02、E-01、E-02、E-14）。
 * 依赖本地 Docker 后端栈与可读取 Redis 的验证码（quickstart §1）。
 */
test.describe('登录', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isBackendUp()),
      '本地后端栈未启动（deploy/docker compose up -d）',
    );
  });

  test('验证码错误：展示后端 msg、刷新验证码、保留用户名（A-02、E-01）', async ({
    page,
  }) => {
    // 记录本页面的取码响应：A-02 断言「刷新」，失败时必须能看出是没请求、
    // 请求被限流，还是请求成功但界面没更新。
    const captchaEvents: string[] = [];
    page.on('response', (response) => {
      if (!new URL(response.url()).pathname.endsWith('/auth/code')) {
        return;
      }
      void response
        .json()
        .then((body) => {
          captchaEvents.push(
            `code=${body?.code} img=${body?.data?.img ? 'yes' : 'no'}`,
          );
        })
        .catch(() => captchaEvents.push('响应无法解析'));
    });

    const uuid = await waitForCaptchaUuid(page);
    const realCode = readCaptchaCode(uuid).toLowerCase();
    const wrongCode = realCode === 'zzzz' ? 'yyyy' : 'zzzz';

    const captchaImage = page.locator('img[alt="验证码"]');
    const beforeSrc = await captchaImage.getAttribute('src');

    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('admin123');
    await page.getByPlaceholder('验证码').fill(wrongCode);

    // antdv 的 message 提示有固定存活时间，慢宿主上可能在断言开始轮询前就已消失，
    // 直接 `getByText(...).toBeVisible()` 会与提示的生命周期赛跑。点击前挂
    // MutationObserver 记录新渲染的文本，断言“后端 msg 确实展示过”。
    await page.evaluate(() => {
      const host = window as unknown as { __messages?: string[] };
      host.__messages = [];
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            const text = node.textContent?.trim();
            if (text) {
              host.__messages?.push(text);
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/auth/login'),
    );
    // 登录失败会自动请求一次 /auth/code（A-02 要断言的正是它）；
    // 先排一个名额，避免这次刷新撞上后端限流窗口。
    await reserveCaptchaSlot(page);
    await page.locator('button[aria-label="login"]').click();
    const loginResponse = await responsePromise;
    const body = await loginResponse.json();

    expect(body.code).not.toBe(200);
    expect(typeof body.msg).toBe('string');
    expect(body.msg.length).toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const host = window as unknown as { __messages?: string[] };
            return (host.__messages ?? []).join('\n');
          }),
        { timeout: APP_ENTRY_TIMEOUT },
      )
      .toContain(body.msg);
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByPlaceholder('请输入用户名')).toHaveValue('admin');
    // 刷新由登录失败分支自动触发；慢宿主上取码 + 出图可能超过默认 15s。
    // 用带诊断信息的轮询：失败时说明是「没有取码请求」「请求被拒」还是「界面没更新」。
    let refreshed = false;
    let afterSrc: null | string = null;
    const deadline = Date.now() + APP_ENTRY_TIMEOUT;
    while (Date.now() < deadline) {
      afterSrc = await captchaImage.getAttribute('src');
      if (afterSrc !== beforeSrc) {
        refreshed = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    expect(
      refreshed,
      `验证码图片未刷新；取码响应=[${captchaEvents.join(' | ')}]；` +
        `刷新前后 src 长度=${beforeSrc?.length}/${afterSrc?.length}`,
    ).toBe(true);
  });

  test('点击验证码图片可刷新', async ({ page }) => {
    await waitForCaptchaUuid(page);
    const captchaImage = page.locator('img[alt="验证码"]');
    const beforeSrc = await captchaImage.getAttribute('src');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/auth/code'),
    );
    await captchaImage.click();
    await responsePromise;

    await expect
      .poll(async () => captchaImage.getAttribute('src'))
      .not.toBe(beforeSrc);
  });

  test('登录成功后落到 /index（A-01）', async ({ page }) => {
    let submittedAt = 0;
    page.on('request', (request) => {
      if (
        request.url().includes('/auth/login') &&
        request.method() === 'POST'
      ) {
        submittedAt = Date.now();
      }
    });

    // loginWithCaptcha 内部只校验 code=200；A-01 还要求令牌非空，故在此单独取响应体。
    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/auth/login') &&
        response.request().method() === 'POST',
    );
    await loginWithCaptcha(page);

    const body = (await (await loginResponse).json()) as {
      code?: number;
      data?: { access_token?: string };
    };
    expect(body.code).toBe(200);
    expect(typeof body.data?.access_token).toBe('string');
    expect(body.data?.access_token?.length ?? 0).toBeGreaterThan(0);

    // A-01 的 5s 是「提交后」口径；不能复用 APP_ENTRY_TIMEOUT（慢宿主 60s 预算）。
    await expect(page).toHaveURL(/\/index/, { timeout: 5_000 });
    expect(submittedAt).toBeGreaterThan(0);
    const elapsedMs = Date.now() - submittedAt;
    expect(elapsedMs, `提交登录到落到 /index 用时 ${elapsedMs}ms`).toBeLessThan(
      5_000,
    );
  });

  test('连续点击 3 次只发出 1 个登录请求（E-14）', async ({ page }) => {
    const uuid = await waitForCaptchaUuid(page);
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('admin123');
    await page.getByPlaceholder('验证码').fill(readCaptchaCode(uuid));

    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/auth/login')) {
        loginRequests += 1;
      }
    });

    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-label="login"]',
      );
      button?.click();
      button?.click();
      button?.click();
    });

    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    expect(loginRequests).toBe(1);
  });

  test('不渲染手机号/扫码/注册/忘记密码入口（US1）', async ({ page }) => {
    await waitForCaptchaUuid(page);

    await expect(page.getByText('手机登录')).toHaveCount(0);
    await expect(page.getByText('扫码登录')).toHaveCount(0);
    await expect(page.getByText('忘记密码?')).toHaveCount(0);
    await expect(page.getByText('创建账号')).toHaveCount(0);
    await expect(page.getByText('快速选择账号')).toHaveCount(0);
  });
});
