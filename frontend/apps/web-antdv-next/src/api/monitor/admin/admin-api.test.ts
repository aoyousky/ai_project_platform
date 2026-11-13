import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConsoleAuthError,
  ConsoleTimeoutError,
  ConsoleUnavailableError,
  fetchApplications,
  fetchInstanceEnv,
  fetchInstanceLog,
} from './index';

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin console API（SPEC-008 §4.1）', () => {
  it('get /admin/applications 返回数组并带同源凭据', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([
        { name: 'aoyou-admin', status: 'UP', instances: [{ id: 'i-1' }] },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const apps = await fetchApplications();

    expect(apps).toEqual([
      { name: 'aoyou-admin', status: 'UP', instances: [{ id: 'i-1' }] },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(String(url)).toBe('/admin/applications');
    expect(init).toMatchObject({ credentials: 'include' });
    expect((init?.headers as Record<string, string> | undefined)?.Accept).toBe(
      'application/json',
    );
  });

  it('401 抛 ConsoleAuthError（A-05）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    );

    await expect(fetchApplications()).rejects.toBeInstanceOf(ConsoleAuthError);
  });

  it('502 HTML 抛 ConsoleUnavailableError，不把 HTML 当 JSON（E-11）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>bad gateway</html>', {
            headers: { 'Content-Type': 'text/html' },
            status: 502,
          }),
      ),
    );

    await expect(fetchApplications()).rejects.toBeInstanceOf(
      ConsoleUnavailableError,
    );
  });

  it('200 但返回 HTML 同样按不可用处理（反代兜底页）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>index</html>', {
            headers: { 'Content-Type': 'text/html' },
            status: 200,
          }),
      ),
    );

    await expect(fetchApplications()).rejects.toBeInstanceOf(
      ConsoleUnavailableError,
    );
  });

  it('超过超时时间抛 ConsoleTimeoutError（E-07）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );

    await expect(fetchApplications({ timeoutMs: 20 })).rejects.toBeInstanceOf(
      ConsoleTimeoutError,
    );
  });

  it('环境接口返回 propertySources；编码实例 id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ propertySources: [{ name: 's', properties: {} }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchInstanceEnv('a b/c');

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      '/admin/instances/a%20b%2Fc/actuator/env',
    );
  });

  it('日志接口按纯文本返回（A-04）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('line1\nline2', {
            headers: { 'Content-Type': 'text/plain' },
            status: 200,
          }),
      ),
    );

    await expect(fetchInstanceLog('i-1')).resolves.toBe('line1\nline2');
  });
});
