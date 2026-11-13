/** SPEC-008 §4.1：Admin 监控数据转换与脱敏。 */

export interface ConsoleApplication {
  instances?: ConsoleInstance[];
  name: string;
  status: string;
}

export interface ConsoleInstance {
  id: string;
  statusInfo?: { status?: string };
}

export interface ConsolePropertySource {
  name: string;
  properties?: Record<string, string | undefined>;
}

export interface ApplicationRow {
  instanceCount: number;
  name: string;
  status: string;
}

export interface PropertyRow {
  key: string;
  value: string;
}

export interface PropertySourceRows {
  name: string;
  rows: PropertyRow[];
}

/** 环境变量末段命中这些词时脱敏（A-11）；只做精确匹配，避免 keyboard 误伤。 */
const SENSITIVE_SEGMENTS = new Set([
  'accesskey',
  'passwd',
  'password',
  'secret',
  'secretkey',
  'token',
  'userpassword',
]);

function isNonEmpty(value: null | string | undefined): value is string {
  return value !== null && value !== undefined && value !== '';
}

/** 将 `/admin/applications` 响应映射为列表行；缺 `instances` 视为 0（E-01 空数组 → 0 行）。 */
export function applicationRows(
  applications: ConsoleApplication[],
): ApplicationRow[] {
  return applications.map((application) => ({
    instanceCount: application.instances?.length ?? 0,
    name: application.name,
    status: application.status,
  }));
}

/** 控制台 `statusTimestamp` 为 UTC ISO8601，页面统一按 Asia/Shanghai 展示。 */
export function formatStatusTimestamp(
  value: null | string | undefined,
): string {
  if (!isNonEmpty(value)) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick(
    'minute',
  )}:${pick('second')}`;
}

/** 键按 `.`、`_`、`-` 切段后，末段精确命中敏感词才脱敏。 */
export function isSensitiveKey(key: string): boolean {
  const segments = key.toLowerCase().split(/[._-]+/);
  const last = segments.at(-1) ?? '';
  return SENSITIVE_SEGMENTS.has(last);
}

/** 敏感值一律显示 `***`；空值显示「—」，`0` 原样保留。 */
function displayProperty(key: string, value: string | undefined): string {
  if (isSensitiveKey(key)) {
    return '***';
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

export function maskPropertySources(
  sources: ConsolePropertySource[],
): PropertySourceRows[] {
  return sources.map((source) => {
    const properties = source.properties ?? {};
    return {
      name: source.name,
      rows: Object.entries(properties).map(([key, value]) => ({
        key,
        value: displayProperty(key, value),
      })),
    };
  });
}

/**
 * SPEC-008 §5：日志中的令牌样式字符串脱敏——`Bearer` 与 `SNAIL-JOB-AUTH`
 * 后的值一律显示 `***`，头名/分隔符保留。
 */
export function maskLogLine(line: string): string {
  return line
    .replaceAll(/(Bearer\s+)[^\s"',;]+/giu, '$1***')
    .replaceAll(/(SNAIL-JOB-AUTH[:\s=]+)[^\s"',;]+/giu, '$1***');
}

/** 日志只渲染尾部 N 行（E-04）；末尾换行不产生空行；渲染前按 §5 脱敏。 */
export function tailLines(text: string, max: number): string[] {
  if (text === '') {
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines.slice(-Math.max(0, max)).map((line) => maskLogLine(line));
}
