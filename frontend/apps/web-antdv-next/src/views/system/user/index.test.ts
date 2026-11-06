import { describe, expect, it, vi } from 'vitest';

// schema 构建只用到链式规则对象，避免把整套 UI 适配器拉进单测
vi.mock('#/adapter/form', () => {
  const chain: any = {
    email: () => chain,
    literal: () => chain,
    max: () => chain,
    min: () => chain,
    optional: () => chain,
    or: () => chain,
    regex: () => chain,
    string: () => chain,
  };
  return { z: chain };
});

import { buildUserFormSchema, PHONE_PATTERN } from './user-form-schema';
import {
  buildDeptSelectOptions,
  canModifyUser,
  defaultUserFormValues,
  importResultText,
  resolveOutOfRangePage,
  runStatusToggle,
  toUserFormState,
  toUserSubmitPayload,
  withDeptFilter,
} from './user-page-logic';

const roleOption = { roleId: '2', roleKey: 'common', roleName: '普通角色' };
const postOption = { postId: '3', postName: '研发' };

describe('用户页逻辑（A-05 / A-08 / A-09 / A-14）', () => {
  it('部门树筛选：写入 deptId，清除时移除该字段', () => {
    expect(withDeptFilter({ userName: 'ry' }, '100')).toEqual({
      deptId: '100',
      userName: 'ry',
    });
    expect(withDeptFilter({ deptId: '100', userName: 'ry' }, null)).toEqual({
      userName: 'ry',
    });
  });

  it('部门树：过滤 disabled 部门及其子树，转换为 TreeSelect 选项', () => {
    const options = buildDeptSelectOptions([
      {
        id: '1',
        label: '总公司',
        parentId: '0',
        children: [
          { id: 2, label: '研发部', parentId: '1' },
          {
            id: '3',
            label: '停用部',
            parentId: '1',
            disabled: true,
            children: [{ id: '4', label: '停用子部门', parentId: '3' }],
          },
        ],
      },
    ]);

    expect(options).toEqual([
      {
        children: [{ label: '研发部', value: '2' }],
        label: '总公司',
        value: '1',
      },
    ]);
  });

  it('userId=1 不渲染修改/删除/重置密码/分配角色入口（A-05）', () => {
    expect(canModifyUser(1)).toBe(false);
    expect(canModifyUser('1')).toBe(false);
    expect(canModifyUser('1820000000000000001')).toBe(true);
  });

  it('编辑自己时不提交部门/角色/岗位（A-03）', () => {
    const { selfEditing, values } = toUserFormState(
      {
        postIds: ['3'],
        posts: [postOption],
        roleIds: ['2'],
        roles: [roleOption],
        user: {
          deptId: '1',
          nickName: '管理员',
          status: '0',
          userId: '1',
          userName: 'admin',
        },
      },
      '1',
    );

    expect(selfEditing).toBe(true);
    expect(values).toMatchObject({ deptId: '1', roleIds: ['2'], postIds: ['3'] });

    const payload = toUserSubmitPayload(values, {
      isEdit: true,
      selfEditing,
    });
    expect(payload).not.toHaveProperty('deptId');
    expect(payload).not.toHaveProperty('roleIds');
    expect(payload).not.toHaveProperty('postIds');
    expect(payload).not.toHaveProperty('password');
  });

  it('编辑他人时保留部门/角色/岗位，编辑态不提交密码', () => {
    const payload = toUserSubmitPayload(
      {
        deptId: '1',
        nickName: '张三',
        password: 'abcd1234',
        postIds: ['3'],
        roleIds: ['2'],
        userId: '9',
        userName: 'zhangsan',
      },
      { isEdit: true, selfEditing: false },
    );

    expect(payload).toMatchObject({
      deptId: '1',
      postIds: ['3'],
      roleIds: ['2'],
    });
    expect(payload).not.toHaveProperty('password');
  });

  it('编辑提交时从上下文补 userId（表单值不含 userId）', () => {
    const payload = toUserSubmitPayload(
      { nickName: '张三', userName: 'zhangsan' },
      { isEdit: true, selfEditing: false, userId: '9' },
    );

    expect(payload.userId).toBe('9');
  });

  it('新增用户保留密码字段', () => {
    const payload = toUserSubmitPayload(
      {
        deptId: '1',
        nickName: '张三',
        password: 'abcd1234',
        userName: 'zhangsan',
      },
      { isEdit: false, selfEditing: false },
    );

    expect(payload.password).toBe('abcd1234');
  });

  it('状态开关失败回滚到原状态，并刷新仅在成功时发生（A-09）', async () => {
    const apply = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockRejectedValue(new Error('不允许操作超级管理员用户'));

    await expect(
      runStatusToggle({
        apply,
        commit,
        nextStatus: '1',
        previousStatus: '0',
        reload,
      }),
    ).resolves.toBe(false);

    expect(apply.mock.calls).toEqual([['1'], ['0']]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('状态开关成功保持新状态并刷新', async () => {
    const apply = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const commit = vi.fn().mockResolvedValue(undefined);

    await expect(
      runStatusToggle({
        apply,
        commit,
        nextStatus: '1',
        previousStatus: '0',
        reload,
      }),
    ).resolves.toBe(true);

    expect(apply.mock.calls).toEqual([['1']]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('页码超出总页数时回退到最后一页（E-10）', () => {
    expect(
      resolveOutOfRangePage({ pageNum: 5, pageSize: 10, rowCount: 0, total: 3 }),
    ).toBe(1);
    expect(
      resolveOutOfRangePage({ pageNum: 4, pageSize: 2, rowCount: 0, total: 5 }),
    ).toBe(3);
    expect(
      resolveOutOfRangePage({ pageNum: 3, pageSize: 10, rowCount: 0, total: 25 }),
    ).toBeNull();
    expect(
      resolveOutOfRangePage({ pageNum: 2, pageSize: 10, rowCount: 1, total: 1 }),
    ).toBeNull();
    expect(
      resolveOutOfRangePage({ pageNum: 2, pageSize: 10, rowCount: 0, total: 0 }),
    ).toBeNull();
    expect(
      resolveOutOfRangePage({ pageNum: 1, pageSize: 10, rowCount: 0, total: 0 }),
    ).toBeNull();
  });

  it('导入结果以纯文本展示后端 msg（A-14）', () => {
    expect(
      importResultText({ code: 200, msg: '恭喜您，数据已全部导入成功！共 3 条。' }),
    ).toBe('恭喜您，数据已全部导入成功！共 3 条。');
    expect(importResultText({ code: 500, msg: '导入失败' })).toBe('导入失败');
  });

  it('新增才渲染密码字段，编辑不渲染（A-02 / A-03）', () => {
    const context = {
      deptOptions: [],
      postOptions: [],
      roleOptions: [],
      selfEditing: false,
    };

    const createFields = buildUserFormSchema({
      ...context,
      isEdit: false,
    }).map((item) => item.fieldName);
    expect(createFields).toContain('password');

    const editFields = buildUserFormSchema({
      ...context,
      isEdit: true,
    }).map((item) => item.fieldName);
    expect(editFields).not.toContain('password');
  });

  it('手机号与邮箱有格式校验（E-04）', () => {
    const schema = buildUserFormSchema({
      deptOptions: [],
      isEdit: false,
      postOptions: [],
      roleOptions: [],
      selfEditing: false,
    });
    const rulesOf = (fieldName: string) =>
      schema.find((item) => item.fieldName === fieldName)?.rules;

    expect(rulesOf('phonenumber')).toBeTruthy();
    expect(rulesOf('email')).toBeTruthy();
    expect(PHONE_PATTERN.test('15888888888')).toBe(true);
    expect(PHONE_PATTERN.test('12345')).toBe(false);
    expect(PHONE_PATTERN.test('')).toBe(false);
  });

  it('编辑态用户名称只读，新增态可填（数据契约 §4）', () => {
    const base = {
      deptOptions: [],
      postOptions: [],
      roleOptions: [],
      selfEditing: false,
    };
    const userNameProps = (isEdit: boolean) => {
      const field = buildUserFormSchema({ ...base, isEdit }).find(
        (item) => item.fieldName === 'userName',
      );
      return field?.componentProps as Record<string, any> | undefined;
    };

    expect(userNameProps(true)?.disabled).toBe(true);
    expect(userNameProps(false)?.disabled).toBeFalsy();
  });

  it('编辑自己时部门/岗位/角色控件禁用（A-03）', () => {
    const schema = buildUserFormSchema({
      deptOptions: [],
      isEdit: true,
      postOptions: [],
      roleOptions: [],
      selfEditing: true,
    });

    for (const fieldName of ['deptId', 'postIds', 'roleIds']) {
      const field = schema.find((item) => item.fieldName === fieldName);
      const props = field?.componentProps as Record<string, any> | undefined;
      expect(props?.disabled).toBe(true);
    }
  });

  it('新增表单初始值不包含密码（不硬编码初始密码）', () => {
    expect(defaultUserFormValues()).not.toHaveProperty('password');
  });
});
