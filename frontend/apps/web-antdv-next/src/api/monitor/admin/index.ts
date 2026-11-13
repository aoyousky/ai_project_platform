/**
 * SPEC-008 §4.1：Spring Boot Admin 同源 REST API。
 * 不经过平台 requestClient（baseURL `/prod-api` + 平台 JWT 不适用于控制台）；
 * 使用 fetch 直连同源上下文路径 `/admin`，凭据由控制台自己的 JSESSIONID 承担。
 */

export interface ConsoleApplication {
  instances?: ConsoleInstance[];
  name: string;
  status: string;
  statusTimestamp?: null | string;
}

export interface ConsoleInstance {
  id: string;
  metadata?: { username?: null | string; userpassword?: null | string };
  registration?: { managementUrl?: null | string };
  statusInfo?: { status?: string };
  statusTimestamp?: null | string;
}

export interface ConsolePropertySource {
  name: string;
  properties?: Record<string, string | undefined>;
}

export class ConsoleAuthError extends Error {
  readonly code = 'CONSOLE_LOGIN_REQUIRED';

  constructor(message = '请先登录官方控制台') {
    super(message);
    this.name = 'ConsoleAuthError';
  }
}

export class ConsoleTimeoutError extends Error {
  readonly code = 'CONSOLE_TIMEOUT';

  constructor(message = '控制台连接超时') {
    super(message);
    this.name = 'ConsoleTimeoutError';
  }
}

export class ConsoleUnavailableError extends Error {
  readonly code = 'CONSOLE_UNAVAILABLE';

  constructor(message = '控制台不可用') {
    super(message);
    this.name = 'ConsoleUnavailableError';
  }
}

interface RequestOptions {
  init?: RequestInit;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

async function request(
  url: string,
  { init, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    if (timedOut) {
      throw new ConsoleTimeoutError();
    }
    throw new ConsoleUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

function assertStatus(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new ConsoleAuthError();
  }
  if (!response.ok) {
    throw new ConsoleUnavailableError();
  }
}

function isJson(response: Response): boolean {
  return (response.headers.get('Content-Type') ?? '').includes('json');
}

/** 反代失败或 SPA 兜底会返回 HTML；不得把 HTML 当 JSON 解析（E-11 / 反例）。 */
async function readJson<T>(response: Response): Promise<T> {
  assertStatus(response);
  if (!isJson(response)) {
    throw new ConsoleUnavailableError();
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ConsoleUnavailableError();
  }
}

export async function fetchApplications(
  options: RequestOptions = {},
): Promise<ConsoleApplication[]> {
  const response = await request('/admin/applications', {
    ...options,
    init: { headers: { Accept: 'application/json' } },
  });
  return readJson<ConsoleApplication[]>(response);
}

export async function fetchInstanceEnv(
  instanceId: string,
  options: RequestOptions = {},
): Promise<ConsolePropertySource[]> {
  const response = await request(
    `/admin/instances/${encodeURIComponent(instanceId)}/actuator/env`,
    { ...options, init: { headers: { Accept: 'application/json' } } },
  );
  const body = await readJson<{
    propertySources?: ConsolePropertySource[];
  }>(response);
  return body.propertySources ?? [];
}

export async function fetchInstanceLog(
  instanceId: string,
  options: RequestOptions = {},
): Promise<string> {
  const response = await request(
    `/admin/instances/${encodeURIComponent(instanceId)}/actuator/logfile`,
    { ...options, init: { headers: { Accept: 'text/plain' } } },
  );
  assertStatus(response);
  return response.text();
}
