# 登录后首页 / 工作台原型（3 套方案）

> 设计评审用原型，不是交付依据。按仓库 `CLAUDE.md` 铁律 1，选定方案后必须先升版 Spec Packet（断言、Eval、trace），才能进入实现。

## 如何查看

直接用浏览器打开 `index.html`（无需构建、无需起服务）：

```text
docs/prototypes/home-workspace/index.html
```

页面顶部原型工具条可切换：

- **方案**：A 运营驾驶舱 / B 协同工作台 / C 角色门户
- **页面**：首页 / 工作台
- **主题**：深色 / 浅色
- **C 方案专属**：管理员 / 业务用户视角；工作台「编辑布局」可查看拖拽、隐藏态

所有数据均为 mock，未连接后端。原型按 1440px 桌面宽度设计，同时做了 1280 / 1024 / 760px 降级。

## 三套方案

| | A 运营驾驶舱 | B 协同工作台 | C 角色门户 |
|---|---|---|---|
| 首页主线 | 系统运营数据 + 快捷入口 + 公告/日志 | 问候 + 待办分组 + 流程进度 | 按角色切换：管理员看运行态势，业务用户看个人待办 |
| 工作台主线 | 欢迎卡 + 待办 + 我发起的流程 + 动态 | 待办列表 + 筛选栏 + 效率/常用流程上下文 | 可编辑的组件化工作台（拖拽 / 隐藏占位） |
| 适合 | 管理平台默认首页，管理员/运营角色 | 流程任务密集的业务用户 | 多角色、多租户，需要“一人一面”的部署 |
| 优点 | 信息密度高，平台能力一眼可见 | 任务优先，路径短，办理效率高 | 角色适配 + 个性化，扩展性强 |
| 代价 | 指标聚合接口较多 | 管理视角弱，非流程用户价值低 | 角色映射、组件偏好持久化，工作量最大 |
| 推荐度 | ★★★★☆（默认推荐首页） | ★★★★☆（推荐工作台） | ★★★☆☆（二期考虑） |

**推荐组合**：A 首页 + B 工作台。首页承担“平台运行态势”，工作台承担“我今天要办什么”，两者不重复。C 可作为多角色部署的后续演进。

## 截图

- A：首页 [深色](screens/a-home-dark.png) · [浅色](screens/a-home-light.png)；工作台 [深色](screens/a-workbench-dark.png)
- B：首页 [深色](screens/b-home-dark.png) · [浅色](screens/b-home-light.png)；工作台 [深色](screens/b-workbench-dark.png)
- C：管理员首页 [深色](screens/c-home-admin-dark.png)；业务用户首页 [深色](screens/c-home-user-dark.png) · [浅色](screens/c-home-user-light.png)；工作台 [深色](screens/c-workbench-dark.png) · [编辑态](screens/c-workbench-edit-dark.png)

截图由本地 Edge（Playwright `channel: msedge`）在 1440×1000 视口下生成。

## 参考来源与限制

**检索受限，需要如实说明**：本次实时检索管理平台首页/工作台的公开页面时，搜索接口返回 `403 Access denied`，对 Ant Design Pro、Arco Design、Vben 在线文档的直接抓取也被安全策略拦截。因此本原型不是对某个线上页面的复刻，参考依据是：

1. 仓库内 Vben Admin 5.7 的 `dashboard/analytics`、`dashboard/workspace` 示例组件与布局参数；
2. 仓库内 RuoYi-Vue-Plus 的真实菜单域、控制器与接口字段；
3. 管理平台通用信息架构（Ant Design Pro / Arco / RuoYi 的常见工作台范式）——属于经验归纳，未做逐页截图比对。

结论：**视觉方向可评审，但不能声称“与某平台对齐”**；若需要逐像素对标，需在可联网环境下补一轮截图研究。

## 数据与接口映射

“现状”列基于当前仓库代码，不等于已实现前端 API 模块。

| 原型元素 | 可用接口 / 来源 | 现状 |
|---|---|---|
| 用户总数 | `GET /system/user/list`（分页 `total`） | 直接可用（需 `system:user:list`） |
| 在线用户 | `GET /monitor/online/list` | 直接可用（需 `monitor:online:list`） |
| 待办任务 | `GET /workflow/task/pageByTaskWait` | 直接可用（需流程权限） |
| 已办 / 我发起 / 抄送 | `pageByTaskFinish` / `instance/pageByRunning` / `pageByTaskCopy` | 接口存在，需按当前用户过滤 |
| 今日登录数 | `GET /monitor/logininfor/list` + `params.beginTime/endTime` 的 `total` | 可用，但需一次分页查询 |
| 近 7 日登录趋势 | 无聚合接口 | **需新增后端聚合接口**，否则前端要发 7 次分页查询 |
| 今日异常日志 | `GET /monitor/operlog/list` + 时间范围 + `status` | 可用，需确认服务层时间条件 |
| 最近登录 / 最近操作 | `logininfor/list`、`operlog/list`（倒序取前 N 条） | 直接可用 |
| 通知公告 | `GET /system/notice/list` | 直接可用（需 `system:notice:list`） |
| 部门人员分布 | `GET /system/dept/list` + `GET /system/user/list` 聚合 | **需聚合**（部门树本身不带人数） |
| 流程构成（待办/已办/我发起/抄送） | 四个分页接口的 `total` | 可用但 4 次请求，建议聚合 |
| 本周效率（完成率/时长/超时率） | 无现成接口 | **需新增统计接口** |
| 系统健康（服务/CPU/内存/磁盘） | 主应用无 `/monitor/admin` 控制器；存在独立 Spring Boot Admin（`aoyou-monitor-admin`，端口 9090，`/admin`） | **需新增只读接口或外链 SBA**，不能直接调主应用 |
| 快捷入口 | `GET /getRouters` 菜单树 + 权限过滤 | 可用；需过滤外链/隐藏菜单 |
| 工作台组件偏好（C） | 无 | **需新增持久化接口**（用户级布局） |

## 实现前必须解决 / 写进 Spec 的点

1. **路由与默认首页**：当前 `defaultHomePath` 是 `/index` 常量路由（FR-015，`src/preferences.ts`、`src/router/routes/modules/home.ts`）。换成新首页会改 FR-015，必须走 Spec 升版，不能直接改常量。
2. **接口缺口**：7 日趋势、部门人数、本周效率、系统健康、组件偏好五类没有现成接口。Spec 必须明确“新增接口”或“前端聚合”的选择，并定义空态/权限不足态。
3. **权限降级**：普通用户可能没有 `monitor:*`、`system:user:list`、流程权限。每个卡片必须有“无权限隐藏 / 空态”规则，不能整页报错。
4. **多租户**：用户数、在线数、公告必须按当前租户口径；跨租户聚合属于 Non-goals，除非 Spec 明确。
5. **性能**：首页首屏不要串行发 10+ 个分页请求；聚合接口或并发 + 缓存需在 Spec 中定义超时与降级。
6. **视觉令牌**：不要把原型色值硬编码进业务组件；应落到 Vben CSS 变量/主题令牌，并保留深色模式（Vben 默认 dark）。
7. **图表**：建议复用 `@vben/plugins/echarts`；单序列折线不加图例、2px 线、端点标注；状态色必须“圆点 + 文字”，不能只靠颜色。C 的分段条需保留图例与可读数值。
8. **C 方案的角色适配**：需要角色 → 首页变体的映射规则、默认变体、以及“无匹配角色”兜底；拖拽排序/隐藏需持久化与重置。
9. **响应式**：原型在 1024px 以下会折叠侧栏/快捷入口；实现时以 Vben 布局断点为准，不照搬原型断点。

## 建议的验收断言（供 Spec Packet 参考）

- A-xx：未登录访问 `/index` 跳转登录；登录后默认落到选定首页。
- A-xx：首页首屏在 3 秒内完成（或骨架屏在 300ms 内出现），聚合接口失败时卡片降级为空态而非白屏。
- A-xx：无 `monitor:*` 权限的用户看不到系统健康/日志卡片，且无控制台报错。
- A-xx：待办数字与 `/workflow/task/pageByTaskWait` 的 `total` 一致；点击“办理”进入对应任务页。
- A-xx：浅色/深色下文本对比度满足 WCAG AA；图表有表格/文字替代。
- A-xx：C 方案切换角色后首页内容切换，侧边栏权限不因“预览切换”而改变（预览仅影响首页展示）。
