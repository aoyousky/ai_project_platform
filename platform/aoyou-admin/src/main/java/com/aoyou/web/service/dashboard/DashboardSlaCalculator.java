package com.aoyou.web.service.dashboard;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Date;

import com.aoyou.web.config.DashboardProperties;

/**
 * SPEC-005 v1.4 §4.4 v1.1 规则：按 flow_task.create_time 原始值 + 生效 SLA 派生 dueTime，
 * 并按 OVERDUE → TODAY → NEXT_7_DAYS → UNSCHEDULED 的互斥顺序分组。
 */
public final class DashboardSlaCalculator {

    public static final String OVERDUE = "OVERDUE";
    public static final String TODAY = "TODAY";
    public static final String NEXT_7_DAYS = "NEXT_7_DAYS";
    public static final String UNSCHEDULED = "UNSCHEDULED";

    private DashboardSlaCalculator() {
    }

    /**
     * 计算任务的派生截止时间与分组。
     *
     * @param createTime 原始任务创建时间（禁止使用 FlowTaskVo.getCreateTime()）
     * @param flowCode   流程编码，可为 null
     * @param properties SLA 配置
     * @param now        当前时刻（Asia/Shanghai）
     */
    public static Classification classify(
        Date createTime,
        String flowCode,
        DashboardProperties properties,
        ZonedDateTime now
    ) {
        int slaHours = properties.effectiveSlaHours(flowCode);
        if (slaHours == 0) {
            return new Classification(UNSCHEDULED, null, null, false);
        }

        ZonedDateTime dueTime = DashboardTime.at(createTime).plusHours(slaHours);
        if (dueTime.isBefore(now)) {
            long overdueHours = Math.max(0L, Duration.between(dueTime, now).toHours());
            return new Classification(OVERDUE, dueTime, (int) overdueHours, false);
        }

        LocalDate dueDate = dueTime.toLocalDate();
        LocalDate today = now.toLocalDate();
        if (dueDate.equals(today)) {
            return new Classification(TODAY, dueTime, null, false);
        }
        if (dueDate.isAfter(today) && dueDate.isBefore(today.plusDays(8))) {
            return new Classification(NEXT_7_DAYS, dueTime, null, false);
        }

        // createTime 在未来等异常数据：v1.4 上限保证正常数据不会走到这里。
        // 为保证 groupCounts 之和恒等于 todoTotal，仍归入 NEXT_7_DAYS 并标记 INVALID_DATA。
        return new Classification(NEXT_7_DAYS, dueTime, null, true);
    }

    public record Classification(
        String priority,
        ZonedDateTime dueTime,
        Integer overdueHours,
        boolean invalidData
    ) {
    }
}
