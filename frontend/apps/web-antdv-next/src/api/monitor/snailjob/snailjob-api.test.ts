import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authHeaders,
  clearSession,
  listJobsApi,
  listTasksApi,
  loginApi,
  retryBatchApi,
  SnailJobApiError,
  SnailJobAuthError,
  SnailJobUnavailableError,
  stopBatchApi,
  triggerJobApi,
} from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

type FetchCall = [string, RequestInit | undefined];

function callAt(
  mock: { mock: { calls: unknown[][] } },
  index: number,
): FetchCall {
  return mock.mock.calls[index] as FetchCall;
}

const LOGIN_OK = {
  status: 1,
  message: 'Request succeeded',
  data: {
    token: 'jwt-token',
    namespaceIds: [
      { id: 1, name: 'Development', uniqueId: 'dev' },
      { id: 2, name: 'Production', uniqueId: 'prod' },
    ],
  },
};

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('snailjob console API（SPEC-008 §4.2）', () => {
  it('登录成功：token 与 namespace uniqueId 存 sessionStorage，不进 localStorage', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse(LOGIN_OK),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await loginApi('admin', 'admin123');

    expect(session).toEqual({ namespaceUniqueId: 'dev', token: 'jwt-token' });
    expect(sessionStorage.getItem('snailjob_token')).toBe('jwt-token');
    expect(sessionStorage.getItem('snailjob_namespace')).toBe('dev');
    expect(localStorage.getItem('snailjob_token')).toBeNull();
    expect(callAt(fetchMock, 0)[0]).toBe('/snail-job/auth/login');
    expect(callAt(fetchMock, 0)[1]).toMatchObject({ method: 'POST' });
  });

  it('登录失败（status=0）抛 SnailJobApiError 并带 message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ status: 0, message: '用户名或密码错误', data: null }),
      ),
    );

    const error = await loginApi('admin', 'bad').catch(
      (error_: unknown) => error_,
    );
    expect(error).toBeInstanceOf(SnailJobApiError);
    expect((error as SnailJobApiError).message).toBe('用户名或密码错误');
    expect((error as SnailJobApiError).code).toBe('SNAILJOB_API_ERROR');
  });

  it('业务接口携带 SNAIL-JOB-AUTH 与 SNAIL-JOB-NAMESPACE-ID', async () => {
    sessionStorage.setItem('snailjob_token', 'jwt-token');
    sessionStorage.setItem('snailjob_namespace', 'dev');
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({
        status: 1,
        data: [{ id: 1 }],
        page: 1,
        size: 10,
        total: 1,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listJobsApi({ pageNo: 1, pageSize: 10 });

    expect(callAt(fetchMock, 0)[0]).toBe(
      '/snail-job/job/page/list?pageNo=1&pageSize=10',
    );
    expect(callAt(fetchMock, 0)[1]).toMatchObject({
      headers: {
        'SNAIL-JOB-AUTH': 'jwt-token',
        'SNAIL-JOB-NAMESPACE-ID': 'dev',
      },
    });
  });

  it('status=5001 抛 SnailJobAuthError 并清除会话（E-08）', async () => {
    sessionStorage.setItem('snailjob_token', 'expired');
    sessionStorage.setItem('snailjob_namespace', 'dev');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 5001, message: '未登录' })),
    );

    await expect(listTasksApi(1)).rejects.toBeInstanceOf(SnailJobAuthError);
    expect(sessionStorage.getItem('snailjob_token')).toBeNull();
  });

  it('反代 502 HTML 抛 SnailJobUnavailableError（E-11）', async () => {
    sessionStorage.setItem('snailjob_token', 'jwt-token');
    sessionStorage.setItem('snailjob_namespace', 'dev');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>502</html>', {
            headers: { 'Content-Type': 'text/html' },
            status: 502,
          }),
      ),
    );

    await expect(
      listJobsApi({ pageNo: 1, pageSize: 5 }),
    ).rejects.toBeInstanceOf(SnailJobUnavailableError);
  });

  it('未登录直接调用业务接口抛 SnailJobAuthError', async () => {
    await expect(
      listJobsApi({ pageNo: 1, pageSize: 5 }),
    ).rejects.toBeInstanceOf(SnailJobAuthError);
  });

  it('执行/停止/重试的路径与请求体（A-08/A-09/A-10）', async () => {
    sessionStorage.setItem('snailjob_token', 'jwt-token');
    sessionStorage.setItem('snailjob_namespace', 'dev');
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      jsonResponse({ status: 1, message: 'ok', data: true }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await triggerJobApi(1);
    await stopBatchApi(22);
    await retryBatchApi(33);

    expect(callAt(fetchMock, 0)[0]).toBe('/snail-job/job/trigger');
    expect(callAt(fetchMock, 0)[1]).toMatchObject({
      body: JSON.stringify({ jobId: 1 }),
      method: 'POST',
    });
    expect(callAt(fetchMock, 1)[0]).toBe('/snail-job/job/batch/stop/22');
    expect(callAt(fetchMock, 2)[0]).toBe('/snail-job/job/batch/retry/33');
  });

  it('request 成功后返回 data 与分页字段', async () => {
    sessionStorage.setItem('snailjob_token', 'jwt-token');
    sessionStorage.setItem('snailjob_namespace', 'dev');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          status: 1,
          data: [{ id: 7 }],
          page: 2,
          size: 10,
          total: 11,
        }),
      ),
    );

    const page = await listJobsApi({ pageNo: 2, pageSize: 10 });
    expect(page).toEqual({ list: [{ id: 7 }], page: 2, size: 10, total: 11 });
  });

  it('clearSession 清空 token 与 namespace；authHeaders 无 token 抛错', () => {
    sessionStorage.setItem('snailjob_token', 'jwt-token');
    clearSession();
    expect(sessionStorage.getItem('snailjob_token')).toBeNull();
    expect(() => authHeaders()).toThrowError(SnailJobAuthError);
  });
});
