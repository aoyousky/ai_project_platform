/**
 * 状态开关的乐观更新与失败回滚（SPEC-002 A-09 / SPEC-003 A-19）。
 *
 * 先更新 UI，提交成功后刷新；提交失败回滚到原状态并返回 false，
 * 由调用方决定是否额外提示（错误文案由请求层统一展示）。
 */
export async function runStatusToggle(options: {
  apply: (status: string) => void;
  commit: () => Promise<unknown>;
  nextStatus: string;
  onError?: (error: unknown) => void;
  previousStatus: string;
  reload: () => Promise<unknown> | undefined;
}): Promise<boolean> {
  options.apply(options.nextStatus);

  try {
    await options.commit();
  } catch (error) {
    options.apply(options.previousStatus);
    options.onError?.(error);
    return false;
  }

  await options.reload();
  return true;
}
