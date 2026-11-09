package com.aoyou.web.service.impl;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.aoyou.common.core.constant.CacheConstants;
import com.aoyou.common.core.constant.TenantConstants;
import com.aoyou.common.core.domain.dto.UserOnlineDTO;
import com.aoyou.common.core.service.DictService;
import com.aoyou.common.satoken.utils.LoginHelper;
import com.aoyou.system.service.ISysPermissionService;
import com.aoyou.web.config.DashboardProperties;
import com.aoyou.web.domain.vo.DashboardWarning;
import com.aoyou.web.domain.vo.HomeResponse;
import com.aoyou.web.domain.vo.WorkbenchResponse;
import com.aoyou.web.mapper.DashboardMapper;
import com.aoyou.web.service.IDashboardService;
import com.aoyou.web.service.dashboard.DashboardEfficiencyCalculator;
import com.aoyou.web.service.dashboard.DashboardSlaCalculator;
import com.aoyou.web.service.dashboard.DashboardTime;
import com.baomidou.dynamic.datasource.DynamicRoutingDataSource;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RedissonClient;

/**
 * SPEC-005 v1.4 首页/工作台聚合实现。
 *
 * <p>所有下游查询失败都降级为字段 {@code null} + warning，接口本身保持 HTTP 200；
 * 单例只读，不写业务数据。</p>
 */
@Slf4j
@Service
public class DashboardServiceImpl implements IDashboardService {

    private static final String PERM_USER = "system:user:list";
    private static final String PERM_DEPT = "system:dept:list";
    private static final String PERM_ONLINE = "monitor:online:list";
    private static final String PERM_LOGIN = "monitor:logininfor:list";
    private static final String PERM_OPER = "monitor:operlog:list";
    private static final String PERM_HEALTH = "monitor:admin:list";
    private static final String PERM_NOTICE = "system:notice:list";
    private static final String ONLINE_PREFIX = CacheConstants.ONLINE_TOKEN_KEY;
    private static final String HEALTH_REDIS_KEY = "dashboard:health:probe";

    private final DashboardMapper dashboardMapper;
    private final DashboardProperties properties;
    private final ISysPermissionService permissionService;
    private final DynamicRoutingDataSource dataSource;
    private final RedissonClient redissonClient;
    private final DictService dictService;
    private final MeterRegistry meterRegistry;
    private final boolean workflowEnabled;

    public DashboardServiceImpl(
        DashboardMapper dashboardMapper,
        DashboardProperties properties,
        ISysPermissionService permissionService,
        DynamicRoutingDataSource dataSource,
        RedissonClient redissonClient,
        DictService dictService,
        MeterRegistry meterRegistry,
        @Value("${warm-flow.enabled:false}") boolean workflowEnabled
    ) {
        this.dashboardMapper = dashboardMapper;
        this.properties = properties;
        this.permissionService = permissionService;
        this.dataSource = dataSource;
        this.redissonClient = redissonClient;
        this.dictService = dictService;
        this.meterRegistry = meterRegistry;
        this.workflowEnabled = workflowEnabled;
    }

    @Override
    public HomeResponse home() {
        Timer.Sample sample = Timer.start(meterRegistry);
        ZonedDateTime now = DashboardTime.now();
        String tenantId = currentTenantId();
        Set<String> permissions = currentPermissions();
        List<DashboardWarning> warnings = new ArrayList<>();

        // 逐字段加载拆成独立方法：权限判定与降级分支各自成块，
        // 主流程保持线性，避免单方法圈复杂度超过 constitution VIII 的 15。
        UserData users = loadUserData(permissions, tenantId, warnings);
        Integer onlineTotal = loadOnlineTotal(permissions, tenantId, warnings);
        LoginData logins = loadLoginData(permissions, tenantId, now, warnings);
        List<HomeResponse.RecentLogin> recentLogins = loadRecentLogins(permissions, tenantId, warnings);
        Integer todayErrorLogTotal = loadErrorLogTotal(permissions, tenantId, now, warnings);
        List<HomeResponse.RecentOperation> recentOperations =
            loadRecentOperations(permissions, tenantId, warnings);
        HomeResponse.Health health = loadHealth(permissions, warnings);
        List<HomeResponse.NoticeItem> notices = loadNotices(permissions, tenantId, warnings);
        Integer todoTotal = loadTodoTotal(warnings);

        HomeResponse response = new HomeResponse(
            DashboardTime.iso(now),
            new HomeResponse.Metrics(users.userTotal(), onlineTotal, todoTotal,
                logins.todayLoginTotal(), todayErrorLogTotal),
            logins.loginTrend(),
            users.deptDistribution(),
            health,
            notices,
            recentLogins,
            recentOperations,
            List.copyOf(warnings)
        );

        meterRegistry.counter("dashboard.home.requests").increment();
        if (!warnings.isEmpty()) {
            meterRegistry.counter("dashboard.home.partial").increment();
        }
        sample.stop(meterRegistry.timer("dashboard.home.duration"));
        log.info("dashboard.home traceId={} tenantId={} userId={} durationMs={} warnings={}",
            traceId(), tenantId, LoginHelper.getUserId(), meterRegistry.timer("dashboard.home.duration").mean(
                java.util.concurrent.TimeUnit.MILLISECONDS), warningCodes(warnings));
        return response;
    }

    private UserData loadUserData(Set<String> permissions, String tenantId, List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_USER) || !has(permissions, PERM_DEPT)) {
            warnings.add(DashboardWarning.permissionDenied("metrics.userTotal"));
            warnings.add(DashboardWarning.permissionDenied("deptDistribution"));
            return new UserData(null, null);
        }
        Integer userTotal = null;
        try {
            userTotal = number(dashboardMapper.countUsers(tenantId));
        } catch (Exception e) {
            log.warn("dashboard.home userTotal unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("metrics.userTotal"));
        }
        List<HomeResponse.DeptDistributionItem> deptDistribution = null;
        try {
            deptDistribution = deptDistribution(tenantId);
        } catch (Exception e) {
            log.warn("dashboard.home deptDistribution unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("deptDistribution"));
        }
        return new UserData(userTotal, deptDistribution);
    }

    private Integer loadOnlineTotal(Set<String> permissions, String tenantId, List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_ONLINE)) {
            warnings.add(DashboardWarning.permissionDenied("metrics.onlineTotal"));
            return null;
        }
        try {
            return countOnline(tenantId);
        } catch (Exception e) {
            log.warn("dashboard.home onlineTotal unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("metrics.onlineTotal"));
            return null;
        }
    }

    private LoginData loadLoginData(Set<String> permissions, String tenantId, ZonedDateTime now,
        List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_LOGIN)) {
            warnings.add(DashboardWarning.permissionDenied("metrics.todayLoginTotal"));
            warnings.add(DashboardWarning.permissionDenied("loginTrend"));
            return new LoginData(null, null);
        }
        try {
            List<HomeResponse.LoginTrendItem> loginTrend = loginTrend(tenantId, now);
            Integer todayLoginTotal = loginTrend.isEmpty() ? 0 : loginTrend.get(loginTrend.size() - 1).count();
            return new LoginData(todayLoginTotal, loginTrend);
        } catch (Exception e) {
            String code = timeoutCode(e);
            log.warn("dashboard.home loginTrend unavailable code={}: {}", code, e.getMessage());
            warnings.add(new DashboardWarning("metrics.todayLoginTotal", code));
            warnings.add(new DashboardWarning("loginTrend", code));
            return new LoginData(null, null);
        }
    }

    private List<HomeResponse.RecentLogin> loadRecentLogins(Set<String> permissions, String tenantId,
        List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_LOGIN)) {
            warnings.add(DashboardWarning.permissionDenied("recentLogins"));
            return null;
        }
        try {
            return recentLogins(tenantId);
        } catch (Exception e) {
            log.warn("dashboard.home recentLogins unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("recentLogins"));
            return null;
        }
    }

    private Integer loadErrorLogTotal(Set<String> permissions, String tenantId, ZonedDateTime now,
        List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_OPER)) {
            warnings.add(DashboardWarning.permissionDenied("metrics.todayErrorLogTotal"));
            return null;
        }
        try {
            return number(dashboardMapper.countErrorOperations(
                tenantId, startOfDay(now.toLocalDate()), startOfDay(now.toLocalDate().plusDays(1))));
        } catch (Exception e) {
            log.warn("dashboard.home todayErrorLogTotal unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("metrics.todayErrorLogTotal"));
            return null;
        }
    }

    private List<HomeResponse.RecentOperation> loadRecentOperations(Set<String> permissions, String tenantId,
        List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_OPER)) {
            warnings.add(DashboardWarning.permissionDenied("recentOperations"));
            return null;
        }
        try {
            return recentOperations(tenantId);
        } catch (Exception e) {
            log.warn("dashboard.home recentOperations unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("recentOperations"));
            return null;
        }
    }

    private HomeResponse.Health loadHealth(Set<String> permissions, List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_HEALTH)) {
            warnings.add(DashboardWarning.permissionDenied("health"));
            return null;
        }
        try {
            return health();
        } catch (Exception e) {
            log.warn("dashboard.home health unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("health"));
            return null;
        }
    }

    private List<HomeResponse.NoticeItem> loadNotices(Set<String> permissions, String tenantId,
        List<DashboardWarning> warnings) {
        if (!has(permissions, PERM_NOTICE)) {
            warnings.add(DashboardWarning.permissionDenied("notices"));
            return null;
        }
        try {
            return notices(tenantId);
        } catch (Exception e) {
            log.warn("dashboard.home notices unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("notices"));
            return null;
        }
    }

    private Integer loadTodoTotal(List<DashboardWarning> warnings) {
        if (!workflowEnabled) {
            warnings.add(DashboardWarning.unavailable("metrics.todoTotal"));
            return null;
        }
        try {
            return number(dashboardMapper.countTodos(String.valueOf(LoginHelper.getUserId())));
        } catch (Exception e) {
            log.warn("dashboard.home todoTotal unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("metrics.todoTotal"));
            return null;
        }
    }

    @Override
    public WorkbenchResponse workbench() {
        Timer.Sample sample = Timer.start(meterRegistry);
        ZonedDateTime now = DashboardTime.now();
        String userId = String.valueOf(LoginHelper.getUserId());
        List<DashboardWarning> warnings = new ArrayList<>();

        Integer todoTotal = null;
        Integer doneTotal = null;
        Integer initiatedTotal = null;
        Integer copyTotal = null;
        WorkbenchResponse.GroupCounts counts = new WorkbenchResponse.GroupCounts(0, 0, 0, 0);
        WorkbenchResponse.Groups groups = emptyGroups();
        WorkbenchResponse.Efficiency efficiency = new WorkbenchResponse.Efficiency(
            0, properties.getWeeklyTarget(), null, null);
        List<WorkbenchResponse.FlowProgressItem> flowProgress = List.of();
        List<WorkbenchResponse.CommonFlowItem> commonFlows = List.of();

        if (!workflowEnabled) {
            warnings.add(DashboardWarning.unavailable("metrics.todoTotal"));
        } else {
            TodoResult todoResult = todoResult(userId, now, warnings);
            todoTotal = todoResult.total();
            counts = todoResult.counts();
            groups = todoResult.groups();

            try {
                doneTotal = number(dashboardMapper.countDoneTasks(userId));
            } catch (Exception e) {
                log.warn("dashboard.workbench doneTotal unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("metrics.doneTotal"));
            }
            try {
                initiatedTotal = number(dashboardMapper.countInitiatedInstances(userId));
            } catch (Exception e) {
                log.warn("dashboard.workbench initiatedTotal unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("metrics.initiatedTotal"));
            }
            try {
                copyTotal = number(dashboardMapper.countCopyTasks(userId));
            } catch (Exception e) {
                log.warn("dashboard.workbench copyTotal unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("metrics.copyTotal"));
            }

            try {
                List<DashboardEfficiencyCalculator.HisRecord> records = new ArrayList<>();
                for (Map<String, Object> row : safeList(dashboardMapper.selectEfficiencyRecords(
                    userId, date(now.minusDays(7)), date(now)))) {
                    records.add(new DashboardEfficiencyCalculator.HisRecord(
                        dateValue(row.get("createTime")),
                        dateValue(row.get("updateTime")),
                        stringValue(row.get("flowCode"))
                    ));
                }
                DashboardEfficiencyCalculator.Result result =
                    DashboardEfficiencyCalculator.calculate(records, properties, now);
                efficiency = new WorkbenchResponse.Efficiency(
                    result.completedThisWeek(), properties.getWeeklyTarget(),
                    result.avgHandleHours(), result.overdueRate());
            } catch (Exception e) {
                log.warn("dashboard.workbench efficiency unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("efficiency"));
            }

            try {
                flowProgress = flowProgress(userId);
            } catch (Exception e) {
                log.warn("dashboard.workbench flowProgress unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("flowProgress"));
            }
            try {
                commonFlows = commonFlows();
            } catch (Exception e) {
                log.warn("dashboard.workbench commonFlows unavailable: {}", e.getMessage());
                warnings.add(DashboardWarning.unavailable("commonFlows"));
            }
        }

        WorkbenchResponse response = new WorkbenchResponse(
            DashboardTime.iso(now),
            new WorkbenchResponse.Metrics(todoTotal, doneTotal, initiatedTotal, copyTotal),
            counts,
            groups,
            efficiency,
            flowProgress,
            commonFlows,
            List.copyOf(warnings)
        );

        meterRegistry.counter("dashboard.workbench.requests").increment();
        sample.stop(meterRegistry.timer("dashboard.workbench.duration"));
        log.info("dashboard.workbench traceId={} tenantId={} userId={} durationMs={} warnings={}",
            traceId(), currentTenantId(), userId, meterRegistry.timer("dashboard.workbench.duration").mean(
                java.util.concurrent.TimeUnit.MILLISECONDS), warningCodes(warnings));
        return response;
    }

    private TodoResult todoResult(String userId, ZonedDateTime now, List<DashboardWarning> warnings) {
        List<Map<String, Object>> rows;
        try {
            rows = safeList(dashboardMapper.selectTodos(userId));
        } catch (Exception e) {
            log.warn("dashboard.workbench todoTotal unavailable: {}", e.getMessage());
            warnings.add(DashboardWarning.unavailable("metrics.todoTotal"));
            return new TodoResult(null, new WorkbenchResponse.GroupCounts(0, 0, 0, 0), emptyGroups());
        }

        Map<String, ClassifiedTask> unique = new LinkedHashMap<>();
        boolean invalid = false;
        for (Map<String, Object> row : rows) {
            String taskId = stringValue(row.get("taskId"));
            if (taskId == null || unique.containsKey(taskId)) {
                continue;
            }
            Date createTime = dateValue(row.get("createTime"));
            if (createTime == null) {
                invalid = true;
                continue;
            }
            DashboardSlaCalculator.Classification classification = DashboardSlaCalculator.classify(
                createTime, stringValue(row.get("flowCode")), properties, now);
            invalid = invalid || classification.invalidData();
            unique.put(taskId, new ClassifiedTask(row, classification));
        }

        List<ClassifiedTask> overdue = new ArrayList<>();
        List<ClassifiedTask> today = new ArrayList<>();
        List<ClassifiedTask> next7 = new ArrayList<>();
        List<ClassifiedTask> unscheduled = new ArrayList<>();
        for (ClassifiedTask task : unique.values()) {
            switch (task.classification().priority()) {
                case DashboardSlaCalculator.OVERDUE -> overdue.add(task);
                case DashboardSlaCalculator.TODAY -> today.add(task);
                case DashboardSlaCalculator.UNSCHEDULED -> unscheduled.add(task);
                default -> next7.add(task);
            }
        }
        Comparator<ClassifiedTask> order = Comparator
            .comparing((ClassifiedTask task) -> task.classification().dueTime(),
                Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(task -> stringValue(task.row().get("taskId")));
        overdue.sort(order);
        today.sort(order);
        next7.sort(order);
        unscheduled.sort(order);

        WorkbenchResponse.GroupCounts counts = new WorkbenchResponse.GroupCounts(
            overdue.size(), today.size(), next7.size(), unscheduled.size());
        if (unique.isEmpty() && invalid) {
            warnings.add(DashboardWarning.invalidData("groups"));
        } else if (invalid) {
            warnings.add(DashboardWarning.invalidData("groups.next7Days"));
        }

        WorkbenchResponse.Groups groups = new WorkbenchResponse.Groups(
            items(overdue), items(today), items(next7), items(unscheduled));
        return new TodoResult(unique.size(), counts, groups);
    }

    private List<WorkbenchResponse.TaskItem> items(List<ClassifiedTask> tasks) {
        List<WorkbenchResponse.TaskItem> result = new ArrayList<>();
        for (ClassifiedTask task : tasks.stream().limit(50).toList()) {
            Map<String, Object> row = task.row();
            DashboardSlaCalculator.Classification classification = task.classification();
            result.add(new WorkbenchResponse.TaskItem(
                stringValue(row.get("taskId")),
                stringValue(row.get("flowName")),
                stringValue(row.get("initiatorName")),
                stringValue(row.get("nodeName")),
                DashboardTime.iso(classification.dueTime()),
                classification.overdueHours(),
                classification.priority()
            ));
        }
        return result;
    }

    private WorkbenchResponse.Groups emptyGroups() {
        return new WorkbenchResponse.Groups(List.of(), List.of(), List.of(), List.of());
    }

    private List<WorkbenchResponse.FlowProgressItem> flowProgress(String userId) {
        List<WorkbenchResponse.FlowProgressItem> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectFlowProgress(userId))) {
            long total = longValue(row.get("totalNodes"));
            long done = longValue(row.get("doneNodes"));
            Integer percent = total <= 0 ? null : (int) Math.min(100, Math.max(0, done * 100 / total));
            result.add(new WorkbenchResponse.FlowProgressItem(
                stringValue(row.get("instanceId")),
                stringValue(row.get("flowName")),
                stringValue(row.get("nodeName")),
                percent,
                null
            ));
        }
        return result;
    }

    private List<WorkbenchResponse.CommonFlowItem> commonFlows() {
        List<WorkbenchResponse.CommonFlowItem> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectCommonFlows(8))) {
            result.add(new WorkbenchResponse.CommonFlowItem(
                stringValue(row.get("definitionId")), stringValue(row.get("name"))));
        }
        return result;
    }

    private List<HomeResponse.DeptDistributionItem> deptDistribution(String tenantId) {
        List<HomeResponse.DeptDistributionItem> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectDeptDistribution(tenantId, 5))) {
            result.add(new HomeResponse.DeptDistributionItem(
                stringValue(row.get("deptId")),
                stringValue(row.get("deptName")),
                number(row.get("userCount"))
            ));
        }
        return result;
    }

    private List<HomeResponse.LoginTrendItem> loginTrend(String tenantId, ZonedDateTime now) {
        Map<String, Integer> counts = new HashMap<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectLoginTrend(
            tenantId, startOfDay(now.toLocalDate().minusDays(6)), startOfDay(now.toLocalDate().plusDays(1))))) {
            counts.put(stringValue(row.get("date")), number(row.get("count")));
        }
        List<HomeResponse.LoginTrendItem> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate day = now.toLocalDate().minusDays(i);
            result.add(new HomeResponse.LoginTrendItem(DashboardTime.date(day), counts.getOrDefault(DashboardTime.date(day), 0)));
        }
        return result;
    }

    private List<HomeResponse.RecentLogin> recentLogins(String tenantId) {
        List<HomeResponse.RecentLogin> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectRecentLogins(tenantId, 5))) {
            result.add(new HomeResponse.RecentLogin(
                stringValue(row.get("userName")),
                stringValue(row.get("ipaddr")),
                DashboardTime.iso(dateTime(row.get("loginTime"))),
                "0".equals(stringValue(row.get("status"))) ? "SUCCESS" : "FAIL"
            ));
        }
        return result;
    }

    private List<HomeResponse.RecentOperation> recentOperations(String tenantId) {
        List<HomeResponse.RecentOperation> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectRecentOperations(tenantId, 5))) {
            result.add(new HomeResponse.RecentOperation(
                stringValue(row.get("operName")),
                stringValue(row.get("title")),
                DashboardTime.iso(dateTime(row.get("operTime"))),
                number(row.get("status")) == 0 ? "SUCCESS" : "FAIL"
            ));
        }
        return result;
    }

    private List<HomeResponse.NoticeItem> notices(String tenantId) {
        List<HomeResponse.NoticeItem> result = new ArrayList<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectLatestNotices(tenantId, 3))) {
            String type = stringValue(row.get("noticeType"));
            String label;
            try {
                label = dictService.getDictLabel("sys_notice_type", type);
            } catch (Exception e) {
                label = type;
            }
            result.add(new HomeResponse.NoticeItem(
                stringValue(row.get("noticeId")),
                stringValue(row.get("title")),
                type,
                label,
                null
            ));
        }
        return result;
    }

    private Integer countOnline(String tenantId) {
        Iterable<String> keys = redissonClient.getKeys().getKeysByPattern(ONLINE_PREFIX + "*");
        Set<String> userNames = new HashSet<>();
        for (String key : keys) {
            try {
                Object value = redissonClient.getBucket(key).get();
                if (value instanceof UserOnlineDTO dto && dto.getUserName() != null) {
                    userNames.add(dto.getUserName());
                }
            } catch (Exception e) {
                log.debug("dashboard.home skip online token {}: {}", key, e.getMessage());
            }
        }
        if (userNames.isEmpty()) {
            return 0;
        }
        Set<String> tenantUserNames = new HashSet<>();
        for (Map<String, Object> row : safeList(dashboardMapper.selectUserTenants(userNames))) {
            if (tenantId.equals(stringValue(row.get("tenantId")))) {
                tenantUserNames.add(stringValue(row.get("userName")));
            }
        }
        return (int) userNames.stream().filter(tenantUserNames::contains).count();
    }

    private HomeResponse.Health health() {
        List<HomeResponse.HealthService> services = new ArrayList<>();
        long appStart = System.nanoTime();
        services.add(new HomeResponse.HealthService("应用服务", "UP", millisSince(appStart)));

        boolean mysqlDown = false;
        Integer mysqlLatency = null;
        String mysqlStatus;
        long mysqlStart = System.nanoTime();
        try (Connection connection = dataSource.determineDataSource().getConnection()) {
            mysqlStatus = connection.isValid(1) ? "UP" : "DOWN";
            mysqlLatency = millisSince(mysqlStart);
            mysqlDown = !"UP".equals(mysqlStatus);
        } catch (Exception e) {
            mysqlStatus = "DOWN";
            mysqlDown = true;
        }
        services.add(new HomeResponse.HealthService("MySQL", mysqlStatus, mysqlLatency));

        boolean redisDown = false;
        Integer redisLatency = null;
        String redisStatus;
        long redisStart = System.nanoTime();
        try {
            redissonClient.getBucket(HEALTH_REDIS_KEY).isExists();
            redisStatus = "UP";
            redisLatency = millisSince(redisStart);
        } catch (Exception e) {
            redisStatus = "DOWN";
            redisDown = true;
        }
        services.add(new HomeResponse.HealthService("Redis", redisStatus, redisLatency));

        services.add(new HomeResponse.HealthService("任务调度", "UNKNOWN", null));

        String status;
        if (mysqlDown || redisDown) {
            status = "DOWN";
        } else {
            status = "DEGRADED";
        }
        return new HomeResponse.Health(status, services, cpuUsage(), memoryUsage(), diskUsage());
    }

    private Integer cpuUsage() {
        try {
            java.lang.management.OperatingSystemMXBean bean = ManagementFactory.getOperatingSystemMXBean();
            if (bean instanceof com.sun.management.OperatingSystemMXBean sun) {
                double load = sun.getCpuLoad();
                if (load < 0) {
                    double average = sun.getSystemLoadAverage();
                    load = average < 0 ? 0 : average / Math.max(1, sun.getAvailableProcessors());
                }
                return clampPercent((int) Math.round(load * 100));
            }
        } catch (Exception e) {
            log.debug("dashboard.home cpuUsage unavailable: {}", e.getMessage());
        }
        return 0;
    }

    private Integer memoryUsage() {
        try {
            java.lang.management.OperatingSystemMXBean bean = ManagementFactory.getOperatingSystemMXBean();
            if (bean instanceof com.sun.management.OperatingSystemMXBean sun) {
                long total = sun.getTotalMemorySize();
                long free = sun.getFreeMemorySize();
                if (total > 0) {
                    return clampPercent((int) Math.round((total - free) * 100.0 / total));
                }
            }
        } catch (Exception e) {
            log.debug("dashboard.home memoryUsage unavailable: {}", e.getMessage());
        }
        return 0;
    }

    private Integer diskUsage() {
        try {
            File root = new File(".").getAbsoluteFile();
            long total = root.getTotalSpace();
            long usable = root.getUsableSpace();
            if (total > 0) {
                return clampPercent((int) Math.round((total - usable) * 100.0 / total));
            }
        } catch (Exception e) {
            log.debug("dashboard.home diskUsage unavailable: {}", e.getMessage());
        }
        return 0;
    }

    private Set<String> currentPermissions() {
        try {
            Set<String> permissions = permissionService.getMenuPermission(LoginHelper.getUserId());
            return permissions == null ? Set.of() : permissions;
        } catch (Exception e) {
            log.warn("dashboard permission lookup failed: {}", e.getMessage());
            return Set.of();
        }
    }

    private boolean has(Set<String> permissions, String permission) {
        return permissions.contains("*:*:*") || permissions.contains(permission);
    }

    private String currentTenantId() {
        String tenantId = LoginHelper.getTenantId();
        return tenantId == null || tenantId.isBlank() ? TenantConstants.DEFAULT_TENANT_ID : tenantId;
    }

    private String timeoutCode(Exception e) {
        Throwable cause = e;
        while (cause != null) {
            if (cause instanceof SQLTimeoutException) {
                return DashboardWarning.TIMEOUT;
            }
            cause = cause.getCause();
        }
        String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        return message.contains("timeout") || message.contains("timed out")
            ? DashboardWarning.TIMEOUT : DashboardWarning.UNAVAILABLE;
    }

    private Date startOfDay(LocalDate date) {
        return date(date.atStartOfDay(DashboardTime.ZONE));
    }

    private Date date(ZonedDateTime time) {
        return Date.from(time.toInstant());
    }

    private Date dateValue(Object value) {
        if (value instanceof Date date) {
            return date;
        }
        if (value instanceof java.time.LocalDateTime local) {
            return date(local.atZone(DashboardTime.ZONE));
        }
        return null;
    }

    private ZonedDateTime dateTime(Object value) {
        Date date = dateValue(value);
        return date == null ? null : DashboardTime.at(date);
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private Integer number(Long value) {
        return value == null ? null : value.intValue();
    }

    private List<Map<String, Object>> safeList(List<Map<String, Object>> value) {
        return value == null ? List.of() : value;
    }

    private int clampPercent(int value) {
        return Math.min(100, Math.max(0, value));
    }

    private int millisSince(long startedNanos) {
        return (int) Duration.ofNanos(System.nanoTime() - startedNanos).toMillis();
    }

    private List<String> warningCodes(List<DashboardWarning> warnings) {
        return warnings.stream().map(w -> w.field() + ":" + w.code()).toList();
    }

    private String traceId() {
        String traceId = MDC.get("traceId");
        return traceId == null || traceId.isBlank() ? UUID.randomUUID().toString().replace("-", "") : traceId;
    }

    private record UserData(
        Integer userTotal,
        List<HomeResponse.DeptDistributionItem> deptDistribution
    ) {
    }

    private record LoginData(
        Integer todayLoginTotal,
        List<HomeResponse.LoginTrendItem> loginTrend
    ) {
    }

    private record ClassifiedTask(Map<String, Object> row, DashboardSlaCalculator.Classification classification) {
    }

    private record TodoResult(
        Integer total,
        WorkbenchResponse.GroupCounts counts,
        WorkbenchResponse.Groups groups
    ) {
    }
}
