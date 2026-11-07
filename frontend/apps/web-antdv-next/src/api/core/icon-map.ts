/**
 * 后端菜单图标名（plus-ui 的 SVG 资产名）→ iconify 名称。
 *
 * SPEC-001 §4/§7 与 research R10：Vben 用 iconify 字符串渲染图标，后端图标名
 * 直接透传会导致菜单无图标；未收录的名称回退 `lucide:circle` 并告警一次，
 * 便于运营发现错配（不搬运 plus-ui 的 SVG 资产）。
 */
const ICON_MAP: Record<string, string> = {
  category: 'lucide:folder-tree',
  chart: 'lucide:bar-chart-3',
  code: 'lucide:code',
  dashboard: 'lucide:layout-dashboard',
  dict: 'lucide:book-open',
  edit: 'lucide:pencil',
  finish: 'lucide:circle-check',
  form: 'lucide:file-text',
  guide: 'lucide:book-open',
  input: 'lucide:log-in',
  international: 'lucide:globe',
  job: 'lucide:clock',
  list: 'lucide:list',
  log: 'lucide:scroll-text',
  logininfor: 'lucide:history',
  message: 'lucide:message-square',
  monitor: 'lucide:activity',
  'my-copy': 'lucide:copy',
  'my-task': 'lucide:clipboard-list',
  online: 'lucide:users',
  peoples: 'lucide:users',
  post: 'lucide:briefcase',
  'process-definition': 'lucide:workflow',
  redis: 'lucide:database',
  star: 'lucide:star',
  system: 'lucide:settings',
  tool: 'lucide:wrench',
  tree: 'lucide:network',
  'tree-table': 'lucide:table',
  upload: 'lucide:upload',
  user: 'lucide:user',
  waiting: 'lucide:hourglass',
  workflow: 'lucide:workflow',
};

/** 已告警过的未映射图标名；同一名称只告警一次。 */
const warnedIcons = new Set<string>();

export function mapMenuIcon(icon?: null | string): string | undefined {
  if (!icon || icon === '#') {
    return undefined;
  }
  // 只认自有属性，避免 `toString` / `__proto__` 等原型链键被误当作已映射图标。
  const mapped = Object.prototype.hasOwnProperty.call(ICON_MAP, icon)
    ? ICON_MAP[icon]
    : undefined;
  if (mapped) {
    return mapped;
  }
  if (!warnedIcons.has(icon)) {
    warnedIcons.add(icon);
    console.warn(
      `[menu] 未映射的菜单图标 "${icon}"，已回退 lucide:circle`,
    );
  }
  return 'lucide:circle';
}
