package com.aoyou.web.mapper;

import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;

/**
 * 首页/工作台只读聚合 SQL。
 *
 * <p>所有方法只查询，不写入；时间字段返回原始 {@link Date}，供服务层按
 * Asia/Shanghai 与 SLA 进行派生计算。</p>
 */
public interface DashboardMapper {

    Long countUsers(@Param("tenantId") String tenantId);

    List<Map<String, Object>> selectDeptDistribution(
        @Param("tenantId") String tenantId,
        @Param("limit") int limit
    );

    /**
     * 登录趋势与今日登录数共用一个查询；statement timeout=3s（SPEC-005 E-10 / A-12）。
     */
    @Options(timeout = 3)
    List<Map<String, Object>> selectLoginTrend(
        @Param("tenantId") String tenantId,
        @Param("start") Date start,
        @Param("endExclusive") Date endExclusive
    );

    Long countErrorOperations(
        @Param("tenantId") String tenantId,
        @Param("start") Date start,
        @Param("endExclusive") Date endExclusive
    );

    List<Map<String, Object>> selectLatestNotices(
        @Param("tenantId") String tenantId,
        @Param("limit") int limit
    );

    List<Map<String, Object>> selectRecentLogins(
        @Param("tenantId") String tenantId,
        @Param("limit") int limit
    );

    List<Map<String, Object>> selectRecentOperations(
        @Param("tenantId") String tenantId,
        @Param("limit") int limit
    );

    List<Map<String, Object>> selectUserTenants(@Param("userNames") Collection<String> userNames);

    Long countTodos(@Param("userId") String userId);

    List<Map<String, Object>> selectTodos(@Param("userId") String userId);

    Long countDoneTasks(@Param("userId") String userId);

    Long countInitiatedInstances(@Param("userId") String userId);

    Long countCopyTasks(@Param("userId") String userId);

    List<Map<String, Object>> selectEfficiencyRecords(
        @Param("userId") String userId,
        @Param("start") Date start,
        @Param("end") Date end
    );

    List<Map<String, Object>> selectFlowProgress(@Param("userId") String userId);

    List<Map<String, Object>> selectCommonFlows(@Param("limit") int limit);
}
