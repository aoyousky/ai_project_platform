/**
 * Vite 环境变量类型（SPEC-007 §4.3）。
 *
 * 两个外部控制台地址只从部署环境读取；空串表示未配置（E-12），
 * 组件内不得提供硬编码兜底值。
 */
interface ImportMetaEnv {
  readonly VITE_GLOB_MONITOR_ADMIN_URL?: string;
  readonly VITE_GLOB_SNAILJOB_ADMIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
