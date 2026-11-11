/**
 * 外部控制台（Admin 监控 / 任务调度中心）纯逻辑（SPEC-007 §4.3、E-12）。
 * 地址只来自环境变量；空串或纯空白表示未配置。
 */
export function isConfigured(url: string | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * 地址来源优先级：`window` 运行时配置（生产构建由 `_app.config.js` 注入）
 * 高于构建期环境值（开发态 `import.meta.env`）。运行时键存在但为空串时
 * 按未配置处理，不得回退到构建值（E-12）。
 */
export function resolveConsoleUrl(
  key: string,
  env: Record<string, any> | undefined,
  runtimeConfig: Record<string, unknown> | undefined,
): string {
  const runtimeValue = runtimeConfig?.[key];
  if (typeof runtimeValue === 'string') {
    return runtimeValue;
  }
  const buildValue = env?.[key];
  return typeof buildValue === 'string' ? buildValue : '';
}

export function externalLinkProps(url: string | undefined): {
  href: string;
  rel: string;
  target: string;
} {
  return {
    href: url ?? '',
    rel: 'noopener noreferrer',
    target: '_blank',
  };
}
