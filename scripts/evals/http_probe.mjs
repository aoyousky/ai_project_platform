#!/usr/bin/env node
/**
 * 评测 HTTP 探针（REQ-20261103-002 / REQ-20261104-003 共用）。
 *
 * 由 scripts/evals/run_eval.py 通过 stdin 传入已替换 `${EVAL_*}` 占位符的用例 JSON。
 * 令牌只在内存中使用：用 Playwright 走真实登录页拿到 accessToken，
 * 再注入 Authorization / clientid，不写文件、不写日志、不出现在输出中。
 *
 * 用例内可声明 `capture: { NAME: "data.roleId" }`，后续步骤用 `${NAME}` 引用，
 * 用于“新建 → 按返回 ID 修改/删除”的链路断言。
 *
 * 输出（stdout）：{ cases: [{ id, assertion, passed, errors, latency_ms }] }
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname } from 'node:path';

const require = createRequire(
  new URL('../../frontend/package.json', import.meta.url),
);
const { chromium } = require('playwright');

const input = await readStdin();
const {
  baseUrl,
  frontendUrl,
  clientId,
  redisContainer = 'awp-redis',
  redisPassword = 'aoyou123',
  credentials = {},
  directTokens = {},
  captchaLedger = '',
  cases = [],
} = input;

const tokens = {};
const loginErrors = {};
const CAPTURE_PLACEHOLDER = /\$\{([A-Z0-9_]+)\}/g;
const browser = await chromium.launch({ headless: true });

/**
 * `/auth/code` 限流预算（后端 10 次/60s/IP）。
 *
 * 探针与 Playwright E2E 共用 run_eval.py 生成的账本文件（`captchaLedger`），
 * 按 5 次/60s 排队，留余量给登录页自身的自动刷新。账本不存在时退化为
 * 不限流——单独调试探针用，评测器每次执行都会新建一个空账本。
 */
const CAPTCHA_WINDOW_MS = 60_000;
// 与 frontend/tests/e2e/helpers.ts 保持一致：5 次/60s，给页面自发刷新留余量。
const CAPTCHA_BUDGET = 5;

function readLedger() {
  if (!captchaLedger) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(captchaLedger, 'utf8'));
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'number')
      : [];
  } catch {
    return [];
  }
}

async function paceCaptcha() {
  if (!captchaLedger) {
    return;
  }
  for (;;) {
    const now = Date.now();
    const log = readLedger().filter((at) => now - at <= CAPTCHA_WINDOW_MS);
    if (log.length < CAPTCHA_BUDGET) {
      log.push(now);
      try {
        writeFileSync(captchaLedger, JSON.stringify(log));
      } catch {
        // 记账失败只影响限流排队，不阻断登录
      }
      return;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, log[0] + CAPTCHA_WINDOW_MS - now + 500),
    );
  }
}

/**
 * 令牌**惰性获取**并在本次运行内复用。
 *
 * 不能预先登录全部账号：RuoYi-Vue-Plus 在角色授权变更（`authUser/selectAll`、`cancel`）
 * 后会踢掉该账号的在线会话，预取的令牌随即失效（实测 HTTP 200 + `code=401`）。
 * A-18 的步骤顺序是「管理员绑定 → 被授权账号断言」，因此令牌必须在使用时才获取。
 */
async function tokenFor(kind) {
  if (kind === 'none') {
    return undefined;
  }
  if (tokens[kind]) {
    return tokens[kind];
  }
  if (directTokens[kind]) {
    tokens[kind] = directTokens[kind];
    return tokens[kind];
  }
  try {
    tokens[kind] = await login(
      browser,
      frontendUrl,
      credentials[kind] ?? {},
      redisContainer,
      redisPassword,
    );
  } catch (error) {
    loginErrors[kind] = error.message;
  }
  return tokens[kind];
}

const results = [];
try {
  for (const testCase of cases) {
    const errors = [];
    const authKind = testCase.auth ?? 'admin';
    const steps = [
      { ...testCase.input, expect: testCase.expect },
      ...(testCase.verify ?? []),
    ];
    let latency = null;

    // 用例级令牌先取一次：拿不到时整条用例直接判失败，错误信息与单步一致
    if (authKind !== 'none' && !(await tokenFor(authKind))) {
      results.push({
        id: testCase.id,
        assertion: testCase.assertion,
        passed: false,
        errors: [
          `无法获取 ${authKind} 令牌: ${loginErrors[authKind] ?? '未知原因'}`,
        ],
        latency_ms: null,
      });
      continue;
    }

    // 每条用例独立捕获变量，避免跨用例串值
    const captures = {};
    for (const [index, rawStep] of steps.entries()) {
      // `{ wait: 5500 }`：等到后端 @RepeatSubmit 窗口（默认 5s）过去再发下一次相同请求
      if (rawStep.wait) {
        await new Promise((resolve) => setTimeout(resolve, rawStep.wait));
        continue;
      }
      try {
        const step = resolveCaptures(rawStep, captures);
        const authKindForStep = stepAuth(testCase, step);
        const token = await tokenFor(authKindForStep);
        if (authKindForStep !== 'none' && !token) {
          errors.push(
            `step${index}: 无法获取 ${authKindForStep} 令牌: ${loginErrors[authKindForStep] ?? '未知原因'}`,
          );
          continue;
        }
        const response = await send(step, token);
        if (index === 0) {
          latency = Math.round(response.latency);
        }
        if (step.capture) {
          for (const [name, path] of Object.entries(step.capture)) {
            const value = getPath(response.json, path);
            if (value === undefined) {
              errors.push(`step${index}: capture ${name} 路径 ${path} 不存在`);
            } else {
              captures[name] = value;
            }
          }
        }
        errors.push(
          ...evaluate(response, step.expect ?? {}).map(
            (error) => `step${index}: ${error}`,
          ),
        );
      } catch (error) {
        errors.push(`step${index}: 请求失败 ${error.message}`);
      }
    }

    results.push({
      id: testCase.id,
      assertion: testCase.assertion,
      passed: errors.length === 0,
      errors,
      latency_ms: latency,
    });
  }
} finally {
  await browser.close();
}

process.stdout.write(JSON.stringify({ cases: results }));

function stepAuth(testCase, step) {
  return step.auth ?? testCase.auth ?? 'admin';
}

/** 用本用例已捕获的值替换 `${NAME}`；未捕获的占位符原样保留（交给断言报错） */
function resolveCaptures(value, captures) {
  if (typeof value === 'string') {
    return value.replaceAll(CAPTURE_PLACEHOLDER, (match, name) =>
      name in captures ? String(captures[name]) : match,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveCaptures(item, captures));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveCaptures(item, captures),
      ]),
    );
  }
  return value;
}

/** 取 `a.b.0.c` 形式的路径值 */
function getPath(value, path) {
  return String(path)
    .split('.')
    .reduce(
      (current, key) =>
        current === null || current === undefined ? undefined : current[key],
      value,
    );
}

async function login(
  browserInstance,
  frontendUrl,
  credential,
  redisContainer,
  redisPassword,
) {
  const username = credential.username;
  const password = credential.password;
  if (!username || !password) {
    throw new Error(`缺少 ${kindName(credential)} 登录凭据`);
  }

  const context = await browserInstance.newContext();
  const page = await context.newPage();
  try {
    // 收集页面自发请求的 `/auth/code`。后端限流 10 次/60s/IP，能复用挂载时
    // 那一次就不额外点击刷新，否则连续跑两轮评测就会把令牌额度耗尽。
    const captchaUuids = [];
    page.on('response', (response) => {
      if (
        !new URL(response.url()).pathname.endsWith('/auth/code') ||
        response.request().method() !== 'GET'
      ) {
        return;
      }
      void response
        .json()
        .then((body) => {
          if (body?.data?.uuid) captchaUuids.push(body.data.uuid);
        })
        .catch(() => {});
    });

    // 就绪判据是「是否已拿到 /auth/code 的 uuid」，而不是验证码图片是否渲染：
    // 图片只是页面就绪的信号，宿主机内存紧张时渲染可能 15s 以上不可见，但 uuid
    // 一到手就能完成登录。慢宿主上页面还可能在填表后重挂载把表单重置，
    // 表现为「点了登录却没有 /auth/login 请求」——整段重试一次并核对输入值。
    const usernameInput = page.getByPlaceholder('请输入用户名');
    const passwordInput = page.getByPlaceholder('密码');
    const captchaInput = page.getByPlaceholder('验证码');
    let lastError;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let uuid = '';
        await paceCaptcha();
        await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
        await usernameInput.waitFor({ timeout: 30_000 });
        for (let waited = 0; waited < 30_000 && !uuid; waited += 1_000) {
          uuid = captchaUuids.at(-1) ?? '';
          if (uuid) break;
          await page.waitForTimeout(1_000);
        }
        if (!uuid) {
          throw new Error('登录页未返回验证码 uuid');
        }
        // 给可能的重复挂载留出落地时间，稳定后取最后一个（旧 uuid 已被覆盖）
        let stableSince = Date.now();
        let lastCount = captchaUuids.length;
        while (Date.now() - stableSince < 1_500) {
          await page.waitForTimeout(200);
          if (captchaUuids.length !== lastCount) {
            lastCount = captchaUuids.length;
            stableSince = Date.now();
          }
        }
        uuid = captchaUuids.at(-1) ?? '';

        await usernameInput.fill(username);
        await passwordInput.fill(password);
        const code = readCaptcha(uuid, redisContainer, redisPassword);
        await captchaInput.fill(code);
        if ((await captchaInput.inputValue()) !== code) {
          throw new Error('验证码输入在提交前被页面重置');
        }

        // 令牌直接从登录响应读取：生产构建里 Pinia 持久化是加密的，
        // 从 localStorage 解不出来；响应体只在内存中使用，不写文件、不打印。
        const loginResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/auth/login') &&
            response.request().method() === 'POST',
          { timeout: 30_000 },
        );
        await page.locator('button[aria-label="login"]').click();
        const body = await (await loginResponse).json();
        if (body?.code !== 200) {
          throw new Error(`登录失败：${body?.msg ?? '未知错误'}`);
        }
        const token = body?.data?.access_token ?? body?.data?.accessToken;
        if (!token) {
          throw new Error('登录响应未返回 access_token');
        }
        return token;
      } catch (error) {
        lastError = error;
        if (attempt === 1) break;
        await page.waitForTimeout(2_000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('未知登录失败');
  } finally {
    await context.close();
  }
}

function kindName(credential) {
  return credential.username ?? '未知账号';
}

function readCaptcha(uuid, container, password) {
  const raw = execFileSync(
    'docker',
    [
      'exec',
      container,
      'redis-cli',
      '--no-auth-warning',
      '-a',
      password,
      '--raw',
      'GET',
      `global:captcha_codes:${uuid}`,
    ],
    { encoding: 'utf8' },
  ).trim();
  return raw.replaceAll('"', '');
}

async function send(step, token) {
  const url = new URL(step.path, baseUrl);
  for (const [key, value] of Object.entries(step.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const headers = {
    'Accept-Language': 'zh-CN',
    'Content-Language': 'zh_CN',
    ...(step.headers ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.clientid = clientId;
  }
  let body;
  if (step.formData !== undefined) {
    body = buildFormData(step.formData);
  } else if (step.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(step.body);
  }

  const started = performance.now();
  const response = await fetch(url, {
    body,
    headers,
    method: String(step.method).toUpperCase(),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const latency = performance.now() - started;
  const contentType = response.headers.get('content-type') ?? '';
  let json = null;
  if (contentType.includes('json')) {
    try {
      json = JSON.parse(buffer.toString('utf8'));
    } catch {
      json = null;
    }
  }
  return {
    buffer,
    contentType,
    headers: response.headers,
    json,
    latency,
    status: response.status,
  };
}

function buildFormData(formData) {
  const data = new FormData();
  for (const [key, value] of Object.entries(formData ?? {})) {
    if (value && typeof value === 'object' && ('path' in value || 'file' in value)) {
      const filePath = value.path ?? value.file;
      let bytes;
      try {
        bytes = readFileSync(filePath);
      } catch {
        // 不把夹具路径写进报告
        throw new Error('无法读取上传夹具');
      }
      const filename = value.filename ?? basename(String(filePath));
      const contentType = value.contentType ?? mimeFor(filename);
      data.append(key, new Blob([bytes], { type: contentType }), filename);
      continue;
    }
    data.append(key, String(value));
  }
  return data;
}

function mimeFor(filename) {
  switch (extname(String(filename)).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

function evaluate(response, expect) {
  const errors = [];
  const { json } = response;

  if (expect.unauthorized) {
    const ok = response.status === 401 || json?.code === 401;
    if (!ok) {
      errors.push(`期望 HTTP 401 或 code=401，实际 status=${response.status} code=${json?.code}`);
    }
  }
  if (expect.status !== undefined && response.status !== expect.status) {
    errors.push(`status 期望 ${expect.status}，实际 ${response.status}`);
  }
  if (expect.code !== undefined && json?.code !== expect.code) {
    errors.push(`code 期望 ${expect.code}，实际 ${json?.code}`);
  }
  if (expect.code_not !== undefined && json?.code === expect.code_not) {
    errors.push(`code 不应为 ${expect.code_not}`);
  }
  if (expect.msg !== undefined && json?.msg !== expect.msg) {
    errors.push(`msg 期望 ${expect.msg}，实际 ${json?.msg}`);
  }
  if (expect.msg_contains) {
    const actual = String(json?.msg ?? '');
    for (const expected of Array.isArray(expect.msg_contains)
      ? expect.msg_contains
      : [expect.msg_contains]) {
      if (!actual.includes(String(expected))) {
        errors.push(
          `msg 期望包含 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`,
        );
      }
    }
  }
  if (expect.msg_nonempty && !String(json?.msg ?? '').trim()) {
    errors.push('msg 必须非空');
  }
  if (expect.json !== undefined) {
    errors.push(...subsetErrors(json, expect.json));
  }
  if (expect.total !== undefined && json?.total !== expect.total) {
    errors.push(`total 期望 ${expect.total}，实际 ${json?.total}`);
  }
  if (expect.total_min !== undefined && !(Number(json?.total) >= expect.total_min)) {
    errors.push(`total 期望 >= ${expect.total_min}，实际 ${json?.total}`);
  }
  if (expect.rows_empty && !(Array.isArray(json?.rows) && json.rows.length === 0)) {
    errors.push('rows 期望空数组');
  }
  if (expect.rows_contains) {
    const rows = Array.isArray(json?.rows) ? json.rows : [];
    const hit = rows.some((row) => subsetErrors(row, expect.rows_contains).length === 0);
    if (!hit) {
      errors.push(`rows 中未找到匹配 ${JSON.stringify(expect.rows_contains)} 的记录`);
    }
  }
  if (expect.rows_contains_all) {
    const rows = Array.isArray(json?.rows) ? json.rows : [];
    for (const expected of expect.rows_contains_all) {
      const hit = rows.some(
        (row) => subsetErrors(row, expected).length === 0,
      );
      if (!hit) {
        errors.push(
          `rows 中未找到匹配 ${JSON.stringify(expected)} 的记录`,
        );
      }
    }
  }
  if (expect.rows_not_contains) {
    const rows = Array.isArray(json?.rows) ? json.rows : [];
    const hit = rows.some(
      (row) => subsetErrors(row, expect.rows_not_contains).length === 0,
    );
    if (hit) {
      errors.push(`rows 中不应出现 ${JSON.stringify(expect.rows_not_contains)}`);
    }
  }
  if (expect.data_not_contains) {
    const items = Array.isArray(json?.data) ? json.data : [];
    const hit = items.some(
      (item) => subsetErrors(item, expect.data_not_contains).length === 0,
    );
    if (hit) {
      errors.push(`data 中不应出现 ${JSON.stringify(expect.data_not_contains)}`);
    }
  }
  if (expect.array_min) {
    for (const item of expect.array_min) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual) || actual.length < (item.min ?? 1)) {
        errors.push(`${item.path} 期望数组长度 >= ${item.min ?? 1}，实际 ${JSON.stringify(actual)}`);
      }
    }
  }
  if (expect.arrays_include) {
    for (const item of expect.arrays_include) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual)) {
        errors.push(`${item.path} 期望数组，实际 ${JSON.stringify(actual)}`);
        continue;
      }
      const values = actual.map((entry) => String(entry));
      for (const expected of item.values ?? []) {
        if (!values.includes(String(expected))) {
          errors.push(`${item.path} 缺少 ${expected}，实际 ${JSON.stringify(actual)}`);
        }
      }
    }
  }
  if (expect.arrays_empty) {
    for (const path of expect.arrays_empty) {
      const actual = getPath(json, path);
      if (!Array.isArray(actual) || actual.length !== 0) {
        errors.push(`${path} 期望空数组，实际 ${JSON.stringify(actual)}`);
      }
    }
  }
  if (expect.nulls) {
    for (const path of expect.nulls) {
      if (getPath(json, path) !== null) {
        errors.push(`${path} 期望 null，实际 ${JSON.stringify(getPath(json, path))}`);
      }
    }
  }
  if (expect.not_nulls) {
    for (const path of expect.not_nulls) {
      if (getPath(json, path) === null || getPath(json, path) === undefined) {
        errors.push(`${path} 期望非 null`);
      }
    }
  }
  if (expect.array_length_eq) {
    for (const item of expect.array_length_eq) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual) || actual.length !== item.length) {
        errors.push(
          `${item.path} 期望数组长度 = ${item.length}，实际 ${Array.isArray(actual) ? actual.length : JSON.stringify(actual)}`,
        );
      }
    }
  }
  if (expect.number_range) {
    for (const item of expect.number_range) {
      const actual = getPath(json, item.path);
      const ok = typeof actual === 'number' && actual >= item.min && actual <= item.max;
      if (!ok) {
        errors.push(`${item.path} 期望 ${item.min}～${item.max} 的数字，实际 ${JSON.stringify(actual)}`);
      }
    }
  }
  if (expect.array_field_not_in) {
    for (const item of expect.array_field_not_in) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual)) {
        errors.push(`${item.path} 期望数组，实际 ${JSON.stringify(actual)}`);
        continue;
      }
      const forbidden = (item.values ?? []).map(String);
      for (const entry of actual) {
        if (forbidden.includes(String(entry?.[item.field]))) {
          errors.push(`${item.path}[].${item.field} 不应包含 ${entry?.[item.field]}`);
        }
      }
    }
  }
  if (expect.array_field_in) {
    for (const item of expect.array_field_in) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual)) {
        errors.push(`${item.path} 期望数组，实际 ${JSON.stringify(actual)}`);
        continue;
      }
      const allowed = (item.values ?? []).map(String);
      for (const entry of actual) {
        if (!allowed.includes(String(entry?.[item.field]))) {
          errors.push(
            `${item.path}[].${item.field} 期望属于 ${JSON.stringify(allowed)}，实际 ${JSON.stringify(entry?.[item.field])}`,
          );
        }
      }
    }
  }
  if (expect.array_objects_contain) {
    for (const item of expect.array_objects_contain) {
      const actual = getPath(json, item.path);
      if (!Array.isArray(actual)) {
        errors.push(`${item.path} 期望数组，实际 ${JSON.stringify(actual)}`);
        continue;
      }
      const hit = actual.some(
        (entry) => subsetErrors(entry, item.contains ?? {}).length === 0,
      );
      if (!hit) {
        errors.push(
          `${item.path} 中未找到匹配 ${JSON.stringify(item.contains)} 的条目`,
        );
      }
    }
  }
  if (expect.string_matches) {
    for (const item of expect.string_matches) {
      const actual = getPath(json, item.path);
      if (actual === null || actual === undefined) {
        errors.push(`${item.path} 期望字符串，实际 ${JSON.stringify(actual)}`);
        continue;
      }
      if (!new RegExp(item.pattern).test(String(actual))) {
        errors.push(
          `${item.path} 不匹配 /${item.pattern}/，实际 ${JSON.stringify(actual)}`,
        );
      }
    }
  }
  if (expect.data_array_min !== undefined) {
    if (!Array.isArray(json?.data) || json.data.length < expect.data_array_min) {
      errors.push(`data 期望数组且长度 >= ${expect.data_array_min}`);
    }
  }
  if (expect.data_contains) {
    const items = Array.isArray(json?.data) ? json.data : [];
    const hit = items.some((item) => subsetErrors(item, expect.data_contains).length === 0);
    if (!hit) {
      const sample = items.slice(0, 3).map((item) => ({
        id: item?.id,
        label: item?.label,
        name: item?.name,
        parentId: item?.parentId,
      }));
      errors.push(
        `data 中未找到匹配 ${JSON.stringify(expect.data_contains)} 的节点；样本=${JSON.stringify(sample)}`,
      );
    }
  }
  if (expect.dict_values_contain) {
    const values = (Array.isArray(json?.data) ? json.data : []).map((item) =>
      String(item?.dictValue),
    );
    for (const value of expect.dict_values_contain) {
      if (!values.includes(String(value))) {
        errors.push(`dictValue 缺少 ${value}`);
      }
    }
  }
  if (expect.roles_flag_true !== undefined) {
    if (!roleFlagIs(json, expect.roles_flag_true, true)) {
      errors.push(`角色 ${expect.roles_flag_true} 的 flag 期望 true`);
    }
  }
  if (expect.roles_flag_false !== undefined) {
    if (!roleFlagIs(json, expect.roles_flag_false, false)) {
      errors.push(`角色 ${expect.roles_flag_false} 的 flag 期望 false`);
    }
    const roleIds = (json?.data?.roleIds ?? []).map((item) => String(item));
    if (roleIds.includes(String(expect.roles_flag_false))) {
      errors.push(`data.roleIds 不应包含 ${expect.roles_flag_false}`);
    }
  }
  if (expect.body_nonempty && response.buffer.length === 0) {
    errors.push('响应体为空');
  }
  if (expect.content_type_in) {
    const contentType = response.contentType.split(';')[0].trim();
    if (!expect.content_type_in.includes(contentType)) {
      errors.push(`Content-Type 期望 ${expect.content_type_in.join(' / ')}，实际 ${contentType || '<空>'}`);
    }
  }
  if (expect.headers_contains) {
    for (const [name, expected] of Object.entries(expect.headers_contains)) {
      const actual = response.headers.get(name) ?? '';
      if (!String(actual).includes(String(expected))) {
        errors.push(
          `响应头 ${name} 期望包含 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`,
        );
      }
    }
  }
  if (expect.json_error_allowed && response.contentType.includes('json')) {
    if (json?.code === 200) {
      errors.push('JSON 错误体不应返回 code=200');
    }
    if (!String(json?.msg ?? '').trim()) {
      errors.push('JSON 错误体缺少 msg');
    }
  }

  return errors;
}

function roleFlagIs(json, roleId, flag) {
  const roles = Array.isArray(json?.data?.roles) ? json.data.roles : [];
  const role = roles.find((item) => String(item?.roleId) === String(roleId));
  return Boolean(role) && role.flag === flag;
}

function subsetErrors(actual, expected, path = '$') {
  const errors = [];
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object') {
      return [`${path} 期望对象`];
    }
    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) {
        errors.push(`${path}.${key} 缺少字段`);
      } else {
        errors.push(...subsetErrors(actual[key], value, `${path}.${key}`));
      }
    }
    return errors;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return [`${path} 数组长度不足`];
    }
    expected.forEach((item, index) => {
      errors.push(...subsetErrors(actual[index], item, `${path}[${index}]`));
    });
    return errors;
  }
  if (Object.is(actual, expected)) {
    return errors;
  }
  // 后端 Long 可能序列化为字符串；数字与等值字符串视为一致
  if (String(actual) !== String(expected)) {
    errors.push(`${path} 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
  return errors;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
