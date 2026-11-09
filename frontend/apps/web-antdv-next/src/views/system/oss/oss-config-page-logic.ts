/**
 * 文件配置页可测逻辑（SPEC-004 A-08 / A-16 / E-22 / E-24 / E-31 / E-32）。
 *
 * 查询组装、表单 schema、提交载荷、默认切换与失败回滚放在这里；
 * `secretKey` 只作为表单字段存在，本模块不输出任何日志。
 */
import type { VbenFormSchema } from '#/adapter/form';
import type {
  OssConfig,
  OssConfigForm,
  OssConfigQuery,
  OssConfigStatusPayload,
} from '#/api/system/oss/config-types';

import { z } from '#/adapter/form';
import {
  buildListQuery,
  type PageParam,
  trimmedOrNull,
} from '#/utils/system/query';
import { runStatusToggle } from '#/utils/system/status';

/** 查询：搜索表单 + 分页；空白条件移除 */
export function buildOssConfigQuery(
  formValues: Record<string, any>,
  page?: PageParam,
): OssConfigQuery {
  return buildListQuery<OssConfigQuery>(formValues, page, undefined, {
    withDateRange: false,
  });
}

/** 状态展示：0=默认、1=非默认；未知值原样返回，不空白 */
export function statusLabel(status?: null | string): string {
  const key = String(status ?? '');
  if (key === '0') {
    return '默认';
  }
  if (key === '1') {
    return '非默认';
  }
  return key;
}

/** 协议前缀：isHttps='Y' 为 https，其余为 http */
export function protocolPrefix(isHttps?: null | string): 'http://' | 'https://' {
  return isHttps === 'Y' ? 'https://' : 'http://';
}

/** 列表“访问站点”展示：按 isHttps 补协议；endpoint 已带协议时不重复拼接 */
export function endpointDisplay(
  endpoint?: null | string,
  isHttps?: null | string,
): string {
  const text = String(endpoint ?? '').trim();
  if (text.startsWith('http://') || text.startsWith('https://')) {
    return text;
  }
  return `${protocolPrefix(isHttps)}${text}`;
}

/** 新增表单默认值：非默认、HTTP、私有桶 */
export function buildOssConfigDefaults(): Record<string, any> {
  return {
    accessKey: '',
    accessPolicy: '0',
    bucketName: '',
    configKey: '',
    domain: '',
    endpoint: '',
    isHttps: 'N',
    prefix: '',
    region: '',
    remark: '',
    secretKey: '',
    status: '1',
  };
}

const REQUIRED_LENGTH_MESSAGE = (label: string) =>
  `${label}长度必须介于2和100之间`;

function requiredTextRule(label: string) {
  return z
    .string()
    .min(2, REQUIRED_LENGTH_MESSAGE(label))
    .max(100, REQUIRED_LENGTH_MESSAGE(label));
}

/** 表单 schema（新增/编辑共用）；`secretKey` 用 InputPassword 遮蔽（E-31） */
export function createOssConfigFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入配置key' },
      fieldName: 'configKey',
      label: '配置key',
      rules: requiredTextRule('configKey'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入accessKey' },
      fieldName: 'accessKey',
      label: '访问密钥',
      rules: requiredTextRule('accessKey'),
    },
    {
      component: 'InputPassword',
      componentProps: { maxlength: 100, placeholder: '请输入secretKey' },
      fieldName: 'secretKey',
      label: '私有密钥',
      rules: requiredTextRule('secretKey'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入桶名称' },
      fieldName: 'bucketName',
      label: '桶名称',
      rules: requiredTextRule('桶名称'),
    },
    {
      component: 'Input',
      componentProps: (values) => ({
        addonBefore: protocolPrefix(values.isHttps),
        maxlength: 100,
        placeholder: '请输入访问站点',
      }),
      fieldName: 'endpoint',
      label: '访问站点',
      rules: requiredTextRule('访问站点'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入前缀' },
      fieldName: 'prefix',
      label: '前缀',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 200, placeholder: '请输入自定义域名' },
      fieldName: 'domain',
      label: '自定义域名',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100, placeholder: '请输入域' },
      fieldName: 'region',
      label: '域',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '是', value: 'Y' },
          { label: '否', value: 'N' },
        ],
      },
      defaultValue: 'N',
      fieldName: 'isHttps',
      label: '是否HTTPS',
      rules: z.string().min(1, '请选择是否HTTPS'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '私有', value: '0' },
          { label: '公开', value: '1' },
          { label: '自定义', value: '2' },
        ],
      },
      defaultValue: '0',
      fieldName: 'accessPolicy',
      label: '桶权限类型',
      rules: z.string().min(1, '请选择桶权限类型'),
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 500, placeholder: '请输入备注', rows: 3 },
      fieldName: 'remark',
      label: '备注',
    },
  ];
}

/**
 * 表单值 → 提交体。
 * 新增缺省 status='1'（非默认）；编辑由调用方传入原状态，避免表单改动默认值。
 */
export function buildOssConfigPayload(
  values: Record<string, any>,
  ossConfigId?: number | string,
  status?: string,
): OssConfigForm {
  const payload: OssConfigForm = {
    accessKey: String(values.accessKey ?? '').trim(),
    accessPolicy: String(values.accessPolicy ?? '0').trim() || '0',
    bucketName: String(values.bucketName ?? '').trim(),
    configKey: String(values.configKey ?? '').trim(),
    domain: trimmedOrNull(values.domain),
    endpoint: String(values.endpoint ?? '').trim(),
    isHttps: String(values.isHttps ?? 'N').trim() || 'N',
    prefix: trimmedOrNull(values.prefix),
    region: trimmedOrNull(values.region),
    remark: trimmedOrNull(values.remark),
    secretKey: String(values.secretKey ?? '').trim(),
    status: String(status ?? values.status ?? '1').trim() || '1',
  };

  if (ossConfigId !== undefined && ossConfigId !== null) {
    payload.ossConfigId = ossConfigId;
  }

  return payload;
}

/** 详情 → 表单回显；空值转空字符串 */
export function toOssConfigFormValues(
  config: OssConfig,
): Record<string, any> {
  return {
    ...buildOssConfigDefaults(),
    accessKey: config.accessKey,
    accessPolicy: config.accessPolicy,
    bucketName: config.bucketName,
    configKey: config.configKey,
    domain: config.domain ?? '',
    endpoint: config.endpoint,
    isHttps: config.isHttps,
    prefix: config.prefix ?? '',
    region: config.region ?? '',
    remark: config.remark ?? '',
    secretKey: config.secretKey,
    status: config.status,
  };
}

/** 切换默认载荷：status 固定 '0' */
export function buildSetDefaultPayload(
  row: Pick<OssConfig, 'configKey' | 'ossConfigId'>,
): OssConfigStatusPayload {
  return {
    configKey: row.configKey,
    ossConfigId: row.ossConfigId,
    status: '0',
  };
}

/**
 * 设为默认：乐观展示开关 → 提交 → 失败回滚原状态并重载（A-16）。
 * 请求层负责错误提示；本函数只保证 UI 状态一致。
 */
export async function applyDefaultSwitch(
  row: OssConfig,
  changeStatus: (
    payload: OssConfigStatusPayload,
  ) => Promise<unknown>,
  reload: () => Promise<void>,
): Promise<boolean> {
  const ok = await runStatusToggle({
    apply: (status) => {
      row.status = status;
    },
    commit: () => changeStatus(buildSetDefaultPayload(row)),
    nextStatus: '0',
    previousStatus: row.status,
    reload,
  });
  if (!ok) {
    // 失败时用服务端数据覆盖开关的受控状态（A-16）
    await reload();
  }
  return ok;
}
