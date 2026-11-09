package com.aoyou.web.config;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * 首页/工作台配置。
 *
 * <p>SPEC-005 v1.4 §4.4 v1.1 规则与 CLAR-014：默认 SLA 必须为 1～168；
 * 流程覆盖值必须为 0（显式禁用）或 1～168；越界配置启动失败。</p>
 */
@Slf4j
@Data
@ConfigurationProperties(prefix = "dashboard.workbench")
public class DashboardProperties implements InitializingBean {

    /** 近 7 天完成目标，缺省 20。 */
    private int weeklyTarget = 20;

    /** 默认生效 SLA（小时），缺省 72。 */
    private int defaultSlaHours = 72;

    /** 流程级 SLA 覆盖；值为 0 表示该流程显式禁用 SLA。 */
    private Map<String, Integer> slaHoursByFlow = new LinkedHashMap<>();

    @Override
    public void afterPropertiesSet() {
        validate();
    }

    /**
     * 校验配置；启动阶段由 {@link #afterPropertiesSet()} 调用。
     */
    public void validate() {
        if (weeklyTarget < 1) {
            throw invalid("dashboard.workbench.weeklyTarget", String.valueOf(weeklyTarget));
        }
        if (defaultSlaHours < 1 || defaultSlaHours > 168) {
            throw invalid("dashboard.workbench.defaultSlaHours", String.valueOf(defaultSlaHours));
        }
        if (slaHoursByFlow != null) {
            for (Map.Entry<String, Integer> entry : slaHoursByFlow.entrySet()) {
                Integer hours = entry.getValue();
                String key = "dashboard.workbench.slaHoursByFlow." + entry.getKey();
                if (hours == null || hours < 0 || hours > 168) {
                    throw invalid(key, String.valueOf(hours));
                }
            }
        }
    }

    /**
     * 解析流程的生效 SLA；覆盖值优先，缺省使用默认值。
     */
    public int effectiveSlaHours(String flowCode) {
        if (flowCode != null && slaHoursByFlow != null && slaHoursByFlow.containsKey(flowCode)) {
            Integer override = slaHoursByFlow.get(flowCode);
            if (override != null) {
                return override;
            }
        }
        return defaultSlaHours;
    }

    private IllegalStateException invalid(String key, String value) {
        log.error("非法配置 {}={}；允许范围见 SPEC-005 §4.4 v1.1", key, value);
        return new IllegalStateException("非法配置 " + key + "=" + value);
    }
}
