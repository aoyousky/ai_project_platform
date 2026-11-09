<script lang="ts" setup>
import type { DashboardWarning, HomeResponse } from '#/api/dashboard/types';

import { computed, onMounted, ref } from 'vue';

import { Button, Card, Skeleton, Tag } from 'antdv-next';

import { getDashboardHomeApi } from '#/api/dashboard/home';

import {
  deptBarPercent,
  formatCount,
  formatLatency,
  formatShortDateTime,
  hasUsableTrend,
  healthServiceLabel,
  healthStatusColor,
  healthStatusLabel,
  isMetricVisible,
  loginStatusLabel,
  trendLastValue,
  warningCodeFor,
} from './home-page-logic';
import HomeTrendChart from './home-trend-chart.vue';

defineOptions({ name: 'DashboardHome' });

const data = ref<HomeResponse | null>(null);
const loading = ref(true);
const loadError = ref(false);
const inFlight = ref(false);

const metrics = computed(() => data.value?.metrics ?? null);
const warnings = computed<DashboardWarning[]>(() => data.value?.warnings ?? []);

const showSystemCard = computed(
  () =>
    isMetricVisible(metrics.value?.userTotal) ||
    isMetricVisible(metrics.value?.onlineTotal) ||
    isMetricVisible(metrics.value?.todayErrorLogTotal),
);
const showTodoKpi = computed(() => isMetricVisible(metrics.value?.todoTotal));
const showTodayLoginKpi = computed(() =>
  isMetricVisible(metrics.value?.todayLoginTotal),
);

const trend = computed(() => data.value?.loginTrend ?? null);
const lastTrendValue = computed(() => trendLastValue(trend.value));
const trendWarning = computed(() => warningCodeFor(warnings.value, 'loginTrend'));

/** ok / error / hidden；6 项也按 E-17 进入错误态 */
const trendState = computed<'error' | 'hidden' | 'ok'>(() => {
  if (loadError.value) {
    return 'error';
  }
  if (hasUsableTrend(trend.value)) {
    return 'ok';
  }
  if (trend.value === null && trendWarning.value === 'PERMISSION_DENIED') {
    return 'hidden';
  }
  return 'error';
});

const notices = computed(() => data.value?.notices ?? null);
const deptDistribution = computed(() => data.value?.deptDistribution ?? null);
const health = computed(() => data.value?.health ?? null);
const recentLogins = computed(() => data.value?.recentLogins ?? null);
const recentOperations = computed(() => data.value?.recentOperations ?? null);

const maxDeptUsers = computed(() =>
  Math.max(0, ...(deptDistribution.value ?? []).map((item) => item.userCount)),
);

const healthMeters = computed(() => {
  const source = health.value;
  if (!source) {
    return [];
  }
  return [
    { label: 'CPU 使用率', value: source.cpuUsage },
    { label: '内存使用率', value: source.memoryUsage },
    { label: '磁盘使用率', value: source.diskUsage },
  ];
});

const hasWarnings = computed(() => warnings.value.length > 0);

async function loadHome() {
  if (inFlight.value) {
    return;
  }
  inFlight.value = true;
  loading.value = true;
  try {
    data.value = await getDashboardHomeApi();
    loadError.value = false;
  } catch {
    // E-11 / E-13：失败时清空旧值，避免残留上一租户或上一权限的数据
    data.value = null;
    loadError.value = true;
  } finally {
    loading.value = false;
    inFlight.value = false;
  }
}

onMounted(loadHome);
</script>

<template>
  <div class="home-page">
    <div class="page-head">
      <div>
        <h1 data-testid="home-page-title" class="page-title">运营驾驶舱</h1>
        <p class="page-sub">
          <span v-if="data">数据更新于 {{ formatShortDateTime(data.serverTime) }}</span>
          <span v-else>平台运行态势概览</span>
          <Tag v-if="hasWarnings" class="ml-2" color="orange">部分数据不可用</Tag>
        </p>
      </div>
      <Button :loading="loading" data-testid="home-refresh" @click="loadHome">
        刷新
      </Button>
    </div>

    <button
      v-if="loadError"
      class="load-error"
      data-testid="home-load-error"
      type="button"
      @click="loadHome"
    >
      加载失败，点击重试
    </button>

    <Card v-if="loading && !data" class="mb-4" :bordered="false">
      <Skeleton active :paragraph="{ rows: 8 }" />
    </Card>

    <template v-if="data">
      <div class="kpi-grid">
        <div
          v-if="showSystemCard"
          class="contents"
          data-testid="home-system-card"
        >
          <Card
            v-if="isMetricVisible(metrics?.userTotal)"
            class="kpi-card"
            :bordered="false"
          >
            <div class="kpi-label">用户总数</div>
            <div data-testid="home-kpi-user-total" class="kpi-value">
              {{ formatCount(metrics?.userTotal) }}
            </div>
            <div class="kpi-foot">当前租户</div>
          </Card>
          <Card
            v-if="isMetricVisible(metrics?.onlineTotal)"
            class="kpi-card"
            :bordered="false"
          >
            <div class="kpi-label">在线用户</div>
            <div data-testid="home-kpi-online" class="kpi-value">
              {{ formatCount(metrics?.onlineTotal) }}
            </div>
            <div class="kpi-foot">实时会话</div>
          </Card>
          <Card
            v-if="isMetricVisible(metrics?.todayErrorLogTotal)"
            class="kpi-card"
            :bordered="false"
          >
            <div class="kpi-label">今日异常日志</div>
            <div data-testid="home-kpi-today-error" class="kpi-value">
              {{ formatCount(metrics?.todayErrorLogTotal) }}
            </div>
            <div class="kpi-foot">操作失败</div>
          </Card>
        </div>

        <Card
          v-if="showTodoKpi"
          class="kpi-card"
          :bordered="false"
        >
          <div class="kpi-label">待办任务</div>
          <div data-testid="home-kpi-todo" class="kpi-value">
            {{ formatCount(metrics?.todoTotal) }}
          </div>
          <div class="kpi-foot">当前用户</div>
        </Card>

        <Card
          v-if="showTodayLoginKpi"
          class="kpi-card"
          :bordered="false"
        >
          <div class="kpi-label">今日登录</div>
          <div data-testid="home-kpi-today-login" class="kpi-value">
            {{ formatCount(metrics?.todayLoginTotal) }}
          </div>
          <div class="kpi-foot">成功登录</div>
        </Card>
      </div>

      <div class="dashboard-grid">
        <Card
          v-if="trendState !== 'hidden'"
          class="card-span-8"
          :bordered="false"
        >
          <template #title>
            <div class="card-title-row">
              <span>近 7 日登录趋势</span>
              <span
                v-if="trendState === 'ok'"
                data-testid="home-trend-last-value"
                class="trend-last"
              >
                {{ lastTrendValue }}
              </span>
            </div>
          </template>

          <template v-if="trendState === 'ok' && trend">
            <div data-testid="home-login-trend">
              <div data-testid="home-trend-chart">
                <HomeTrendChart :items="trend" />
              </div>
              <table data-testid="home-trend-table" class="trend-table">
                <thead>
                  <tr>
                    <th scope="col">日期</th>
                    <th scope="col">登录次数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in trend" :key="item.date">
                    <td>{{ item.date }}</td>
                    <td>{{ item.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <button
            v-else
            data-testid="home-trend-error"
            class="inline-error"
            type="button"
            @click="loadHome"
          >
            加载失败，点击重试
          </button>
        </Card>

        <Card
          v-if="notices !== null"
          class="card-span-4"
          data-testid="home-notice-card"
          :bordered="false"
          title="通知公告"
        >
          <div v-if="notices && notices.length > 0" class="notice-list">
            <div
              v-for="notice in notices"
              :key="notice.noticeId"
              data-testid="home-notice-row"
              class="notice-row"
            >
              <span class="status-dot success" aria-hidden="true"></span>
              <div class="notice-main">
                <div class="notice-title" :title="notice.title">
                  {{ notice.title }}
                </div>
                <div class="notice-meta">
                  <Tag color="blue">{{ notice.noticeTypeLabel }}</Tag>
                  <span>{{ formatShortDateTime(notice.publishTime) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            data-testid="home-notice-empty"
            class="empty-text"
          >
            暂无公告
          </div>
        </Card>

        <Card
          v-if="deptDistribution !== null"
          class="card-span-4"
          data-testid="home-dept-card"
          :bordered="false"
          title="部门人员分布（Top 5）"
        >
          <div v-if="deptDistribution.length > 0" class="dept-list">
            <div
              v-for="dept in deptDistribution"
              :key="dept.deptId"
              data-testid="home-dept-row"
              class="dept-row"
            >
              <span class="dept-name" :title="dept.deptName">
                {{ dept.deptName }}
              </span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{
                    width: `${deptBarPercent(dept.userCount, maxDeptUsers)}%`,
                  }"
                ></div>
              </div>
              <span class="dept-value" data-testid="home-dept-value">
                {{ dept.userCount }}
              </span>
            </div>
          </div>
          <div
            v-else
            data-testid="home-dept-empty"
            class="empty-text"
          >
            暂无部门数据
          </div>
        </Card>

        <Card
          v-if="health !== null"
          class="card-span-4"
          data-testid="home-health-card"
          :bordered="false"
          title="系统健康"
        >
          <div
            data-testid="home-health-status"
            class="health-status"
          >
            <span
              class="status-dot"
              :class="healthStatusColor(health.status)"
              aria-hidden="true"
            ></span>
            {{ healthStatusLabel(health.status) }}
          </div>

          <div class="health-services">
            <div
              v-for="service in health.services"
              :key="service.name"
              class="health-service"
            >
              <span class="service-name">
                <span
                  class="status-dot"
                  :class="healthStatusColor(service.status)"
                  aria-hidden="true"
                ></span>
                {{ service.name }}
              </span>
              <span class="service-state">
                {{ healthServiceLabel(service.status) }}
                <span v-if="service.latencyMs !== null" class="service-latency">
                  {{ formatLatency(service.latencyMs) }}
                </span>
              </span>
            </div>
          </div>

          <div class="meters">
            <div
              v-for="meter in healthMeters"
              :key="meter.label"
              data-testid="home-meter"
              class="meter"
            >
              <div class="meter-head">
                <span>{{ meter.label }}</span>
                <span>{{ meter.value === null ? '未采集' : `${meter.value}%` }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{ width: `${meter.value ?? 0}%` }"
                ></div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          v-if="recentLogins !== null"
          class="card-span-4"
          data-testid="home-recent-login-card"
          :bordered="false"
          title="最近登录"
        >
          <div v-if="recentLogins.length > 0" class="record-list">
            <div
              v-for="(item, index) in recentLogins"
              :key="`${item.userName}-${item.loginTime}-${index}`"
              data-testid="home-recent-login-row"
              class="record-row"
            >
              <span class="record-name">{{ item.userName }}</span>
              <span class="record-muted">{{ item.ipaddr }}</span>
              <span
                class="status-text"
                :class="item.status === 'SUCCESS' ? 'success' : 'error'"
              >
                <span
                  class="status-dot"
                  :class="item.status === 'SUCCESS' ? 'success' : 'error'"
                  aria-hidden="true"
                ></span>
                {{ loginStatusLabel(item.status) }}
              </span>
              <span class="record-time">
                {{ formatShortDateTime(item.loginTime) }}
              </span>
            </div>
          </div>
          <div v-else class="empty-text">暂无登录记录</div>
        </Card>

        <Card
          v-if="recentOperations !== null"
          class="card-span-12"
          data-testid="home-recent-oper-card"
          :bordered="false"
          title="最近操作"
        >
          <div v-if="recentOperations.length > 0" class="record-list">
            <div
              v-for="(item, index) in recentOperations"
              :key="`${item.operName}-${item.operTime}-${index}`"
              data-testid="home-recent-oper-row"
              class="record-row oper-row"
            >
              <span class="record-name">{{ item.operName }}</span>
              <span class="record-title">{{ item.title }}</span>
              <span
                class="status-text"
                :class="item.status === 'SUCCESS' ? 'success' : 'error'"
              >
                <span
                  class="status-dot"
                  :class="item.status === 'SUCCESS' ? 'success' : 'error'"
                  aria-hidden="true"
                ></span>
                {{ loginStatusLabel(item.status) }}
              </span>
              <span class="record-time">
                {{ formatShortDateTime(item.operTime) }}
              </span>
            </div>
          </div>
          <div v-else class="empty-text">暂无操作记录</div>
        </Card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-page {
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

.load-error,
.inline-error {
  display: block;
  width: 100%;
  padding: 10px;
  color: hsl(var(--destructive));
  cursor: pointer;
  background: hsl(var(--destructive) / 8%);
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: 6px;
}

.load-error {
  margin-bottom: 16px;
  font-size: 14px;
}

.inline-error {
  margin-top: 12px;
  font-size: 13px;
}

.mb-4 {
  margin-bottom: 16px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.contents {
  display: contents;
}

.kpi-card {
  border-radius: 10px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

.kpi-label {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.kpi-value {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.kpi-foot {
  margin-top: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

.card-span-4 {
  grid-column: span 4;
}

.card-span-8 {
  grid-column: span 8;
}

.card-span-12 {
  grid-column: span 12;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trend-last {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.trend-table {
  width: 100%;
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-collapse: collapse;
}

.trend-table th,
.trend-table td {
  padding: 3px 8px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border) / 50%);
}

.notice-list,
.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notice-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.notice-main {
  min-width: 0;
}

.notice-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.notice-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.dept-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dept-row {
  display: grid;
  grid-template-columns: minmax(0, 80px) 1fr 44px;
  gap: 8px;
  align-items: center;
}

.dept-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.dept-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
  text-align: right;
}

.bar-track {
  height: 6px;
  overflow: hidden;
  background: hsl(var(--muted) / 60%);
  border-radius: 3px;
}

.bar-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 3px;
}

.health-status {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.health-services {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.health-service {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--foreground));
}

.service-name {
  display: flex;
  gap: 6px;
  align-items: center;
}

.service-state {
  color: hsl(var(--muted-foreground));
}

.service-latency {
  margin-left: 6px;
}

.meters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.meter-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.record-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 56px 86px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.oper-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) 56px 86px;
}

.record-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.record-title {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.record-muted,
.record-time {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-time {
  text-align: right;
}

.status-text {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}

.status-text.success {
  color: hsl(var(--success, 145 80% 35%));
}

.status-text.error {
  color: hsl(var(--destructive));
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
}

.status-dot.success {
  background: hsl(var(--success, 145 80% 35%));
}

.status-dot.error {
  background: hsl(var(--destructive));
}

.status-dot.warning {
  background: hsl(var(--warning, 35 95% 50%));
}

.empty-text {
  padding: 24px 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

@media (max-width: 1100px) {
  .card-span-4,
  .card-span-8 {
    grid-column: span 12;
  }
}
</style>
