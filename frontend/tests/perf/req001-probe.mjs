/**
 * SPEC-001 §5 性能口径实测（本地生产构建 + 本地 Docker 栈）。
 *
 * 用法（前端目录）：`node tests/perf/req001-probe.mjs`
 * 输出 JSON：登录往返（3 次取中位数）/ 登录后首页可交互 / 路由切换（5 次取中位数）。
 *
 * 仅测量、不做断言；阈值由 SPEC-001 §5 定义（登录往返 ≤2s、首页可交互 ≤3s、
 * 路由切换 ≤500ms），结果写入 docs/evidence 与 trace。验证码从本地 Redis 读取，
 * 与 E2E 同一方式，仅限本地测试环境。
 *
 * 采样说明：本机存在周期性调度抖动（单次可 >1s），单样本会误判，因此登录与
 * 路由切换都取多次采样的中位数；全部原始样本一并输出，便于复核。
 */
import { execFileSync } from 'node:child_process';

import { chromium } from 'playwright';

const BASE_URL = process.env.PERF_BASE_URL ?? 'http://localhost:5666';
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'awp-redis';
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD ?? 'aoyou123';
const LOGIN_SAMPLES = 3;
const ROUTE_SAMPLES = 5;

function readCaptchaCode(uuid) {
  const raw = execFileSync(
    'docker',
    [
      'exec',
      REDIS_CONTAINER,
      'redis-cli',
      '--no-auth-warning',
      '-a',
      REDIS_PASSWORD,
      '--raw',
      'GET',
      `global:captcha_codes:${uuid}`,
    ],
    { encoding: 'utf8' },
  ).trim();
  const code = raw.replaceAll('"', '');
  if (!code) {
    throw new Error(`验证码 uuid=${uuid} 在 Redis 中没有对应明文`);
  }
  return code;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function attemptLogin(browser) {
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();

  /** @type {string | undefined} */
  let captchaUuid;
  page.on('response', (response) => {
    if (!new URL(response.url()).pathname.endsWith('/auth/code')) {
      return;
    }
    void response
      .json()
      .then((body) => {
        if (body?.data?.uuid) {
          captchaUuid = body.data.uuid;
        }
      })
      .catch(() => {});
  });

  let loginStartedAt = 0;
  let loginEndedAt = 0;
  page.on('request', (request) => {
    if (request.url().includes('/auth/login') && request.method() === 'POST') {
      loginStartedAt = Date.now();
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('/auth/login')) {
      loginEndedAt = Date.now();
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('img[alt="验证码"]').waitFor({ timeout: 60_000 });
  const uuidDeadline = Date.now() + 10_000;
  while (!captchaUuid && Date.now() < uuidDeadline) {
    await page.waitForTimeout(200);
  }
  if (!captchaUuid) {
    throw new Error('10s 内未取得 /auth/code 的 uuid');
  }

  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('密码').fill('admin123');
  await page.getByPlaceholder('验证码').fill(readCaptchaCode(captchaUuid));
  await page.locator('button[aria-label="login"]').click();
  await page.waitForURL(/\/index/, { timeout: 60_000 });
  if (!loginStartedAt || !loginEndedAt) {
    throw new Error('未捕获到 /auth/login 请求或响应');
  }
  return { context, loginMs: loginEndedAt - loginStartedAt };
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const loginSamples = [];
  let lastContext;
  for (let index = 0; index < LOGIN_SAMPLES; index++) {
    const attempt = await attemptLogin(browser);
    loginSamples.push(attempt.loginMs);
    if (lastContext) {
      await lastContext.close();
    }
    lastContext = attempt.context;
  }
  const storageState = await lastContext.storageState();
  await lastContext.close();

  // 新上下文直接打开 /index：测量「load 后首屏可点击」与「路由切换」。
  const context2 = await browser.newContext({
    locale: 'zh-CN',
    storageState,
    timezoneId: 'Asia/Shanghai',
  });
  const page2 = await context2.newPage();
  await page2.goto(`${BASE_URL}/index`, { waitUntil: 'load', timeout: 60_000 });
  const loadedAt = Date.now();
  const firstNavLink = page2.locator('aside a, nav a').first();
  await firstNavLink.waitFor({ state: 'visible', timeout: 15_000 });
  await firstNavLink.click({ trial: true, timeout: 15_000 });
  const homeInteractiveMs = Date.now() - loadedAt;

  const sidebar = page2.locator('aside');
  const openSystemMenu = async () => {
    await page2.getByText('系统管理', { exact: true }).first().click();
  };
  const switchTo = async (text, urlGlob) => {
    const item = sidebar.getByText(text, { exact: true }).first();
    if (!(await item.isVisible().catch(() => false))) {
      await openSystemMenu();
      await item.waitFor({ state: 'visible', timeout: 10_000 });
      // 等展开动画收敛后再计时，避免把菜单收起/展开的动画算进路由切换。
      await page2.waitForTimeout(300);
    }
    const startedAt = Date.now();
    let urlChangedAt = 0;
    let clickDoneAt = 0;
    await Promise.all([
      page2.waitForURL(urlGlob, { timeout: 15_000 }).then(() => {
        urlChangedAt = Date.now();
      }),
      // 用 DOM click 派发，避免把菜单展开动画的 actionability 等待算进路由切换。
      item.evaluate((el) => el.click()).then(() => {
        clickDoneAt = Date.now();
      }),
    ]);
    const totalMs = Date.now() - startedAt;
    if (process.env.PERF_DEBUG === '1') {
      console.log(
        JSON.stringify({
          click_cost_ms: clickDoneAt - startedAt,
          url_after_click_ms: urlChangedAt - clickDoneAt,
          total_ms: totalMs,
        }),
      );
    }
    return totalMs;
  };

  await openSystemMenu();
  await page2.waitForTimeout(300);
  // 首次切换含目标页面懒加载 chunk，单独记录，不计入「路由切换」口径。
  const coldRouteSwitchMs = await switchTo('用户管理', '**/system/user**');
  // 已访问页面之间的往返切换，取 5 次的中位数（不含接口耗时：URL 变化先于接口返回）。
  const targets = [
    ['角色管理', '**/system/role**'],
    ['用户管理', '**/system/user**'],
    ['角色管理', '**/system/role**'],
    ['用户管理', '**/system/user**'],
    ['角色管理', '**/system/role**'],
  ];
  const warmSamples = [];
  for (const [text, urlGlob] of targets) {
    warmSamples.push(await switchTo(text, urlGlob));
  }

  const result = {
    base_url: BASE_URL,
    checked_at: new Date().toISOString(),
    login_roundtrip_samples_ms: loginSamples,
    login_roundtrip_ms: median(loginSamples),
    home_interactive_ms: homeInteractiveMs,
    cold_route_switch_ms: coldRouteSwitchMs,
    route_switch_samples_ms: warmSamples,
    route_switch_ms: median(warmSamples),
  };
  console.log(JSON.stringify(result, null, 2));

  await context2.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
