<script setup lang="ts">
import type { MenuTreeOption, MenuVO } from '#/api/system/menu/types';
import type { TreeSelectOption } from '#/utils/system/tree';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { addMenuApi, updateMenuApi } from '#/api/system/menu';

import { buildMenuFormSchema } from '../menu-form-schema';
import { buildMenuSubmitPayload, toMenuFormValues } from '../menu-page-logic';

interface MenuFormModalData {
  menu?: MenuVO;
  mode: 'create' | 'edit';
  parentId?: number | string;
  parentOptions: MenuTreeOption[];
}

const emit = defineEmits<{ success: [] }>();

const mode = ref<'create' | 'edit'>('create');
const editingMenuId = ref<number | string>();

const [Form, formApi] = useVbenForm({
  commonConfig: { labelWidth: 90 },
  schema: [],
  showDefaultActions: false,
});

function toTreeSelectOptions(
  nodes: MenuTreeOption[],
): TreeSelectOption[] {
  return nodes.map((node) => ({
    label: node.label,
    value: String(node.id),
    ...(node.children && node.children.length > 0
      ? { children: toTreeSelectOptions(node.children) }
      : {}),
  }));
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = (await formApi.getValues()) as Record<string, any>;
    const payload = buildMenuSubmitPayload(
      values,
      mode.value === 'edit' ? editingMenuId.value : undefined,
    );

    modalApi.lock(true);
    try {
      await (mode.value === 'edit' ? updateMenuApi(payload) : addMenuApi(payload));
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

    const data = modalApi.getData<MenuFormModalData>();
    mode.value = data.mode;
    editingMenuId.value = data.menu?.menuId;

    formApi.setState({
      schema: buildMenuFormSchema({
        parentOptions: [
          {
            label: '主类目',
            value: '0',
            children: toTreeSelectOptions(data.parentOptions ?? []),
          },
        ],
      }),
    });

    const values =
      data.mode === 'edit' && data.menu
        ? toMenuFormValues(data.menu)
        : {
            activeRoute: '',
            component: '',
            icon: '',
            isCache: '0',
            isFrame: '1',
            menuName: '',
            menuType: 'M',
            orderNum: 1,
            parentId: String(data.parentId ?? '0'),
            path: '',
            perms: '',
            queryParam: '',
            remark: '',
            status: '0',
            visible: '0',
          };

    formApi.resetForm();
    formApi.setValues(values);
    modalApi.setState({
      title: data.mode === 'edit' ? '修改菜单' : '新增菜单',
    });
  },
});
</script>

<template>
  <Modal class="w-[720px]">
    <Form />
  </Modal>
</template>
