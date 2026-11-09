package com.aoyou.web.service.dashboard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.List;

import com.aoyou.web.config.DashboardProperties;

/**
 * SPEC-005 v1.4 §4.4 v1.2 规则：效率统计基于请求时刻往前 7×24 小时闭区间。
 */
public final class DashboardEfficiencyCalculator {

    private DashboardEfficiencyCalculator() {
    }

    public static Result calculate(
        List<HisRecord> records,
        DashboardProperties properties,
        ZonedDateTime now
    ) {
        if (records == null || records.isEmpty()) {
            return new Result(0, null, null);
        }

        ZonedDateTime windowStart = now.minusDays(7);
        int completed = 0;
        int overdue = 0;
        long totalHandleMillis = 0L;

        for (HisRecord record : records) {
            if (record == null || record.updateTime() == null || record.createTime() == null) {
                continue;
            }
            ZonedDateTime updateTime = DashboardTime.at(record.updateTime());
            if (updateTime.isBefore(windowStart) || updateTime.isAfter(now)) {
                continue;
            }
            completed++;

            long handleMillis = Duration.between(
                record.createTime().toInstant(), record.updateTime().toInstant()).toMillis();
            totalHandleMillis += Math.max(0L, handleMillis);

            int slaHours = properties.effectiveSlaHours(record.flowCode());
            if (slaHours > 0) {
                ZonedDateTime dueTime = DashboardTime.at(record.createTime()).plusHours(slaHours);
                if (updateTime.isAfter(dueTime)) {
                    overdue++;
                }
            }
        }

        if (completed == 0) {
            return new Result(0, null, null);
        }

        BigDecimal averageHours = BigDecimal.valueOf(totalHandleMillis)
            .divide(BigDecimal.valueOf(completed).multiply(BigDecimal.valueOf(3_600_000L)), 1, RoundingMode.HALF_UP);
        int overdueRate = BigDecimal.valueOf(overdue)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(completed), 0, RoundingMode.HALF_UP)
            .intValue();

        return new Result(completed, averageHours, overdueRate);
    }

    public record HisRecord(Date createTime, Date updateTime, String flowCode) {
    }

    public record Result(int completedThisWeek, BigDecimal avgHandleHours, Integer overdueRate) {
    }
}
