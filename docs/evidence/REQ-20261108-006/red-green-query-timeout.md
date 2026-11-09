# RED → GREEN：DashboardMapper 3 秒超时拦截器

- 需求：REQ-20261108-006（SPEC-005 v1.4，A-12 / E-10）
- 缺陷：`DashboardQueryTimeoutInterceptor` 在 `invocation.proceed()` 之前读取
  `delegate.statement`；MyBatis `BaseStatementHandler` 没有该字段，`prepare()` 返回后才创建
  `Statement`。运行时表现为每个 `DashboardMapper` 查询抛 `ReflectionException`，A-12 的降级
  路径与整个首页/工作台接口都会被 500 吞掉。
- 修复：`proceed()` 之后对返回的 `Statement` 调用 `setQueryTimeout(3)`；非 DashboardMapper
  语句不设置超时。
- 回归测试：`platform/aoyou-admin/src/test/java/com/aoyou/web/config/DashboardQueryTimeoutInterceptorTest.java`
  使用真实 `RoutingStatementHandler` 驱动 `prepare`，避免 mock 属性查找路径掩盖缺陷。

## RED（修复前）

命令：

```bash
mvn -f platform/pom.xml -pl aoyou-admin -am test \
  -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=DashboardQueryTimeoutInterceptorTest
```

结果（原始输出）：

```text
Java HotSpot(TM) 64-Bit Server VM warning: Sharing is only supported for boot loader classes because bootstrap classpath has been appended
[ERROR] Tests run: 2, Failures: 0, Errors: 1, Skipped: 0, Time elapsed: 12.42 s <<< FAILURE! -- in com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest
[ERROR] com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest.setsTimeoutOnStatementReturnedByPrepare -- Time elapsed: 12.19 s <<< ERROR!
org.apache.ibatis.reflection.ReflectionException: There is no getter for property named 'statement' in 'class org.apache.ibatis.executor.statement.PreparedStatementHandler'
	at org.apache.ibatis.reflection.Reflector.getGetInvoker(Reflector.java:385)
	at org.apache.ibatis.reflection.MetaClass.getGetInvoker(MetaClass.java:160)
	at org.apache.ibatis.reflection.wrapper.BeanWrapper.getBeanProperty(BeanWrapper.java:156)
	at org.apache.ibatis.reflection.wrapper.BeanWrapper.get(BeanWrapper.java:50)
	at org.apache.ibatis.reflection.MetaObject.getValue(MetaObject.java:115)
	at org.apache.ibatis.reflection.wrapper.BaseWrapper.getChildValue(BaseWrapper.java:121)
	at org.apache.ibatis.reflection.wrapper.BeanWrapper.get(BeanWrapper.java:46)
	at org.apache.ibatis.reflection.MetaObject.getValue(MetaObject.java:115)
	at com.aoyou.web.config.DashboardQueryTimeoutInterceptor.intercept(DashboardQueryTimeoutInterceptor.java:45)
	at com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest.prepare(DashboardQueryTimeoutInterceptorTest.java:79)
	at com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest.setsTimeoutOnStatementReturnedByPrepare(DashboardQueryTimeoutInterceptorTest.java:39)
	at java.base/java.lang.reflect.Method.invoke(Method.java:568)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1511)
	at java.base/java.util.ArrayList.forEach(ArrayList.java:1511)

[ERROR] Errors:
[ERROR]   DashboardQueryTimeoutInterceptorTest.setsTimeoutOnStatementReturnedByPrepare:39->prepare:79 ? Reflection There is no getter for property named 'statement' in 'class org.apache.ibatis.executor.statement.PreparedStatementHandler'
[ERROR] Tests run: 2, Failures: 0, Errors: 1, Skipped: 0
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.5.3:test (default-test) on project aoyou-admin:
[ERROR]
[ERROR] See D:\workstation\ai_work_platform\.claude\worktrees\005-home-workbench\platform\aoyou-admin\target\surefire-reports for the individual test results.
[ERROR] See dump files (if any exist) [date].dump, [date]-jvmRun[N].dump and [date].dumpstream.
[ERROR] -> [Help 1]
```

## GREEN（修复后）

修复后以同一命令重跑（2026-11-09T13:17:06+08:00，Maven 有界内存参数）：

```text
[INFO] Running com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.481 s -- in com.aoyou.web.config.DashboardQueryTimeoutInterceptorTest
[INFO] Running com.aoyou.web.service.impl.DashboardServiceImplTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 7.231 s -- in com.aoyou.web.service.impl.DashboardServiceImplTest
[INFO] Tests run: 23, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Finished at: 2026-11-09T13:17:06+08:00
```

完整后端测试在交付前以 `mvn ... test`（不加 `-Dtest`）全量执行：`Tests run: 24,
Failures: 0, Errors: 0, Skipped: 0`。其中 `TagUnitTest` 是上游 `@SpringBootTest`
集成用例，dev 配置固定连 `localhost:3306`；本机 MySQL 由评测栈映射到 3307，
故全量运行通过环境变量覆盖数据源后执行（与 SPEC-005 代码无关）。

## 附：DashboardMapper SQL 缺陷的评测 RED → GREEN

`selectFlowProgress` 误引用 `flow_instance.flow_name`（该列不存在），导致
`/dashboard/workbench` 的 `flowProgress` 查询报错并降级为空数组：

- RED：`specs/evals/reports/REQ-20261108-006-20261109-123750.json`，
  `TC-A07`（`warnings` 出现非预期 `flowProgress:UNAVAILABLE`）与 `TC-A13`
  （`flowProgress.length=0`）失败，12/14。
- 修复：`DashboardMapper.xml` 的 `coalesce(d.flow_name, '未命名流程')`，去掉
  `flow_instance` 不存在的 `i.flow_name` 回退。
- GREEN：`specs/evals/reports/REQ-20261108-006-20261109-125810.json` 中
  `TC-A07/A-13` 接口与 vitest 面通过，13/14（仅缺 E2E A-13 用例，随后补入
  `frontend/tests/e2e/spec005-home-workbench.spec.ts`；最终全量报告见 trace
  的 `test_evidence`）。

