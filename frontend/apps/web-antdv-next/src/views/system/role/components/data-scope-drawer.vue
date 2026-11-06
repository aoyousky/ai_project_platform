<script setup lang="ts">
import type { DeptTreeOption } from '#/api/system/dept/types';
import type { RoleVO } from '#/api/system/role/types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Checkbox, Radio, RadioGroup, Space, Spin, Tree } from 'antdv-next';

import { getRoleDeptTreeApi, updateRoleDataScopeApi } from '#/api/system/role';

import { DATA_SCOPE_OPTIONS, isCustomDataScope } from '../role-page-logic';

interface DataScopeModalData {
  role: RoleVO;
}

const emit = defineEmits<{ success: [] }>();

const role = ref<null | RoleVO>(null);
const dataScope = ref('1');
const deptCheckStrictly = ref(false);
const checkedKeys = ref<string[]>([]);
const depts = ref<DeptTreeOption[]>([]);
const loading = ref(false);
const expandedKeys = ref<string[]>([]);

const showDeptTree = computed(() => isCustomDataScope(dataScope.value));

function normalizeTree(nodes: DeptTreeOption[]): any[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? normalizeTree(node.children) : undefined,
    id: String(node.id),
    parentId: String(node.parentId),
  }));
}

const treeData = computed(() => normalizeTree(depts.value));

function collectIds(nodes: DeptTreeOption[]): string[] {
  return nodes.flatMap((node) => [
    String(node.id),
    ...collectIds(node.children ?? []),
  ]);
}

function handleCheck(keys: any) {
  const list = Array.isArray(keys) ? keys : (keys?.checked ?? []);
  checkedKeys.value = list.map(String).filter((key: string) => key !== '');
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!role.value) {
      return;
    }

    modalApi.lock(true);
    try {
      await updateRoleDataScopeApi({
        dataScope: dataScope.value,
        deptCheckStrictly: deptCheckStrictly.value,
        // 非自定义范围必须提交空数组，后端据此清空旧部门关联（SPEC-003 §6）
        deptIds: showDeptTree.value ? checkedKeys.value : [],
        roleId: role.value.roleId,
      });
      await modalApi.close();
      emit('success');
    } catch {
      // 后端 msg 由请求层统一提示
    } finally {
      modalApi.lock(false);
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<DataScopeModalData>();
    role.value = data.role;
    dataScope.value = data.role.dataScope ?? '1';
    deptCheckStrictly.value = data.role.deptCheckStrictly ?? false;
    checkedKeys.value = [];
    depts.value = [];
    expandedKeys.value = [];
    loading.value = true;

    try {
      const tree = await getRoleDeptTreeApi(data.role.roleId);
      checkedKeys.value = (tree.checkedKeys ?? []).map(String);
      depts.value = tree.depts ?? [];
    } finally {
      loading.value = false;
    }

    modalApi.setState({ title: `数据权限 - ${data.role.roleName}` });
  },
});
</script>

<template>
  <Modal class="w-[560px]">
    <Spin :spinning="loading">
      <div class="mb-3">
        <div class="mb-2 text-sm font-medium">数据范围</div>
        <RadioGroup v-model:value="dataScope">
          <Space direction="vertical">
            <Radio
              v-for="option in DATA_SCOPE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </Radio>
          </Space>
        </RadioGroup>
      </div>

      <div v-if="showDeptTree">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">部门权限</span>
          <Space>
            <Checkbox
              :checked="deptCheckStrictly"
              @change="(event: any) => (deptCheckStrictly = event.target.checked)"
            >
              父子联动
            </Checkbox>
            <Button size="small" @click="checkedKeys = collectIds(depts)">
              全选
            </Button>
            <Button size="small" @click="checkedKeys = []">全不选</Button>
            <Button size="small" @click="expandedKeys = collectIds(depts)">
              展开
            </Button>
            <Button size="small" @click="expandedKeys = []">折叠</Button>
          </Space>
        </div>
        <Tree
          v-model:expanded-keys="expandedKeys"
          :check-strictly="!deptCheckStrictly"
          :checked-keys="checkedKeys"
          :field-names="{ children: 'children', key: 'id', title: 'label' }"
          :tree-data="treeData"
          checkable
          @check="handleCheck"
        />
      </div>
    </Spin>
  </Modal>
</template>
