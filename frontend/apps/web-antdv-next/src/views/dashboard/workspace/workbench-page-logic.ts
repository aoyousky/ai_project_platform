/**
 * 工作台展示逻辑（SPEC-005 v1.4）。
 *
 * 分组、筛选、去重、效率进度条与页签计数都在这里实现；
 * 页面只负责渲染，避免在模板里做未经保护的算术运算（DOM 不出现 NaN）。
 */
import type {
  TaskPriority,
  WorkbenchGroups,
  WorkbenchMetrics,
  WorkbenchTask,
} from '#/api/dashboard/types';

export type GroupKey = keyof WorkbenchGroups;
export type TaskFilter = 'all' | GroupKey;

export const GROUP_KEYS: GroupKey[] = [
  'overdue',
  'today',
  'next7Days',
  'unscheduled',
];

export const GROUP_LABELS: Record<GroupKey, string> = {
  next7Days: '未来 7 天',
  overdue: '已超时',
  today: '今天到期',
  unscheduled: '未设截止',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  NEXT_7_DAYS: '未来 7 天',
  OVERDUE: '已超时',
  TODAY: '今天到期',
  UNSCHEDULED: '未设截止',
};

export function groupLabel(key: GroupKey): string {
  return GROUP_LABELS[key];
}

export function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_LABELS[priority];
}

export function priorityTagColor(
  priority: TaskPriority,
): 'default' | 'error' | 'warning' {
  if (priority === 'OVERDUE') {
    return 'error';
  }
  if (priority === 'TODAY') {
    return 'warning';
  }
  return 'default';
}

/** 按四组固定顺序收集，保证渲染顺序与契约一致 */
export function collectTasks(groups: WorkbenchGroups): WorkbenchTask[] {
  return GROUP_KEYS.flatMap((key) => groups?.[key] ?? []);
}

/** E-07：同一响应内 taskId 唯一，保留首条 */
export function dedupeTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.taskId)) {
      return false;
    }
    seen.add(task.taskId);
    return true;
  });
}

/** 截止时间升序，null 排最后；同时间按 taskId 稳定排序 */
export function sortTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return tasks.toSorted((left, right) => {
    if (!left.dueTime && !right.dueTime) {
      return left.taskId.localeCompare(right.taskId);
    }
    if (!left.dueTime) {
      return 1;
    }
    if (!right.dueTime) {
      return -1;
    }
    const byTime = left.dueTime.localeCompare(right.dueTime);
    return byTime === 0 ? left.taskId.localeCompare(right.taskId) : byTime;
  });
}

/** A-08：筛选只改变可见行，不改变页签计数 */
export function filterTasks(
  groups: WorkbenchGroups,
  filter: TaskFilter,
): WorkbenchTask[] {
  if (filter === 'all') {
    return dedupeTasks(collectTasks(groups));
  }
  return dedupeTasks(groups?.[filter] ?? []);
}

export function efficiencyPercent(completed: number, target: number): number {
  if (
    !Number.isFinite(completed) ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((completed / target) * 100)));
}

export function efficiencyBarWidth(completed: number, target: number): string {
  return `${efficiencyPercent(completed, target)}%`;
}

/** A-09 精确文案：已完成 12 / 20 */
export function efficiencyText(completed: number, target: number): string {
  return `已完成 ${completed} / ${target}`;
}

/** BigDecimal 1 位小数；null = 无已完成样本 */
export function formatEfficiencyHours(value: null | number): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(1)} 小时`;
}

/** A-13：null 时页面不渲染进度条 */
export function progressBarWidth(percent: null | number): null | string {
  if (percent === null || !Number.isFinite(percent)) {
    return null;
  }
  return `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
}

/** ISO8601 → MM-DD HH:mm；null 表示未设截止 */
export function formatDueTime(value: null | string): string {
  if (!value) {
    return '未设截止';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}

export function overdueText(hours: null | number): null | string {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return `超时 ${hours} 小时`;
}

export interface WorkbenchTabItem {
  count: null | number;
  key: 'copy' | 'done' | 'initiated' | 'todo';
  label: string;
}

/** A-07：页签计数 = metrics，不因筛选或去重变化 */
export function buildTabItems(metrics: WorkbenchMetrics): WorkbenchTabItem[] {
  return [
    { count: metrics.todoTotal, key: 'todo', label: '待办' },
    { count: metrics.doneTotal, key: 'done', label: '已办' },
    { count: metrics.initiatedTotal, key: 'initiated', label: '我发起' },
    { count: metrics.copyTotal, key: 'copy', label: '抄送' },
  ];
}
