package com.aoyou.web.config;

import java.sql.Connection;
import java.sql.Statement;

import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Signature;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.springframework.stereotype.Component;

/**
 * 首页/工作台查询的 3 秒超时（SPEC-005 §5 可观测性与 E-10）。
 *
 * <p>下游查询超过 3 秒未返回时，服务层按 {@code TIMEOUT} 降级为字段 {@code null}
 * 并返回 HTTP 200。该超时只作用于 {@code DashboardMapper}，不影响平台其他查询。</p>
 */
@Component
@Intercepts({
    @Signature(
        type = StatementHandler.class,
        method = "prepare",
        args = {Connection.class, Integer.class}
    )
})
public class DashboardQueryTimeoutInterceptor implements Interceptor {

    static final int QUERY_TIMEOUT_SECONDS = 3;

    private static final String DASHBOARD_MAPPER_PREFIX =
        "com.aoyou.web.mapper.DashboardMapper";

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        MetaObject metaObject = SystemMetaObject.forObject(statementHandler);
        MappedStatement mappedStatement =
            (MappedStatement) metaObject.getValue("delegate.mappedStatement");
        // BaseStatementHandler 在 prepare 内部才创建 Statement，方法返回前
        // `delegate.statement` 不存在（没有该字段），必须在 proceed 之后设置。
        Object result = invocation.proceed();
        if (mappedStatement != null
            && mappedStatement.getId().startsWith(DASHBOARD_MAPPER_PREFIX)
            && result instanceof Statement statement) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
        }
        return result;
    }
}
