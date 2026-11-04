<script setup lang="ts">
import type { MenuTreeOption } from '#/api/system/menu/types';

import { computed, ref } from 'vue';

import { Button, Checkbox, Space, Tree } from 'antdv-next';

const props = withDefaults(
  defineProps<{
    checkedKeys?: string[];
    checkStrictly?: boolean;
    menus?: MenuTreeOption[];
  }>(),
  {
    checkedKeys: () => [],
    checkStrictly: false,
    menus: () => [],
  },
);

const emit = defineEmits<{
  'update:checkedKeys': [keys: string[]];
  'update:checkStrictly': [value: boolean];
}>();

const expandedKeys = ref<string[]>([]);

/** 把后端 ID 统一转字符串，避免 number/string 严格比较导致勾选丢失 */
function normalizeTree(nodes: MenuTreeOption[]): any[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? normalizeTree(node.children) : undefined,
    id: String(node.id),
    parentId: String(node.parentId),
  }));
}

const treeData = computed(() => normalizeTree(props.menus));

function collectIds(nodes: MenuTreeOption[]): string[] {
  return nodes.flatMap((node) => [
    String(node.id),
    ...collectIds(node.children ?? []),
  ]);
}

function handleCheck(keys: any) {
  const list = Array.isArray(keys) ? keys : (keys?.checked ?? []);
  emit(
    'update:checkedKeys',
    list.map(String).filter((key: string) => key !== ''),
  );
}

function selectAll() {
  emit('update:checkedKeys', collectIds(props.menus));
}

function clearAll() {
  emit('update:checkedKeys', []);
}

function expandAll() {
  expandedKeys.value = collectIds(props.menus);
}

function collapseAll() {
  expandedKeys.value = [];
}
</script>

<template>
  <div class="rounded border p-3">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <Space>
        <Checkbox
          :checked="checkStrictly"
          @change="(event: any) => emit('update:checkStrictly', event.target.checked)"
        >
          父子联动
        </Checkbox>
        <Button size="small" @click="selectAll">全选</Button>
        <Button size="small" @click="clearAll">全不选</Button>
        <Button size="small" @click="expandAll">展开</Button>
        <Button size="small" @click="collapseAll">折叠</Button>
      </Space>
    </div>
    <Tree
      v-model:expanded-keys="expandedKeys"
      :check-strictly="!checkStrictly"
      :checked-keys="checkedKeys"
      :field-names="{ children: 'children', key: 'id', title: 'label' }"
      :tree-data="treeData"
      checkable
      @check="handleCheck"
    />
  </div>
</template>
