/**
 * 雪花 ID 归一化。
 *
 * 后端 `BigNumberSerializer` 对超出 JS 安全整数范围的 Long 输出字符串，安全范围内输出数字；
 * 同一字段可能因数据不同而类型不同。所有比较、树 key、表单回显必须先归一化。
 */
export type Id = number | string;

export function toIdKey(id: Id | null | undefined): string {
  if (id === null || id === undefined) {
    return '';
  }
  return String(id);
}

export function sameId(
  left: Id | null | undefined,
  right: Id | null | undefined,
): boolean {
  return toIdKey(left) === toIdKey(right);
}

export function normalizeIds(
  ids?: Array<Id | null | undefined> | null,
): string[] {
  return (ids ?? []).map((id) => toIdKey(id)).filter((id) => id !== '');
}
