package com.aoyou.web.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLTimeoutException;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.sql.DataSource;

import org.apache.ibatis.exceptions.PersistenceException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import com.aoyou.common.core.service.DictService;
import com.aoyou.common.satoken.utils.LoginHelper;
import com.aoyou.system.service.ISysPermissionService;
import com.aoyou.web.config.DashboardProperties;
import com.aoyou.web.domain.vo.DashboardWarning;
import com.aoyou.web.domain.vo.HomeResponse;
import com.aoyou.web.domain.vo.WorkbenchResponse;
import com.aoyou.web.mapper.DashboardMapper;
import com.aoyou.web.service.dashboard.DashboardTime;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.redisson.api.RBucket;
import org.redisson.api.RKeys;
import org.redisson.api.RedissonClient;

/**
 * SPEC-005 v1.4 A-06 / A-07 / A-12 / §4.6：服务层权限降级、超时降级与分组行为。
 */
@Tag("dev")
class DashboardServiceImplTest {

    private static final long USER_ID = 42L;
    private static final String TENANT_ID = "000000";
    private static final ZonedDateTime FIXED_NOW =
        ZonedDateTime.of(2026, 11, 8, 10, 0, 0, 0, DashboardTime.ZONE);

    private DashboardMapper dashboardMapper;
    private DashboardProperties properties;
    private ISysPermissionService permissionService;
    private DynamicRoutingDataSource dataSource;
    private RedissonClient redissonClient;
    private DictService dictService;
    private SimpleMeterRegistry meterRegistry;
    private MockedStatic<LoginHelper> loginHelper;

    @BeforeEach
    void setUp() {
        dashboardMapper = mock(DashboardMapper.class);
        properties = new DashboardProperties();
        properties.setWeeklyTarget(20);
        properties.setDefaultSlaHours(72);
        permissionService = mock(ISysPermissionService.class);
        dataSource = mock(DynamicRoutingDataSource.class);
        redissonClient = mock(RedissonClient.class);
        dictService = mock(DictService.class);
        meterRegistry = new SimpleMeterRegistry();

        loginHelper = Mockito.mockStatic(LoginHelper.class);
        loginHelper.when(LoginHelper::getUserId).thenReturn(USER_ID);
        loginHelper.when(LoginHelper::getTenantId).thenReturn(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        loginHelper.close();
    }

    private DashboardServiceImpl service(boolean workflowEnabled) {
        return new DashboardServiceImpl(
            dashboardMapper, properties, permissionService, dataSource, redissonClient,
            dictService, meterRegistry, workflowEnabled);
    }

    @Test
    void limitedUserGetsNineNullFieldsAndPermissionDeniedWarnings() {
        when(permissionService.getMenuPermission(USER_ID)).thenReturn(Set.of("system:notice:list"));
        when(dashboardMapper.countTodos(String.valueOf(USER_ID))).thenReturn(7L);
        when(dashboardMapper.selectLatestNotices(TENANT_ID, 3)).thenReturn(noticeRows());
        when(dictService.getDictLabel("sys_notice_type", "1")).thenReturn("通知");

        HomeResponse response = service(true).home();

        assertThat(response.metrics().userTotal()).isNull();
        assertThat(response.metrics().onlineTotal()).isNull();
        assertThat(response.metrics().todayLoginTotal()).isNull();
        assertThat(response.metrics().todayErrorLogTotal()).isNull();
        assertThat(response.loginTrend()).isNull();
        assertThat(response.deptDistribution()).isNull();
        assertThat(response.health()).isNull();
        assertThat(response.recentLogins()).isNull();
        assertThat(response.recentOperations()).isNull();

        assertThat(response.notices()).hasSize(3);
        assertThat(response.metrics().todoTotal()).isEqualTo(7);

        assertThat(response.warnings())
            .extracting(DashboardWarning::field)
            .containsExactly(
                "metrics.userTotal",
                "deptDistribution",
                "metrics.onlineTotal",
                "metrics.todayLoginTotal",
                "loginTrend",
                "recentLogins",
                "metrics.todayErrorLogTotal",
                "recentOperations",
                "health");
        assertThat(response.warnings())
            .allMatch(warning -> DashboardWarning.PERMISSION_DENIED.equals(warning.code()));
    }

    @Test
    void loginTrendTimeoutOnlyDegradesLoginFields() {
        when(permissionService.getMenuPermission(USER_ID)).thenReturn(Set.of(
            "system:user:list", "system:dept:list", "monitor:online:list",
            "monitor:logininfor:list", "monitor:operlog:list", "monitor:admin:list",
            "system:notice:list"));
        when(dashboardMapper.countUsers(TENANT_ID)).thenReturn(1286L);
        when(dashboardMapper.selectDeptDistribution(TENANT_ID, 5)).thenReturn(deptRows());
        when(dashboardMapper.selectLoginTrend(anyString(), any(Date.class), any(Date.class)))
            .thenAnswer(invocation -> {
                throw new PersistenceException("query timed out",
                    new SQLTimeoutException("Statement cancelled due to timeout"));
            });
        when(dashboardMapper.selectRecentLogins(TENANT_ID, 5)).thenReturn(loginRows());
        when(dashboardMapper.countErrorOperations(anyString(), any(Date.class), any(Date.class)))
            .thenReturn(3L);
        when(dashboardMapper.selectRecentOperations(TENANT_ID, 5)).thenReturn(operationRows());
        when(dashboardMapper.selectLatestNotices(TENANT_ID, 3)).thenReturn(noticeRows());
        when(dictService.getDictLabel("sys_notice_type", "1")).thenReturn("通知");
        when(dashboardMapper.countTodos(String.valueOf(USER_ID))).thenReturn(7L);
        stubOnlineEmpty();
        stubHealthUp();

        HomeResponse response = service(true).home();

        assertThat(response.metrics().userTotal()).isEqualTo(1286);
        assertThat(response.metrics().todayLoginTotal()).isNull();
        assertThat(response.loginTrend()).isNull();
        assertThat(response.notices()).hasSize(3);
        assertThat(response.warnings()).containsExactly(
            new DashboardWarning("metrics.todayLoginTotal", DashboardWarning.TIMEOUT),
            new DashboardWarning("loginTrend", DashboardWarning.TIMEOUT));
        assertThat(response.health().status()).isEqualTo("DEGRADED");
        assertThat(response.health().services()).hasSize(4);
        assertThat(response.health().services().get(3).name()).isEqualTo("任务调度");
        assertThat(response.health().services().get(3).status()).isEqualTo("UNKNOWN");
        assertThat(response.health().services().get(3).latencyMs()).isNull();
    }

    @Test
    void workflowDisabledLeavesWorkbenchMetricsNullAndCountsZero() {
        WorkbenchResponse response = service(false).workbench();

        assertThat(response.metrics().todoTotal()).isNull();
        assertThat(response.metrics().doneTotal()).isNull();
        assertThat(response.metrics().initiatedTotal()).isNull();
        assertThat(response.metrics().copyTotal()).isNull();
        assertThat(response.groupCounts()).isEqualTo(new WorkbenchResponse.GroupCounts(0, 0, 0, 0));
        assertThat(response.groups().overdue()).isEmpty();
        assertThat(response.groups().today()).isEmpty();
        assertThat(response.groups().next7Days()).isEmpty();
        assertThat(response.groups().unscheduled()).isEmpty();
        assertThat(response.efficiency().completedThisWeek()).isZero();
        assertThat(response.efficiency().weeklyTarget()).isEqualTo(20);
        assertThat(response.efficiency().avgHandleHours()).isNull();
        assertThat(response.efficiency().overdueRate()).isNull();
        assertThat(response.flowProgress()).isEmpty();
        assertThat(response.commonFlows()).isEmpty();
        assertThat(response.warnings()).containsExactly(
            new DashboardWarning("metrics.todoTotal", DashboardWarning.UNAVAILABLE));
    }

    @Test
    void todoGroupsClassifyDedupeAndCountConsistently() {
        when(dashboardMapper.selectTodos(String.valueOf(USER_ID))).thenReturn(todoRows());
        when(dashboardMapper.countDoneTasks(String.valueOf(USER_ID))).thenReturn(32L);
        when(dashboardMapper.countInitiatedInstances(String.valueOf(USER_ID))).thenReturn(12L);
        when(dashboardMapper.countCopyTasks(String.valueOf(USER_ID))).thenReturn(5L);
        when(dashboardMapper.selectEfficiencyRecords(
            anyString(), any(Date.class), any(Date.class))).thenReturn(List.of());
        when(dashboardMapper.selectFlowProgress(String.valueOf(USER_ID))).thenReturn(List.of());
        when(dashboardMapper.selectCommonFlows(8)).thenReturn(List.of());

        WorkbenchResponse response;
        try (MockedStatic<DashboardTime> clock =
                 Mockito.mockStatic(DashboardTime.class, Mockito.CALLS_REAL_METHODS)) {
            clock.when(DashboardTime::now).thenReturn(FIXED_NOW);
            response = service(true).workbench();
        }

        assertThat(response.metrics().todoTotal()).isEqualTo(7);
        assertThat(response.metrics().doneTotal()).isEqualTo(32);
        assertThat(response.metrics().initiatedTotal()).isEqualTo(12);
        assertThat(response.metrics().copyTotal()).isEqualTo(5);
        assertThat(response.groupCounts())
            .isEqualTo(new WorkbenchResponse.GroupCounts(2, 3, 2, 0));

        assertThat(response.groups().overdue())
            .extracting(WorkbenchResponse.TaskItem::taskId)
            .containsExactly("t2", "t1");
        assertThat(response.groups().overdue().get(0).overdueHours()).isEqualTo(28);
        assertThat(response.groups().overdue().get(0).dueTime()).isEqualTo("2026-11-07T06:00:00+08:00");
        assertThat(response.groups().overdue().get(1).overdueHours()).isEqualTo(4);
        assertThat(response.groups().today())
            .extracting(WorkbenchResponse.TaskItem::taskId)
            .containsExactly("t3", "t4", "t5");
        assertThat(response.groups().next7Days())
            .extracting(WorkbenchResponse.TaskItem::taskId)
            .containsExactly("t6", "t7");
        assertThat(response.groups().unscheduled()).isEmpty();
        assertThat(response.groupCounts().overdue()
            + response.groupCounts().today()
            + response.groupCounts().next7Days()
            + response.groupCounts().unscheduled())
            .isEqualTo(response.metrics().todoTotal());
        assertThat(response.warnings()).isEmpty();
    }

    private void stubOnlineEmpty() {
        RKeys keys = mock(RKeys.class);
        when(redissonClient.getKeys()).thenReturn(keys);
        when(keys.getKeysByPattern(anyString())).thenReturn(Set.of());
    }

    @SuppressWarnings("unchecked")
    private void stubHealthUp() {
        try {
            Connection connection = mock(Connection.class);
            when(connection.isValid(anyInt())).thenReturn(true);
            DataSource routed = mock(DataSource.class);
            when(dataSource.determineDataSource()).thenReturn(routed);
            when(routed.getConnection()).thenReturn(connection);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        RBucket<Object> bucket = mock(RBucket.class);
        when(bucket.isExists()).thenReturn(true);
        when(redissonClient.getBucket(anyString())).thenReturn((RBucket) bucket);
    }

    private List<Map<String, Object>> noticeRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("noticeId", String.valueOf(i));
            row.put("title", "公告 " + i);
            row.put("noticeType", "1");
            row.put("createTime", Date.from(FIXED_NOW.minusHours(i).toInstant()));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> deptRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        String[] names = {"运营中心", "技术中心", "客户成功部", "财务部", "人力资源部"};
        int[] counts = {286, 248, 193, 126, 98};
        for (int i = 0; i < names.length; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("deptId", String.valueOf(100 + i));
            row.put("deptName", names[i]);
            row.put("userCount", counts[i]);
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> loginRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userName", "user" + i);
            row.put("ipaddr", "10.0.0." + (i + 1));
            row.put("loginTime", Date.from(FIXED_NOW.minusMinutes(i).toInstant()));
            row.put("status", i == 4 ? "1" : "0");
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> operationRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("operName", "operator" + i);
            row.put("title", "操作 " + i);
            row.put("operTime", Date.from(FIXED_NOW.minusMinutes(i).toInstant()));
            row.put("status", i == 0 ? 0 : 1);
            rows.add(row);
        }
        return rows;
    }

    /**
     * 固定 now=2026-11-08T10:00+08:00、默认 SLA=72h 的分组夹具：
     * 2 超时 / 3 今日到期 / 2 未来 7 天 / 0 未设截止，外加一条重复 taskId。
     */
    private List<Map<String, Object>> todoRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(todoRow("t1", "", FIXED_NOW.withDayOfMonth(5).withHour(6).withMinute(0)));
        rows.add(todoRow("t2", "", FIXED_NOW.withDayOfMonth(4).withHour(6).withMinute(0)));
        rows.add(todoRow("t3", "", FIXED_NOW.withDayOfMonth(5).withHour(12).withMinute(0)));
        rows.add(todoRow("t4", "", FIXED_NOW.withDayOfMonth(5).withHour(20).withMinute(0)));
        rows.add(todoRow("t5", "", FIXED_NOW.withDayOfMonth(5).withHour(23).withMinute(0)));
        rows.add(todoRow("t6", "", FIXED_NOW.withDayOfMonth(6).withHour(12).withMinute(0)));
        rows.add(todoRow("t7", "", FIXED_NOW.withDayOfMonth(7).withHour(9).withMinute(0)));
        rows.add(todoRow("t1", "", FIXED_NOW.withDayOfMonth(5).withHour(6).withMinute(0)));
        return rows;
    }

    private Map<String, Object> todoRow(String taskId, String flowCode, ZonedDateTime createTime) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("taskId", taskId);
        row.put("flowCode", flowCode);
        row.put("flowName", "流程 " + taskId);
        row.put("initiatorName", "张三");
        row.put("nodeName", "部门负责人审批");
        row.put("createTime", Date.from(createTime.toInstant()));
        return row;
    }
}
