package com.aoyou.web.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * SPEC-005 v1.4 §4.4 / E-19 / E-20：SLA 与周目标配置校验。
 */
@Tag("dev")
class DashboardPropertiesTest {

    private DashboardProperties properties(int weeklyTarget, int defaultSla, Map<String, Integer> overrides) {
        DashboardProperties properties = new DashboardProperties();
        properties.setWeeklyTarget(weeklyTarget);
        properties.setDefaultSlaHours(defaultSla);
        properties.setSlaHoursByFlow(overrides);
        return properties;
    }

    private Map<String, Integer> overrides(int value) {
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("leave", value);
        return map;
    }

    @Test
    void defaultsAreWeeklyTarget20AndDefaultSla72() {
        DashboardProperties properties = properties(20, 72, Map.of());

        assertThat(properties.getWeeklyTarget()).isEqualTo(20);
        assertThat(properties.getDefaultSlaHours()).isEqualTo(72);
        assertThat(properties.effectiveSlaHours("leave")).isEqualTo(72);
        assertThat(properties.effectiveSlaHours(null)).isEqualTo(72);
    }

    @Test
    void flowOverrideWinsAndZeroDisablesSla() {
        DashboardProperties properties = properties(20, 72, overrides(0));

        assertThat(properties.effectiveSlaHours("leave")).isZero();
        assertThat(properties.effectiveSlaHours("unknown")).isEqualTo(72);
    }

    @Test
    void defaultSlaMustBeWithinOneTo168() {
        for (int invalid : new int[] {0, -1, 169, 240}) {
            DashboardProperties properties = properties(20, invalid, Map.of());
            assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("dashboard.workbench.defaultSlaHours");
        }
    }

    @Test
    void overrideMustBeZeroOrWithinOneTo168() {
        for (int invalid : new int[] {-1, 169}) {
            DashboardProperties properties = properties(20, 72, overrides(invalid));
            assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("dashboard.workbench.slaHoursByFlow.leave");
        }
    }

    @Test
    void overrideZeroAndUpperBound168AreLegal() {
        DashboardProperties zero = properties(20, 72, overrides(0));
        DashboardProperties upper = properties(20, 72, overrides(168));

        zero.validate();
        upper.validate();
    }

    @Test
    void weeklyTargetMustBePositive() {
        DashboardProperties properties = properties(0, 72, Map.of());
        assertThatThrownBy(properties::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("dashboard.workbench.weeklyTarget");
    }
}
