package com.aoyou.web.domain.vo;

/**
 * SPEC-005 §4.2 warnings[].code 枚举。
 */
public record DashboardWarning(String field, String code) {

    public static final String PERMISSION_DENIED = "PERMISSION_DENIED";
    public static final String TIMEOUT = "TIMEOUT";
    public static final String UNAVAILABLE = "UNAVAILABLE";
    public static final String INVALID_DATA = "INVALID_DATA";

    public static DashboardWarning permissionDenied(String field) {
        return new DashboardWarning(field, PERMISSION_DENIED);
    }

    public static DashboardWarning timeout(String field) {
        return new DashboardWarning(field, TIMEOUT);
    }

    public static DashboardWarning unavailable(String field) {
        return new DashboardWarning(field, UNAVAILABLE);
    }

    public static DashboardWarning invalidData(String field) {
        return new DashboardWarning(field, INVALID_DATA);
    }
}
