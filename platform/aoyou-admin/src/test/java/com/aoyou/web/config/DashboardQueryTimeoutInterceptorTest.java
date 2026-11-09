package com.aoyou.web.config;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;

import org.apache.ibatis.builder.StaticSqlSource;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.executor.statement.RoutingStatementHandler;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * SPEC-005 E-10：DashboardMapper 的每条 SQL 在 prepare 返回后都必须带上 3 秒超时。
 *
 * <p>这里用真实的 {@link RoutingStatementHandler}（MyBatis 插件链实际包裹的对象）
 * 驱动 {@link StatementHandler#prepare}，而不是 mock 掉属性查找路径；否则
 * “{@code delegate.statement} 在 prepare 之前并不存在”这一事实会被掩盖。</p>
 */
@Tag("dev")
class DashboardQueryTimeoutInterceptorTest {

    private static final int TIMEOUT_SECONDS = 3;

    @Test
    void setsTimeoutOnStatementReturnedByPrepare() throws Throwable {
        PreparedStatement statement = prepare("com.aoyou.web.mapper.DashboardMapper.countUsers");

        verify(statement).setQueryTimeout(TIMEOUT_SECONDS);
    }

    @Test
    void leavesOtherMappersUntouched() throws Throwable {
        PreparedStatement statement = prepare("com.aoyou.system.mapper.SysUserMapper.selectPage");

        verify(statement, never()).setQueryTimeout(TIMEOUT_SECONDS);
    }

    private PreparedStatement prepare(String statementId) throws Throwable {
        Configuration configuration = new Configuration();
        MappedStatement mappedStatement = new MappedStatement.Builder(
            configuration,
            statementId,
            new StaticSqlSource(configuration, "select 1"),
            SqlCommandType.SELECT
        ).build();

        Connection connection = mock(Connection.class);
        PreparedStatement statement = mock(PreparedStatement.class);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(connection.prepareStatement(anyString(), anyInt(), anyInt())).thenReturn(statement);

        StatementHandler handler = new RoutingStatementHandler(
            mock(Executor.class),
            mappedStatement,
            null,
            RowBounds.DEFAULT,
            null,
            mappedStatement.getBoundSql(null)
        );
        Invocation invocation = new Invocation(
            handler,
            StatementHandler.class.getMethod("prepare", Connection.class, Integer.class),
            new Object[] {connection, null}
        );

        new DashboardQueryTimeoutInterceptor().intercept(invocation);
        return statement;
    }
}
