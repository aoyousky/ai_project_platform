/** SPEC-008 §4.2：SnailJob 数据转换。 */

/** JobTaskStatusEnum：2 RUNNING / 3 SUCCESS / 4 FAIL / 5 STOP / 6 CANCEL。 */
const TASK_STATUS_TEXT: Record<number, string> = {
  2: '运行中',
  3: '成功',
  4: '失败',
  5: '已停止',
  6: '已取消',
};

export interface JobRow {
  groupName: string;
  id: number;
  jobName: string;
  nextTriggerAt: string;
  statusText: string;
}

export interface TaskRow {
  createDt: string;
  status: number;
  statusText: string;
  taskBatchId: number;
}

export function taskStatusText(status: number): string {
  return TASK_STATUS_TEXT[status] ?? '—';
}

/** 只有运行中的批次可停止（A-08）。 */
export function canStop(status: number): boolean {
  return status === 2;
}

/** 只有失败的批次可重试（A-09）。 */
export function canRetry(status: number): boolean {
  return status === 4;
}

export function formatDateTime(value: null | string | undefined): string {
  return value === null || value === undefined || value === ''
    ? '—'
    : String(value);
}

/** `jobStatus` 为 `StatusEnum`：1 启用 / 0 停用。 */
export function mapJobRows(
  jobs: Array<{
    groupName?: null | string;
    id: number;
    jobName: string;
    jobStatus: number;
    nextTriggerAt?: null | string;
  }>,
): JobRow[] {
  return jobs.map((job) => ({
    groupName: formatDateTime(job.groupName),
    id: job.id,
    jobName: job.jobName,
    nextTriggerAt: formatDateTime(job.nextTriggerAt),
    statusText: job.jobStatus === 0 ? '停用' : '启用',
  }));
}

export function mapTaskRows(
  tasks: Array<{
    createDt?: null | string;
    status: number;
    taskBatchId: number;
  }>,
): TaskRow[] {
  return tasks.map((task) => ({
    createDt: formatDateTime(task.createDt),
    status: task.status,
    statusText: taskStatusText(task.status),
    taskBatchId: task.taskBatchId,
  }));
}
