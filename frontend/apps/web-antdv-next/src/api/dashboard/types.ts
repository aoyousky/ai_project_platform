/**
 * SPEC-005 v1.4 §4.2 / §4.4：首页与工作台聚合接口数据契约。
 *
 * `null` 只表示“无权限 / 未采集 / 不可用 / 未设置”，`0` 表示已采集且确实为零。
 * 雪花 ID 一律为字符串，避免 JS Number 精度丢失。
 */
export type DashboardWarningCode =
  | 'INVALID_DATA'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'UNAVAILABLE';

export interface DashboardWarning {
  field: string;
  code: DashboardWarningCode;
}

export interface HomeMetrics {
  todayErrorLogTotal: null | number;
  todayLoginTotal: null | number;
  onlineTotal: null | number;
  todoTotal: null | number;
  userTotal: null | number;
}

export interface LoginTrendItem {
  count: number;
  date: string;
}

export interface DeptDistributionItem {
  deptId: string;
  deptName: string;
  userCount: number;
}

export type HealthStatus = 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'UP';

export interface HealthService {
  latencyMs: null | number;
  name: string;
  status: HealthStatus;
}

export interface DashboardHealth {
  cpuUsage: null | number;
  diskUsage: null | number;
  memoryUsage: null | number;
  services: HealthService[];
  status: HealthStatus;
}

export interface NoticeItem {
  noticeId: string;
  noticeType: string;
  noticeTypeLabel: string;
  publishTime: null | string;
  title: string;
}

export interface RecentLoginItem {
  ipaddr: string;
  loginTime: string;
  status: 'FAIL' | 'SUCCESS';
  userName: string;
}

export interface RecentOperationItem {
  operName: string;
  operTime: string;
  status: 'FAIL' | 'SUCCESS';
  title: string;
}

export interface HomeResponse {
  deptDistribution: DeptDistributionItem[] | null;
  health: DashboardHealth | null;
  loginTrend: LoginTrendItem[] | null;
  metrics: HomeMetrics;
  notices: NoticeItem[] | null;
  recentLogins: null | RecentLoginItem[];
  recentOperations: null | RecentOperationItem[];
  serverTime: string;
  warnings: DashboardWarning[];
}

export interface WorkbenchMetrics {
  copyTotal: null | number;
  doneTotal: null | number;
  initiatedTotal: null | number;
  todoTotal: null | number;
}

export interface GroupCounts {
  next7Days: number;
  overdue: number;
  today: number;
  unscheduled: number;
}

export type TaskPriority = 'NEXT_7_DAYS' | 'OVERDUE' | 'TODAY' | 'UNSCHEDULED';

export interface WorkbenchTask {
  dueTime: null | string;
  flowName: string;
  initiatorName: string;
  nodeName: string;
  overdueHours: null | number;
  priority: TaskPriority;
  taskId: string;
}

export interface WorkbenchGroups {
  next7Days: WorkbenchTask[];
  overdue: WorkbenchTask[];
  today: WorkbenchTask[];
  unscheduled: WorkbenchTask[];
}

export interface WorkbenchEfficiency {
  avgHandleHours: null | number;
  completedThisWeek: number;
  overdueRate: null | number;
  weeklyTarget: number;
}

export interface FlowProgressItem {
  estimatedEndDate: null | string;
  flowName: string;
  instanceId: string;
  nodeName: string;
  progressPercent: null | number;
}

export interface CommonFlowItem {
  definitionId: string;
  name: string;
}

export interface WorkbenchResponse {
  commonFlows: CommonFlowItem[];
  efficiency: WorkbenchEfficiency;
  flowProgress: FlowProgressItem[];
  groupCounts: GroupCounts;
  groups: WorkbenchGroups;
  metrics: WorkbenchMetrics;
  serverTime: string;
  warnings: DashboardWarning[];
}
