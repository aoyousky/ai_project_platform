package com.aoyou.web.domain.vo;

import java.util.List;

/**
 * SPEC-005 v1.4 §4.2 HomeResponse。
 */
public record HomeResponse(
    String serverTime,
    Metrics metrics,
    List<LoginTrendItem> loginTrend,
    List<DeptDistributionItem> deptDistribution,
    Health health,
    List<NoticeItem> notices,
    List<RecentLogin> recentLogins,
    List<RecentOperation> recentOperations,
    List<DashboardWarning> warnings
) {

    public record Metrics(
        Integer userTotal,
        Integer onlineTotal,
        Integer todoTotal,
        Integer todayLoginTotal,
        Integer todayErrorLogTotal
    ) {
    }

    public record LoginTrendItem(String date, int count) {
    }

    public record DeptDistributionItem(String deptId, String deptName, int userCount) {
    }

    public record Health(
        String status,
        List<HealthService> services,
        Integer cpuUsage,
        Integer memoryUsage,
        Integer diskUsage
    ) {
    }

    public record HealthService(String name, String status, Integer latencyMs) {
    }

    public record NoticeItem(
        String noticeId,
        String title,
        String noticeType,
        String noticeTypeLabel,
        String publishTime
    ) {
    }

    public record RecentLogin(String userName, String ipaddr, String loginTime, String status) {
    }

    public record RecentOperation(String operName, String title, String operTime, String status) {
    }
}
