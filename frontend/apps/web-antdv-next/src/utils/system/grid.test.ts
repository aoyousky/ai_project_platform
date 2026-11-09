import { describe, expect, it, vi } from 'vitest';

import { createGridQuery } from './grid';

describe('createGridQuery', () => {
  it('正常页只取一次并返回 vxe 需要的 items/total', async () => {
    const fetch = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], total: 1 });
    const query = createGridQuery({
      buildQuery: (values, page) => ({
        pageNum: page.currentPage,
        pageSize: page.pageSize,
        ...values,
      }),
      fetch,
    });

    await expect(
      query({ page: { currentPage: 1, pageSize: 10 } }, { name: 'x' }),
    ).resolves.toEqual({ items: [{ id: 1 }], total: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith({
      name: 'x',
      pageNum: 1,
      pageSize: 10,
    });
  });

  it('页码越界时回退到最后一页并重取一次（E-25）', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], total: 3 })
      .mockResolvedValueOnce({ rows: [{ id: 3 }], total: 3 });
    const query = createGridQuery({
      buildQuery: (_values, page) => ({ pageNum: page.currentPage }),
      fetch,
    });

    await expect(
      query({ page: { currentPage: 5, pageSize: 10 } }, {}),
    ).resolves.toEqual({ items: [{ id: 3 }], total: 3 });
    expect(fetch).toHaveBeenNthCalledWith(2, { pageNum: 1 });
  });

  it('beforeQuery 返回 false 时不发请求，直接返回空列表', async () => {
    const fetch = vi.fn();
    const query = createGridQuery({
      beforeQuery: () => false,
      buildQuery: (_values, page) => ({ pageNum: page.currentPage }),
      fetch,
    });

    await expect(
      query({ page: { currentPage: 1, pageSize: 10 } }, {}),
    ).resolves.toEqual({ items: [], total: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('withSort 为 false 时不透传排序参数', async () => {
    const buildQuery = vi.fn((_values, page, sort) => ({
      pageNum: page.currentPage,
      sort,
    }));
    const query = createGridQuery({
      buildQuery,
      fetch: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    });

    await query(
      {
        page: { currentPage: 1, pageSize: 10 },
        sort: { field: 'loginTime', order: 'desc' },
      },
      {},
    );
    expect(buildQuery).toHaveBeenCalledWith(
      {},
      { currentPage: 1, pageSize: 10 },
      undefined,
    );
  });

  it('withSort 为 true 时透传排序参数', async () => {
    const buildQuery = vi.fn((_values, page, sort) => ({
      pageNum: page.currentPage,
      sort,
    }));
    const query = createGridQuery({
      buildQuery,
      fetch: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      withSort: true,
    });

    await query(
      {
        page: { currentPage: 1, pageSize: 10 },
        sort: { field: 'loginTime', order: 'desc' },
      },
      {},
    );
    expect(buildQuery).toHaveBeenCalledWith(
      {},
      { currentPage: 1, pageSize: 10 },
      { field: 'loginTime', order: 'desc' },
    );
  });

  it('onResult 收到回退重取后的最终结果', async () => {
    const onResult = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], total: 3 })
      .mockResolvedValueOnce({ rows: [{ id: 3 }], total: 3 });
    const query = createGridQuery({
      buildQuery: (_values, page) => ({ pageNum: page.currentPage }),
      fetch,
      onResult,
    });

    await query({ page: { currentPage: 5, pageSize: 10 } }, {});
    expect(onResult).toHaveBeenCalledWith({ rows: [{ id: 3 }], total: 3 });
  });
});
