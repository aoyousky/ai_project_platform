/**
 * SPEC-008 §4.2：SnailJob 1.10.0 同源 REST API。
 * 登录由本页发起；JWT 只存当前标签页 sessionStorage（`snailjob_token`），
 * 不写 localStorage、不进 URL、不打印、不上报。
 */

const TOKEN_KEY = 'snailjob_token';
const NAMESPACE_KEY = 'snailjob_namespace';
const DEFAULT_NAMESPACE = 'dev';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface NamespaceOption {
  id: number;
  name: string;
  uniqueId: string;
}

export interface SnailJobJob {
  groupName?: null | string;
  id: number;
  jobName: string;
  jobStatus: number;
  nextTriggerAt?: null | string;
  triggerInterval?: string;
  triggerType?: number;
}

export interface SnailJobPage<T> {
  list: T[];
  page: number;
  size: number;
  total: number;
}

export interface SnailJobTask {
  createDt?: null | string;
  status: number;
  taskBatchId: number;
}

export interface SnailJobSession {
  namespaceUniqueId: string;
  token: string;
}

export class SnailJobApiError extends Error {
  readonly code = 'SNAILJOB_API_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'SnailJobApiError';
  }
}

export class SnailJobAuthError extends Error {
  readonly code = 'SNAILJOB_LOGIN_REQUIRED';

  constructor(message = '请先登录任务调度中心') {
    super(message);
    this.name = 'SnailJobAuthError';
  }
}

export class SnailJobUnavailableError extends Error {
  readonly code = 'SNAILJOB_UNAVAILABLE';

  constructor(message = '控制台不可用') {
    super(message);
    this.name = 'SnailJobUnavailableError';
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(NAMESPACE_KEY);
}

/** 控制台要求 `SNAIL-JOB-AUTH` 与 `SNAIL-JOB-NAMESPACE-ID`（uniqueId，不是数字 id）。 */
export function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const namespace = sessionStorage.getItem(NAMESPACE_KEY);
  if (!token || !namespace) {
    throw new SnailJobAuthError();
  }
  return {
    'SNAIL-JOB-AUTH': token,
    'SNAIL-JOB-NAMESPACE-ID': namespace,
  };
}

interface Envelope<T> {
  data?: T;
  message?: string;
  page?: number;
  size?: number;
  status: number;
  total?: number;
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Envelope<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    if (timedOut) {
      throw new SnailJobUnavailableError('控制台连接超时');
    }
    throw new SnailJobUnavailableError();
  } finally {
    clearTimeout(timer);
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('json')) {
    throw new SnailJobUnavailableError();
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new SnailJobUnavailableError();
  }

  if (body.status === 5001) {
    clearSession();
    throw new SnailJobAuthError();
  }
  if (body.status !== 1) {
    throw new SnailJobApiError(body.message ?? '操作失败');
  }
  return body;
}

export async function loginApi(
  username: string,
  password: string,
): Promise<SnailJobSession> {
  const body = await request<{
    namespaceIds?: NamespaceOption[];
    token?: null | string;
  }>('/snail-job/auth/login', {
    body: JSON.stringify({ password, username }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!body.data?.token) {
    throw new SnailJobApiError(body.message ?? '控制台未返回 token');
  }
  const namespaces = body.data.namespaceIds ?? [];
  const namespaceUniqueId =
    namespaces.find((item) => item.uniqueId === DEFAULT_NAMESPACE)?.uniqueId ??
    namespaces[0]?.uniqueId ??
    DEFAULT_NAMESPACE;

  sessionStorage.setItem(TOKEN_KEY, body.data.token);
  sessionStorage.setItem(NAMESPACE_KEY, namespaceUniqueId);
  return { namespaceUniqueId, token: body.data.token };
}

function toPage<T>(body: Envelope<T[]>): SnailJobPage<T> {
  return {
    list: body.data ?? [],
    page: body.page ?? 1,
    size: body.size ?? 0,
    total: body.total ?? 0,
  };
}

export async function listJobsApi(query: {
  pageNo: number;
  pageSize: number;
}): Promise<SnailJobPage<SnailJobJob>> {
  const body = await request<SnailJobJob[]>(
    `/snail-job/job/page/list?pageNo=${query.pageNo}&pageSize=${query.pageSize}`,
    { headers: { ...authHeaders(), Accept: 'application/json' } },
  );
  return toPage(body);
}

export async function listTasksApi(
  jobId: number,
): Promise<SnailJobPage<SnailJobTask>> {
  const body = await request<SnailJobTask[]>(
    `/snail-job/job/task/list?jobId=${jobId}`,
    { headers: { ...authHeaders(), Accept: 'application/json' } },
  );
  return toPage(body);
}

export async function triggerJobApi(jobId: number): Promise<void> {
  await request(`/snail-job/job/trigger`, {
    body: JSON.stringify({ jobId }),
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

export async function stopBatchApi(taskBatchId: number): Promise<void> {
  await request(`/snail-job/job/batch/stop/${taskBatchId}`, {
    headers: authHeaders(),
    method: 'POST',
  });
}

export async function retryBatchApi(taskBatchId: number): Promise<void> {
  await request(`/snail-job/job/batch/retry/${taskBatchId}`, {
    headers: authHeaders(),
    method: 'POST',
  });
}
