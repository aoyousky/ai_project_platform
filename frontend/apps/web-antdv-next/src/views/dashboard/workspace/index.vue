<script lang="ts" setup>
import type { GroupKey, TaskFilter } from './workbench-page-logic';

import type {
  TaskPriority,
  WorkbenchGroups,
  WorkbenchMetrics,
  WorkbenchResponse,
  WorkbenchTask,
} from '#/api/dashboard/types';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Button, Card, Skeleton, Tag } from 'antdv-next';

import { getDashboardWorkbenchApi } from '#/api/dashboard/workbench';

import {
  buildTabItems,
  dedupeTasks,
  efficiencyBarWidth,
  efficiencyText,
  filterTasks,
  formatDueTime,
  formatEfficiencyHours,
  GROUP_KEYS,
  groupLabel,
  overdueText,
  priorityLabel,
  progressBarWidth,
  sortTasks,
} from './workbench-page-logic';

defineOptions({ name: 'DashboardWorkspace' });

const router = useRouter();

const EMPTY_METRICS: WorkbenchMetrics = {
  copyTotal: null,
  doneTotal: null,
  initiatedTotal: null,
  todoTotal: null,
};

const EMPTY_GROUPS: WorkbenchGroups = {
  next7Days: [],
  overdue: [],
  today: [],
  unscheduled: [],
};

/** E-16：500ms 内连续点击只允许一个请求在途，并留 800ms 起始冷却 */
const REFRESH_COOLDOWN_MS = 800;

const data = ref<null | WorkbenchResponse>(null);
const loading = ref(true);
const loadError = ref(false);
const inFlight = ref(false);
const lastStartedAt = ref(0);

const activeTab = ref<'copy' | 'done' | 'initiated' | 'todo'>('todo');
const filter = ref<TaskFilter>('all');
const selectedTaskIds = ref<Set<string>>(new Set());

const metrics = computed(() => data.value?.metrics ?? EMPTY_METRICS);
const groups = computed(() => data.value?.groups ?? EMPTY_GROUPS);
const groupCounts = computed(
  () =>
    data.value?.groupCounts ?? {
      next7Days: 0,
      overdue: 0,
      today: 0,
      unscheduled: 0,
    },
);

const tabItems = computed(() => buildTabItems(metrics.value));

/** 全局去重 + 稳定排序，保证 DOM 中 taskId 不重复（E-07 / E-16） */
const allTasks = computed(() =>
  sortTasks(dedupeTasks(filterTasks(groups.value, 'all'))),
);

const tasksByGroup = computed(() => {
  const map = new Map<GroupKey, WorkbenchTask[]>();
  for (const key of GROUP_KEYS) {
    map.set(key, []);
  }
  for (const task of allTasks.value) {
    const key = groupOf(task.priority);
    map.get(key)?.push(task);
  }
  return map;
});

const visibleTasks = computed(() =>
  filter.value === 'all'
    ? allTasks.value
    : sortTasks(filterTasks(groups.value, filter.value)),
);

const groupSections = computed(() => {
  const keys: GroupKey[] =
    filter.value === 'all'
      ? GROUP_KEYS.filter(
          (key) =>
            key !== 'unscheduled' ||
            (groupCounts.value.unscheduled ?? 0) > 0,
        )
      : [filter.value];

  return keys.map((key) => ({
    count: groupCounts.value[key] ?? 0,
    key,
    label: groupLabel(key),
    tasks:
      filter.value === 'all'
        ? (tasksByGroup.value.get(key) ?? [])
        : visibleTasks.value,
    testId: groupTestId(key),
  }));
});

const efficiency = computed(
  () =>
    data.value?.efficiency ?? {
      avgHandleHours: null,
      completedThisWeek: 0,
      overdueRate: null,
      weeklyTarget: 20,
    },
);

const efficiencyWidth = computed(() =>
  efficiencyBarWidth(
    efficiency.value.completedThisWeek,
    efficiency.value.weeklyTarget,
  ),
);

const flowProgress = computed(() => data.value?.flowProgress ?? []);
const commonFlows = computed(() => data.value?.commonFlows ?? []);

const selectedCount = computed(() => selectedTaskIds.value.size);

const tabSummary = computed(() => {
  const item = tabItems.value.find((tab) => tab.key === activeTab.value);
  return item?.count ?? null;
});

function groupOf(priority: TaskPriority): GroupKey {
  if (priority === 'OVERDUE') {
    return 'overdue';
  }
  if (priority === 'TODAY') {
    return 'today';
  }
  if (priority === 'NEXT_7_DAYS') {
    return 'next7Days';
  }
  return 'unscheduled';
}

function groupTestId(key: GroupKey): string {
  if (key === 'next7Days') {
    return 'workbench-group-next7';
  }
  return `workbench-group-${key}`;
}

function priorityColor(priority: TaskPriority): string {
  if (priority === 'OVERDUE') {
    return 'red';
  }
  if (priority === 'TODAY') {
    return 'orange';
  }
  if (priority === 'NEXT_7_DAYS') {
    return 'blue';
  }
  return 'default';
}

async function loadWorkbench() {
  const now = Date.now();
  if (inFlight.value || now - lastStartedAt.value < REFRESH_COOLDOWN_MS) {
    return;
  }
  lastStartedAt.value = now;
  inFlight.value = true;
  loading.value = true;
  try {
    data.value = await getDashboardWorkbenchApi();
    loadError.value = false;
    selectedTaskIds.value = new Set();
  } catch {
    // 失败时清空旧值，避免展示上一用户/上一权限的数据
    data.value = null;
    loadError.value = true;
    selectedTaskIds.value = new Set();
  } finally {
    loading.value = false;
    inFlight.value = false;
  }
}

function isSelected(taskId: string): boolean {
  return selectedTaskIds.value.has(taskId);
}

function toggleSelect(taskId: string, checked: boolean) {
  const next = new Set(selectedTaskIds.value);
  if (checked) {
    next.add(taskId);
  } else {
    next.delete(taskId);
  }
  selectedTaskIds.value = next;
}

/** Non-goal：本页不办理任务，只跳转既有任务页 */
function openTask(task: WorkbenchTask) {
  void router.push({
    path: '/workflow/task/allTaskWaiting',
    query: { taskId: task.taskId },
  });
}

function openBatch() {
  void router.push({
    path: '/workflow/task/allTaskWaiting',
    query: {
      taskIds: [...selectedTaskIds.value].join(','),
    },
  });
}

function clearFilter() {
  filter.value = 'all';
}

onMounted(loadWorkbench);
</script>

<template>
  <div class="workbench-page">
    <div class="page-head">
      <div>
        <h1 data-testid="workbench-page-title" class="page-title">工作台</h1>
        <p class="page-sub">
          <span v-if="data">
            数据更新于 {{ data.serverTime }} · 今日剩余
            {{ metrics.todoTotal ?? 0 }} 项
          </span>
          <span v-else>按优先级处理流程任务</span>
        </p>
      </div>
      <div class="page-actions">
        <Button
          data-testid="workbench-batch-action"
          :disabled="selectedCount === 0"
          @click="openBatch"
        >
          批量办理
        </Button>
        <Button
          data-testid="workbench-refresh"
          :loading="loading"
          type="primary"
          @click="loadWorkbench"
        >
          刷新
        </Button>
      </div>
    </div>

    <div
      v-if="loading"
      data-testid="workbench-loading"
      class="loading-bar"
      role="status"
    >
      正在加载工作台…
    </div>

    <button
      v-if="loadError"
      data-testid="workbench-load-error"
      class="load-error"
      type="button"
      @click="loadWorkbench"
    >
      加载失败，点击重试
    </button>

    <Skeleton v-if="loading && !data" active :paragraph="{ rows: 6 }" />

    <template v-if="data">
      <div class="tab-bar">
        <button
          v-for="tab in tabItems"
          :key="tab.key"
          :data-testid="`workbench-tab-${tab.key}`"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          type="button"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="tab-count">{{ tab.count ?? '—' }}</span>
        </button>
      </div>

      <div v-if="activeTab !== 'todo'" class="other-tab">
        <Card :bordered="false">
          <div class="other-summary">
            <div class="other-title">
              {{ tabItems.find((tab) => tab.key === activeTab)?.label }}
            </div>
            <div class="other-count">
              共 {{ tabSummary ?? '—' }} 条记录
            </div>
            <p class="other-hint">请前往对应流程页面处理。</p>
          </div>
        </Card>
      </div>

      <div v-else class="workbench-grid">
        <main class="task-column">
          <Card :bordered="false">
            <template #title>
              <div class="list-title-row">
                <span>待办任务</span>
                <span class="list-hint">按截止时间从近到远排序</span>
              </div>
            </template>

            <div class="filter-bar">
              <button
                data-testid="filter-overdue"
                class="filter-button"
                :class="{ active: filter === 'overdue' }"
                type="button"
                @click="filter = 'overdue'"
              >
                已超时
              </button>
              <button
                data-testid="filter-today"
                class="filter-button"
                :class="{ active: filter === 'today' }"
                type="button"
                @click="filter = 'today'"
              >
                今天到期
              </button>
              <button
                data-testid="filter-next7"
                class="filter-button"
                :class="{ active: filter === 'next7Days' }"
                type="button"
                @click="filter = 'next7Days'"
              >
                未来 7 天
              </button>
              <button
                data-testid="filter-clear"
                class="filter-button clear"
                type="button"
                @click="clearFilter"
              >
                清除筛选
              </button>
            </div>

            <section
              v-for="group in groupSections"
              :key="group.key"
              class="task-group"
            >
              <h2
                :data-testid="group.testId"
                class="group-head"
              >
                {{ group.label }}
                <span class="group-count">{{ group.count }}</span>
              </h2>

              <div v-if="group.tasks.length > 0" class="task-list">
                <div
                  v-for="task in group.tasks"
                  :key="task.taskId"
                  data-testid="workbench-task-row"
                  class="task-row"
                  :data-task-id="task.taskId"
                >
                  <input
                    class="task-checkbox"
                    type="checkbox"
                    :aria-label="`选择任务 ${task.flowName}`"
                    :checked="isSelected(task.taskId)"
                    @change="
                      toggleSelect(
                        task.taskId,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  <div class="task-main">
                    <div class="task-title">
                      {{ task.flowName }}
                      <Tag :color="priorityColor(task.priority)">
                        {{ priorityLabel(task.priority) }}
                      </Tag>
                    </div>
                    <div class="task-meta">
                      {{ task.nodeName }} · 发起人 {{ task.initiatorName }} ·
                      截止 {{ formatDueTime(task.dueTime) }}
                    </div>
                  </div>
                  <div class="task-side">
                    <span
                      v-if="overdueText(task.overdueHours)"
                      class="overdue-text"
                    >
                      {{ overdueText(task.overdueHours) }}
                    </span>
                    <Button size="small" type="primary" @click="openTask(task)">
                      办理
                    </Button>
                  </div>
                </div>
              </div>
              <div v-else class="group-empty">暂无任务</div>
            </section>
          </Card>
        </main>

        <aside class="context-column">
          <Card data-testid="workbench-efficiency-card" :bordered="false">
            <template #title>近 7 天效率</template>
            <div
              data-testid="workbench-efficiency-text"
              class="efficiency-text"
            >
              {{ efficiencyText(efficiency.completedThisWeek, efficiency.weeklyTarget) }}
            </div>
            <div class="bar-track">
              <div
                data-testid="workbench-efficiency-bar"
                class="bar-fill"
                :style="{ width: efficiencyWidth }"
              ></div>
            </div>
            <div class="efficiency-metrics">
              <div class="metric-line">
                <span>平均处理时长</span>
                <span>{{ formatEfficiencyHours(efficiency.avgHandleHours) }}</span>
              </div>
              <div class="metric-line">
                <span>超时率</span>
                <span>
                  {{ efficiency.overdueRate === null ? '—' : `${efficiency.overdueRate}%` }}
                </span>
              </div>
              <div class="metric-line">
                <span>目标</span>
                <span>{{ efficiency.weeklyTarget }} 项</span>
              </div>
            </div>
          </Card>

          <Card v-if="flowProgress.length > 0" :bordered="false" title="流程进度">
            <div class="flow-list">
              <div
                v-for="item in flowProgress"
                :key="item.instanceId"
                data-testid="workbench-flow-row"
                class="flow-row"
              >
                <div class="flow-head">
                  <span class="flow-name">{{ item.flowName }}</span>
                  <span class="flow-node">{{ item.nodeName }}</span>
                </div>
                <div v-if="progressBarWidth(item.progressPercent)" class="bar-track">
                  <div
                    data-testid="workbench-flow-bar"
                    class="bar-fill"
                    :style="{ width: progressBarWidth(item.progressPercent)! }"
                  ></div>
                </div>
                <span v-else class="flow-nodata">进度未知</span>
              </div>
            </div>
          </Card>

          <Card v-if="commonFlows.length > 0" :bordered="false" title="常用流程">
            <div class="chip-list">
              <span
                v-for="flow in commonFlows"
                :key="flow.definitionId"
                class="flow-chip"
              >
                {{ flow.name }}
              </span>
            </div>
          </Card>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.workbench-page {
  padding: 20px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.page-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.page-actions {
  display: flex;
  gap: 8px;
}

.loading-bar {
  padding: 6px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 6px;
}

.load-error {
  display: block;
  width: 100%;
  padding: 10px;
  margin-bottom: 16px;
  font-size: 14px;
  color: hsl(var(--destructive));
  cursor: pointer;
  background: hsl(var(--destructive) / 8%);
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: 6px;
}

.tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  background: hsl(var(--card));
  border-radius: 8px;
}

.tab-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 16px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
}

.tab-item.active {
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--primary) / 10%);
}

.tab-count {
  min-width: 20px;
  padding: 0 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 10px;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
}

.task-column,
.context-column {
  min-width: 0;
}

.context-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-title-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.list-hint {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-button {
  padding: 5px 12px;
  font-size: 12px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 50%);
  border: 1px solid transparent;
  border-radius: 14px;
}

.filter-button.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 40%);
}

.filter-button.clear {
  color: hsl(var(--muted-foreground));
  background: transparent;
  border-color: hsl(var(--border));
}

.task-group {
  margin-top: 12px;
}

.group-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.group-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: hsl(var(--muted) / 30%);
  border-radius: 8px;
}

.task-checkbox {
  width: 16px;
  height: 16px;
}

.task-main {
  min-width: 0;
}

.task-title {
  display: flex;
  gap: 8px;
  align-items: center;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-side {
  display: flex;
  gap: 10px;
  align-items: center;
}

.overdue-text {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--destructive));
  white-space: nowrap;
}

.group-empty {
  padding: 16px 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.efficiency-text {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.bar-track {
  height: 8px;
  margin-top: 10px;
  overflow: hidden;
  background: hsl(var(--muted) / 60%);
  border-radius: 4px;
}

.bar-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 4px;
}

.efficiency-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.metric-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.metric-line span:last-child {
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.flow-name {
  overflow: hidden;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-node {
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.flow-nodata {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-chip {
  padding: 4px 10px;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 50%);
  border-radius: 12px;
}

.other-tab {
  max-width: 520px;
}

.other-summary {
  padding: 12px 0;
  text-align: center;
}

.other-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.other-count {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.other-hint {
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
