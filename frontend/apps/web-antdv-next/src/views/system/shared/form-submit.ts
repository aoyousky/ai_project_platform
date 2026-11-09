/**
 * 系统管理表单弹窗的公共提交流程（SPEC-004 E-32）。
 *
 * 防重复提交 → 校验 → 构造载荷 → 锁表单 → 新增/修改 → 关闭 → 成功回调。
 * 失败时由请求层统一提示 msg，并保持弹窗与用户输入。
 */
interface FormApiLike {
  getValues: () => Promise<Record<string, any>>;
  validate: () => Promise<{ valid: boolean }>;
}

interface ModalApiLike {
  close: () => Promise<unknown> | unknown;
  lock: (locked: boolean) => void;
}

interface FormConfirmOptions<TPayload> {
  buildPayload: (values: Record<string, any>) => TPayload;
  create: (payload: TPayload) => Promise<unknown>;
  formApi: FormApiLike;
  isEdit: () => boolean;
  modalApi: ModalApiLike;
  onSuccess: () => void;
  update: (payload: TPayload) => Promise<unknown>;
}

/** 返回可直接挂到 `useVbenModal({ onConfirm })` 的提交函数 */
export function createFormConfirmHandler<TPayload>(
  options: FormConfirmOptions<TPayload>,
): () => Promise<void> {
  let submitting = false;

  return async () => {
    if (submitting) {
      return;
    }

    const { valid } = await options.formApi.validate();
    if (!valid || submitting) {
      return;
    }

    const values = (await options.formApi.getValues()) as Record<string, any>;
    const payload = options.buildPayload(values);

    submitting = true;
    options.modalApi.lock(true);
    try {
      await (options.isEdit()
        ? options.update(payload)
        : options.create(payload));
      await options.modalApi.close();
      options.onSuccess();
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与用户输入
    } finally {
      submitting = false;
      options.modalApi.lock(false);
    }
  };
}
