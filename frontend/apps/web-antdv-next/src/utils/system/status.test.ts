import { describe, expect, it, vi } from 'vitest';

import { runStatusToggle } from './status';

/**
 * SPEC-002 A-09 / SPEC-003 A-19：状态开关乐观更新，提交失败回滚。
 */
describe('runStatusToggle', () => {
  function setup(commit: () => Promise<unknown>) {
    const applied: string[] = [];
    const reload = vi.fn(async () => undefined);
    const onError = vi.fn();
    const result = runStatusToggle({
      apply: (status) => applied.push(status),
      commit,
      nextStatus: '1',
      onError,
      previousStatus: '0',
      reload,
    });
    return { applied, onError, reload, result };
  }

  it('提交成功后保留新状态并刷新列表', async () => {
    const { applied, onError, reload, result } = setup(async () => undefined);

    await expect(result).resolves.toBe(true);
    expect(applied).toEqual(['1']);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('提交失败回滚到原状态、不刷新并返回 false', async () => {
    const error = new Error('boom');
    const { applied, onError, reload, result } = setup(async () => {
      throw error;
    });

    await expect(result).resolves.toBe(false);
    expect(applied).toEqual(['1', '0']);
    expect(reload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('未提供 onError 时失败也不抛异常（错误文案由请求层展示）', async () => {
    const applied: string[] = [];
    const result = runStatusToggle({
      apply: (status) => applied.push(status),
      commit: async () => {
        throw new Error('boom');
      },
      nextStatus: '1',
      previousStatus: '0',
      reload: async () => undefined,
    });

    await expect(result).resolves.toBe(false);
    expect(applied).toEqual(['1', '0']);
  });
});
