package com.aoyou.web.domain.vo;

import java.math.BigDecimal;
import java.util.List;

/**
 * SPEC-005 v1.4 §4.4 WorkbenchResponse。
 */
public record WorkbenchResponse(
    String serverTime,
    Metrics metrics,
    GroupCounts groupCounts,
    Groups groups,
    Efficiency efficiency,
    List<FlowProgressItem> flowProgress,
    List<CommonFlowItem> commonFlows,
    List<DashboardWarning> warnings
) {

    public record Metrics(
        Integer todoTotal,
        Integer doneTotal,
        Integer initiatedTotal,
        Integer copyTotal
    ) {
    }

    public record GroupCounts(int overdue, int today, int next7Days, int unscheduled) {
    }

    public record Groups(
        List<TaskItem> overdue,
        List<TaskItem> today,
        List<TaskItem> next7Days,
        List<TaskItem> unscheduled
    ) {
    }

    public record TaskItem(
        String taskId,
        String flowName,
        String initiatorName,
        String nodeName,
        String dueTime,
        Integer overdueHours,
        String priority
    ) {
    }

    public record Efficiency(
        int completedThisWeek,
        int weeklyTarget,
        BigDecimal avgHandleHours,
        Integer overdueRate
    ) {
    }

    public record FlowProgressItem(
        String instanceId,
        String flowName,
        String nodeName,
        Integer progressPercent,
        String estimatedEndDate
    ) {
    }

    public record CommonFlowItem(String definitionId, String name) {
    }
}
