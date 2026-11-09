package com.aoyou.web.service.dashboard;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;

/**
 * SPEC-005 §4.5：所有日期时间统一按 Asia/Shanghai，接口输出带 +08:00 偏移。
 */
public final class DashboardTime {

    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    private static final DateTimeFormatter ISO_OFFSET =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private DashboardTime() {
    }

    public static ZonedDateTime now() {
        return ZonedDateTime.now(ZONE);
    }

    public static ZonedDateTime at(Date date) {
        return date.toInstant().atZone(ZONE);
    }

    public static String iso(ZonedDateTime time) {
        return time == null ? null : ISO_OFFSET.format(time);
    }

    public static String date(LocalDate date) {
        return DATE.format(date);
    }
}
