package com.aoyou.web.service.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.aoyou.web.config.DashboardProperties;

/**
 * SPEC-005 v1.4 §4.4 v1.1 规则：SLA 派生 dueTime 与四组互斥判定。
 */
@Tag("dev")
class DashboardSlaCalculatorTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final ZonedDateTime NOW = ZonedDateTime.of(2026, 11, 8, 10, 0, 0, 0, ZONE);

    private DashboardProperties properties(Map<String, Integer> overrides) {
        DashboardProperties properties = new DashboardProperties();
        properties.setWeeklyTarget(20);
        properties.setDefaultSlaHours(72);
        properties.setSlaHoursByFlow(overrides);
        return properties;
    }

    private Date at(ZonedDateTime time) {
        return Date.from(time.toInstant());
    }

    @Test
    void overdueUsesStrictlyBeforeNowAndFloorsHours() {
        // D-3 07:00 + 72h = D-0 07:00 → 3 小时前到期
        DashboardSlaCalculator.Classification result = DashboardSlaCalculator.classify(
            at(NOW.minusHours(75)), "normal", properties(Map.of()), NOW);

        assertThat(result.priority()).isEqualTo("OVERDUE");
        assertThat(result.dueTime()).isEqualTo(NOW.minusHours(3));
        assertThat(result.overdueHours()).isEqualTo(3);
        assertThat(result.invalidData()).isFalse();
    }

    @Test
    void dueTimeEqualToNowIsTodayNotOverdue() {
        DashboardSlaCalculator.Classification result = DashboardSlaCalculator.classify(
            at(NOW.minusHours(72)), "normal", properties(Map.of()), NOW);

        assertThat(result.priority()).isEqualTo("TODAY");
        assertThat(result.overdueHours()).isNull();
    }

    @Test
    void tomorrowIsNext7Days() {
        // D-1 11:00 + 72h = D+1 11:00
        DashboardSlaCalculator.Classification result = DashboardSlaCalculator.classify(
            at(NOW.minusHours(47)), "normal", properties(Map.of()), NOW);

        assertThat(result.priority()).isEqualTo("NEXT_7_DAYS");
        assertThat(result.overdueHours()).isNull();
    }

    @Test
    void daySevenIsStillNext7DaysAndDayEightIsInvalidClamped() {
        // dueTime 恰好 D+7（createTime 在未来，仍落在约定窗口内）
        DashboardSlaCalculator.Classification daySeven = DashboardSlaCalculator.classify(
            at(NOW.plusDays(4)), "normal", properties(Map.of()), NOW);
        // 未来 createTime 属于异常数据：既不满足 OVERDUE，也超出 [D+1, D+7]
        DashboardSlaCalculator.Classification dayEight = DashboardSlaCalculator.classify(
            at(NOW.plusDays(5)), "normal", properties(Map.of()), NOW);

        assertThat(daySeven.priority()).isEqualTo("NEXT_7_DAYS");
        assertThat(daySeven.invalidData()).isFalse();
        assertThat(dayEight.priority()).isEqualTo("NEXT_7_DAYS");
        assertThat(dayEight.invalidData()).isTrue();
    }

    @Test
    void zeroOverrideDisablesSlaAndGoesUnscheduled() {
        DashboardSlaCalculator.Classification result = DashboardSlaCalculator.classify(
            at(NOW.minusHours(75)), "leave", properties(Map.of("leave", 0)), NOW);

        assertThat(result.priority()).isEqualTo("UNSCHEDULED");
        assertThat(result.dueTime()).isNull();
        assertThat(result.overdueHours()).isNull();
        assertThat(result.invalidData()).isFalse();
    }

    @Test
    void upperBound168NeverExceedsDaySevenForPastTasks() {
        DashboardProperties properties = properties(Map.of("long", 168));
        DashboardSlaCalculator.Classification atBoundary = DashboardSlaCalculator.classify(
            at(NOW.minusMinutes(1)), "long", properties, NOW);
        DashboardSlaCalculator.Classification earliest = DashboardSlaCalculator.classify(
            at(NOW.minusDays(30)), "long", properties, NOW);

        assertThat(atBoundary.dueTime()).isEqualTo(NOW.plusHours(168).minusMinutes(1));
        assertThat(atBoundary.priority()).isEqualTo("NEXT_7_DAYS");
        assertThat(earliest.priority()).isEqualTo("OVERDUE");
        assertThat(atBoundary.invalidData()).isFalse();
    }
}
