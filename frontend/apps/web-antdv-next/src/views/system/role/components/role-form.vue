<script setup lang="ts">
import type { MenuTreeOption } from '#/api/system/menu/types';
import type { RoleVO } from '#/api/system/role/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addRoleApi, updateRoleApi } from '#/api/system/role';

import {
  buildRoleSubmitPayload,
  toRoleFormValues,
} from '../role-page-logic';
import MenuPermissionTree from './menu-permission-tree.vue';

interface RoleFormModalData {
  checkedKeys?: string[];
  menus: MenuTreeOption[];
  mode: 'create' | 'edit';
  role?: RoleVO;
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const roleId = ref<string>();
const checkedKeys = ref<string[]>([]);
const checkStrictly = ref(false);
const menus = ref<MenuTreeOption[]>([]);

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [
    {
      component: 'Input',
      componentProps: { placeholder: '请输入角色名称' },
      fieldName: 'roleName',
      label: '角色名称',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '请输入权限字符' },
      fieldName: 'roleKey',
      label: '权限字符',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 1,
      fieldName: 'roleSort',
      label: '角色顺序',
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: '正常', value: '0' },
          { label: '停用', value: '1' },
        ],
      },
      defaultValue: '0',
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Textarea',
      componentProps: { placeholder: '请输入内容', rows: 3 },
      fieldName: 'remark',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = (await formApi.getValues()) as Record<string, any>;
    const payload = buildRoleSubmitPayload(
      {
        ...values,
        menuCheckStrictly: checkStrictly.value,
        menuIds: checkedKeys.value,
      },
      roleId.value,
    );

    modalApi.lock(true);
    try {
      await (mode.value === 'edit'
        ? updateRoleApi(payload)
        : addRoleApi(payload));
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示；保持弹窗与用户输入
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<RoleFormModalData>();
    mode.value = data.mode;
    menus.value = data.menus ?? [];
    checkedKeys.value = data.checkedKeys ?? [];
    checkStrictly.value = data.role?.menuCheckStrictly ?? false;

    const values =
      data.mode === 'edit' && data.role
        ? toRoleFormValues(data.role, data.checkedKeys)
        : {
            menuCheckStrictly: false,
            menuIds: [],
            remark: '',
            roleKey: '',
            roleName: '',
            roleSort: 1,
            status: '0',
          };
    roleId.value = values.roleId === undefined ? undefined : String(values.roleId);

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改角色' : '新增角色',
    });
  },
});
</script>

<template>
  <Modal class="w-[720px]">
    <Form />
    <div class="mt-3">
      <div class="mb-2 text-sm font-medium">菜单权限</div>
      <MenuPermissionTree
        v-model:checked-keys="checkedKeys"
        v-model:check-strictly="checkStrictly"
        :menus="menus"
      />
    </div>
  </Modal>
</template>
