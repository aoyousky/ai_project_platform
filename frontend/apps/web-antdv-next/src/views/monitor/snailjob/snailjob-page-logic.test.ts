import { describe, expect, it } from 'vitest';

import {
  canRetry,
  canStop,
  formatDateTime,
  mapJobRows,
  mapTaskRows,
  taskStatusText,
} from './snailjob-page-logic';

/**
 * SPEC-008 §4.2：SnailJob 数据转换。
 * 状态码来自 JobTaskStatusEnum：2 RUNNING / 3 SUCCESS / 4 FAIL / 5 STOP / 6 CANCEL。
 */
describe('snailjob-page-logic', () => {
  it('任务状态文本与可操作判定', () => {
    expect(taskStatusText(2)).toBe('运行中');
    expect(taskStatusText(3)).toBe('成功');
    expect(taskStatusText(4)).toBe('失败');
    expect(taskStatusText(5)).toBe('已停止');
    expect(taskStatusText(6)).toBe('已取消');
    expect(taskStatusText(99)).toBe('—');
    expect(canStop(2)).toBe(true);
    expect(canStop(3)).toBe(false);
    expect(canRetry(4)).toBe(true);
    expect(canRetry(2)).toBe(false);
  });

  it('任务行：jobStatus 1 启用 / 0 停用；空 nextTriggerAt 显示「—」', () => {
    expect(
      mapJobRows([
        {
          id: 1,
          jobName: 'demo-job',
          groupName: 'ruoyi_group',
          jobStatus: 1,
          nextTriggerAt: '2026-11-12 09:13:58',
        },
        {
          id: 2,
          jobName: 'off-job',
          groupName: '',
          jobStatus: 0,
          nextTriggerAt: null,
        },
      ]),
    ).toEqual([
      {
        id: 1,
        jobName: 'demo-job',
        groupName: 'ruoyi_group',
        statusText: '启用',
        nextTriggerAt: '2026-11-12 09:13:58',
      },
      {
        id: 2,
        jobName: 'off-job',
        groupName: '—',
        statusText: '停用',
        nextTriggerAt: '—',
      },
    ]);
  });

  it('执行记录行：保留 taskBatchId 与状态文本', () => {
    expect(
      mapTaskRows([
        { taskBatchId: 11, status: 2, createDt: '2026-11-12 10:00:00' },
        { taskBatchId: 12, status: 4, createDt: null },
      ]),
    ).toEqual([
      {
        taskBatchId: 11,
        status: 2,
        statusText: '运行中',
        createDt: '2026-11-12 10:00:00',
      },
      { taskBatchId: 12, status: 4, statusText: '失败', createDt: '—' },
    ]);
  });

  it('时间格式：原样保留 YYYY-MM-DD HH:mm:ss，空值显示「—」', () => {
    expect(formatDateTime('2026-11-12 09:13:58')).toBe('2026-11-12 09:13:58');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });
});
