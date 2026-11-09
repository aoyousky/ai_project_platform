import type {
  WorkbenchGroups,
  WorkbenchTask,
} from '#/api/dashboard/types';

import { describe, expect, it } from 'vitest';

import {
  buildTabItems,
  collectTasks,
  dedupeTasks,
  efficiencyBarWidth,
  efficiencyPercent,
  efficiencyText,
  filterTasks,
  formatDueTime,
  formatEfficiencyHours,
  groupLabel,
  priorityLabel,
  progressBarWidth,
  sortTasks,
} from './workbench-page-logic';

function task(
  taskId: string,
  priority: WorkbenchTask['priority'],
  dueTime: null | string,
  overdueHours: null | number = null,
): WorkbenchTask {
  return {
    dueTime,
    flowName: `流程 ${taskId}`,
    initiatorName: '张三',
    nodeName: '部门负责人审批',
    overdueHours,
    priority,
    taskId,
  };
}

const groups: WorkbenchGroups = {
  overdue: [
    task('1', 'OVERDUE', '2026-11-06T18:00:00+08:00', 16),
    task('2', 'OVERDUE', '2026-11-06T17:30:00+08:00', 17),
  ],
  today: [
    task('3', 'TODAY', '2026-11-08T18:00:00+08:00'),
    task('4', 'TODAY', '2026-11-08T20:00:00+08:00'),
    task('5', 'TODAY', '2026-11-08T21:00:00+08:00'),
  ],
  next7Days: [
    task('6', 'NEXT_7_DAYS', '2026-11-09T18:00:00+08:00'),
    task('7', 'NEXT_7_DAYS', '2026-11-10T18:00:00+08:00'),
  ],
  unscheduled: [],
};

describe('工作台展示逻辑（SPEC-005 A-07 / A-08 / A-09 / A-13 / E-07 / E-16）', () => {
  it('A-07：四组排序为 overdue → today → next7 → unscheduled', () => {
    expect(collectTasks(groups).map((item) => item.taskId)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    expect(collectTasks(groups)).toHaveLength(7);
  });

  it('A-08：筛选后行数依次为 2 / 3 / 2 / 7', () => {
    expect(filterTasks(groups, 'overdue')).toHaveLength(2);
    expect(filterTasks(groups, 'today')).toHaveLength(3);
    expect(filterTasks(groups, 'next7Days')).toHaveLength(2);
    expect(filterTasks(groups, 'all')).toHaveLength(7);
  });

  it('E-07：后端重复 taskId 时前端同样去重且保持首条', () => {
    const duplicated = [task('1', 'OVERDUE', null), task('1', 'TODAY', null)];
    expect(dedupeTasks(duplicated)).toHaveLength(1);
    expect(dedupeTasks(duplicated)[0]!.taskId).toBe('1');
  });

  it('E-16：刷新返回重复 taskId 时结果仍唯一', () => {
    const refreshed = collectTasks({
      ...groups,
      today: [...groups.today, task('1', 'TODAY', '2026-11-08T23:00:00+08:00')],
    });
    expect(dedupeTasks(refreshed)).toHaveLength(7);
  });

  it('A-07：组标题与优先级文案', () => {
    expect(groupLabel('overdue')).toBe('已超时');
    expect(groupLabel('today')).toBe('今天到期');
    expect(groupLabel('next7Days')).toBe('未来 7 天');
    expect(groupLabel('unscheduled')).toBe('未设截止');
    expect(priorityLabel('OVERDUE')).toBe('已超时');
    expect(priorityLabel('TODAY')).toBe('今天到期');
    expect(priorityLabel('NEXT_7_DAYS')).toBe('未来 7 天');
    expect(priorityLabel('UNSCHEDULED')).toBe('未设截止');
  });

  it('A-09：效率文案与进度条宽度', () => {
    expect(efficiencyText(12, 20)).toBe('已完成 12 / 20');
    expect(efficiencyPercent(12, 20)).toBe(60);
    expect(efficiencyBarWidth(12, 20)).toBe('60%');
    expect(efficiencyPercent(30, 20)).toBe(100);
    expect(efficiencyPercent(0, 0)).toBe(0);
    expect(efficiencyBarWidth(0, 0)).toBe('0%');
    expect(Number.isNaN(efficiencyPercent(Number.NaN, 20))).toBe(false);
  });

  it('A-09：平均处理时长保留 1 位小数，空样本不显示 NaN', () => {
    expect(formatEfficiencyHours(3.2)).toBe('3.2 小时');
    expect(formatEfficiencyHours(0)).toBe('0.0 小时');
    expect(formatEfficiencyHours(null)).toBe('—');
  });

  it('A-13：进度百分比为 null 时不渲染进度条', () => {
    expect(progressBarWidth(null)).toBeNull();
    expect(progressBarWidth(40)).toBe('40%');
    expect(progressBarWidth(120)).toBe('100%');
  });

  it('截止时间按契约展示，null 表示未设截止', () => {
    expect(formatDueTime('2026-11-06T18:00:00+08:00')).toBe('11-06 18:00');
    expect(formatDueTime(null)).toBe('未设截止');
  });

  it('A-07：页签计数完全来自 metrics', () => {
    expect(
      buildTabItems({
        copyTotal: 5,
        doneTotal: 32,
        initiatedTotal: 12,
        todoTotal: 7,
      }),
    ).toEqual([
      { count: 7, key: 'todo', label: '待办' },
      { count: 32, key: 'done', label: '已办' },
      { count: 12, key: 'initiated', label: '我发起' },
      { count: 5, key: 'copy', label: '抄送' },
    ]);
    expect(
      buildTabItems({
        copyTotal: null,
        doneTotal: null,
        initiatedTotal: null,
        todoTotal: null,
      }).map((item) => item.count),
    ).toEqual([null, null, null, null]);
  });

  it('排序：截止时间升序，null 排最后', () => {
    expect(
      sortTasks([
        task('a', 'UNSCHEDULED', null),
        task('b', 'TODAY', '2026-11-08T18:00:00+08:00'),
        task('c', 'OVERDUE', '2026-11-06T18:00:00+08:00'),
      ]).map((item) => item.taskId),
    ).toEqual(['c', 'b', 'a']);
  });
});
