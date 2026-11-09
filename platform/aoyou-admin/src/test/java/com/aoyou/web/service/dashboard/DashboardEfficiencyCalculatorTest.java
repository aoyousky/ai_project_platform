package com.aoyou.web.service.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.aoyou.web.config.DashboardProperties;

/**
 * SPEC-005 v1.4 §4.4 v1.2 规则：滚动 7×24h 窗口、节点任务时长、四舍五入。
 */
@Tag("dev")
class DashboardEfficiencyCalculatorTest {

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

    private DashboardEfficiencyCalculator.HisRecord record(double handleHours, String flowCode) {
        ZonedDateTime update = NOW.minusHours(1);
        ZonedDateTime create = update.minus(Duration.ofMinutes((long) (handleHours * 60)));
        return new DashboardEfficiencyCalculator.HisRecord(at(create), at(update), flowCode);
    }

    @Test
    void twelveSamplesAverageThreePointTwoAndOneOverdueRoundsToEight() {
        List<DashboardEfficiencyCalculator.HisRecord> records = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            records.add(record(3.0, "normal"));
        }
        // flow fast 覆盖 SLA=1h，5.4h 完成 → 唯一一条超时
        records.add(record(5.4, "fast"));

        DashboardEfficiencyCalculator.Result result = DashboardEfficiencyCalculator.calculate(
            records, properties(Map.of("fast", 1)), NOW);

        assertThat(result.completedThisWeek()).isEqualTo(12);
        assertThat(result.avgHandleHours()).isEqualByComparingTo(new BigDecimal("3.2"));
        assertThat(result.overdueRate()).isEqualTo(8);
    }

    @Test
    void zeroSamplesGiveNullAverageAndRate() {
        DashboardEfficiencyCalculator.Result result = DashboardEfficiencyCalculator.calculate(
            List.of(), properties(Map.of()), NOW);

        assertThat(result.completedThisWeek()).isZero();
        assertThat(result.avgHandleHours()).isNull();
        assertThat(result.overdueRate()).isNull();
    }

    @Test
    void windowIsInclusiveOnBothBoundsAndIgnoresOutsideRecords() {
        ZonedDateTime start = NOW.minusDays(7);
        DashboardEfficiencyCalculator.HisRecord atStart = new DashboardEfficiencyCalculator.HisRecord(
            at(start.minusHours(2)), at(start), "normal");
        DashboardEfficiencyCalculator.HisRecord atNow = new DashboardEfficiencyCalculator.HisRecord(
            at(NOW.minusHours(2)), at(NOW), "normal");
        DashboardEfficiencyCalculator.HisRecord beforeStart = new DashboardEfficiencyCalculator.HisRecord(
            at(start.minusDays(1)), at(start.minusMinutes(1)), "normal");
        DashboardEfficiencyCalculator.HisRecord afterNow = new DashboardEfficiencyCalculator.HisRecord(
            at(NOW.minusHours(2)), at(NOW.plusMinutes(1)), "normal");

        DashboardEfficiencyCalculator.Result result = DashboardEfficiencyCalculator.calculate(
            List.of(atStart, atNow, beforeStart, afterNow), properties(Map.of()), NOW);

        assertThat(result.completedThisWeek()).isEqualTo(2);
        assertThat(result.avgHandleHours()).isEqualByComparingTo(new BigDecimal("2.0"));
    }

    @Test
    void disabledSlaNeverCountsAsOverdue() {
        List<DashboardEfficiencyCalculator.HisRecord> records = List.of(
            record(90.0, "leave"),
            record(1.0, "normal"));

        DashboardEfficiencyCalculator.Result result = DashboardEfficiencyCalculator.calculate(
            records, properties(Map.of("leave", 0)), NOW);

        assertThat(result.completedThisWeek()).isEqualTo(2);
        assertThat(result.overdueRate()).isZero();
    }

    @Test
    void negativeHandlingDurationIsClampedToZero() {
        DashboardEfficiencyCalculator.HisRecord inverted = new DashboardEfficiencyCalculator.HisRecord(
            at(NOW.minusHours(1)), at(NOW.minusHours(2)), "normal");

        DashboardEfficiencyCalculator.Result result = DashboardEfficiencyCalculator.calculate(
            List.of(inverted), properties(Map.of()), NOW);

        assertThat(result.avgHandleHours()).isEqualByComparingTo(new BigDecimal("0.0"));
    }
}
