# 证据：本地 Docker 栈端到端启动验证

- **日期**：2026-11-01
- **环境**：Windows 10 + Docker Desktop（Linux 容器），JDK 17 / Maven 3.9+ / Node v24.15.0
- **范围**：`deploy/docker-compose.yml` 定义的 4 个容器（mysql / redis / backend / frontend）+ 1 个一次性初始化容器（db-init）
- **结论**：脚手架**可启动、可访问、可登录、可读库**。下文每条结论都附实际命令输出。
- **本轮状态**：本文件已按 **`ruoyi` → `aoyou` 改名后**（包名 `com.aoyou`、库名 `aoyou`、主类 `AoyouApplication`）重跑并更新，见 §0。

---

## 0. 改名后复验（2026-11-01，第二轮）

改名的可验证面：模块目录 `ruoyi-*` → `aoyou-*`、Java 包 `org.dromara` → `com.aoyou`、
启动类 `DromaraApplication` → `AoyouApplication`、默认库名 `ry-vue` → `aoyou`、Redis 密码 `ruoyi123` → `aoyou123`。

```bash
# 全量重建：连数据卷一起删（旧卷里是 ry-vue 库）
docker compose down -v
docker compose up -d --build
```

| 检查 | 命令 | 结果 |
|---|---|---|
| 初始化脚本用的是改名后文件 | `docker logs awp-db-init` | `=> /sql/V1__baseline_aoyou_5.6.2.sql` / `=> /sql/V2__workflow_aoyou_5.6.2.sql` / `初始化完成` |
| 主类已改名 | `docker logs awp-backend \| grep Started` | `Started AoyouApplication in 50.474 seconds` |
| 包名已生效（日志 logger 前缀） | 同上 | `c.a.common.json.config.JacksonConfig`、`c.b.m.e.s.MybatisPlusApplicationContextAware`（`com.aoyou.*` 缩写） |
| 库名已是 aoyou | `show databases` | `aoyou`（无 `ry-vue`） |
| 建表数 | `select count(*) ... table_schema='aoyou'` | 36 |
| 中文未损坏 | `select hex(nick_name), char_length(nick_name)` | `E796AFE78B82E79A84E78BAEE5AD904C69` / 7 |
| 前端 | `curl -I http://localhost/` | 200，114072 字节 |
| 验证码接口（经 nginx） | `curl http://localhost/prod-api/auth/code` | 200，`captchaEnabled:true` |
| 流程设计器（nginx `^~` 回归） | `curl http://localhost/prod-api/warm-flow-ui/index.html` | 200，5816 字节，与直连 8080 完全一致；`js/index-B4cSnZcq.js` 经 nginx 与直连均为 `text/javascript` 3199479 字节 |
| 业务测试单测 | `mvn -f platform/pom.xml -pl aoyou-admin -am package -DskipTests` | BUILD SUCCESS，产出 `aoyou-admin.jar` |
| ArchUnit 门禁 | `mvn -f business/pom.xml test` | `Tests run: 7, Failures: 0, Errors: 0`，测试类 `com.aoyou.business.arch.LayerArchitectureTest` |

> 控制台里 `?` 代替中文是 Windows 终端代码页（GBK）所致，`hex`/`char_length` 才是判据。

---

## 1. 容器状态

```
$ docker compose -f deploy/docker-compose.yml ps
NAME           STATUS
awp-backend    Up 7 minutes
awp-frontend   Up 7 minutes
awp-mysql      Up 8 minutes (healthy)
awp-redis      Up 8 minutes (healthy)
```

`awp-db-init` 为一次性容器（`restart: "no"`），执行完即退出，不在 `ps` 中显示属预期。

---

## 2. 前端

| 检查 | 命令 | 结果 |
|---|---|---|
| 页面可访问 | `curl -I http://localhost/` | `HTTP/1.1 200 OK`，HTML 114072 字节 |
| nginx 配置 | `docker exec awp-frontend nginx -t` | `syntax is ok` / `test is successful` |
| SPA 回退 | 访问 `/system/user` 等前端路由 | 返回 `index.html`（`try_files` 生效） |

## 3. 后端

```
$ docker logs awp-backend | grep "Started"
Started AoyouApplication in 50.474 seconds
```

- Sa-Token v1.45.0 启动横幅正常
- Redis 连接池建立 8 条连接
- 启动参数关闭了 SnailJob 与 SpringBootAdmin 客户端（本次不部署调度中心）

### 3.1 失败即停验证（红线 R3）

`application.yml` 中 `sa-token.jwt-secret-key: ${SA_TOKEN_JWT_SECRET}` 无默认值；
`docker-compose.yml` 用 `${SA_TOKEN_JWT_SECRET:?...}` 强制要求。
**未注入该变量时 compose 直接报错退出**，不会以弱密钥启动。

## 4. 接口连通（无需登录）

```
$ curl -s http://localhost/prod-api/auth/code
{"code":200,"msg":"操作成功","data":{"captchaEnabled":true,"uuid":"f0ba...","img":"iVBORw0K..."}}
```

```
$ curl -s http://localhost/prod-api/system/user/list
{"code":401,"msg":"认证失败，无法访问系统资源","data":null}
```

未登录访问受保护接口被拦截，符合预期。

## 5. 数据库

```
$ docker exec awp-mysql mysql -uroot -proot -e \
    "select count(*) from information_schema.tables where table_schema='aoyou';"
36
```

（初始化由 `db-init` 直接执行 `V*.sql`，**不走 Flyway**，故库内没有 `flyway_schema_history`；36 张即全部业务表。）

### 5.1 中文完整性

```
$ docker exec awp-mysql mysql --default-character-set=utf8mb4 -uroot -proot -N -e \
    "select nick_name, hex(nick_name), char_length(nick_name) from \`aoyou\`.sys_user where user_id=1;"
疯狂的狮子Li    E796AFE78B82E79A84E78BAEE5AD904C69    7
```

hex 以 `E7` 开头（UTF-8 三字节序列），`char_length=7` 与字符数一致。

> **踩坑记录**：最初用镜像自带的 `/docker-entrypoint-initdb.d` 挂载 SQL，
> 该路径下的 `mysql` 客户端按容器 locale 选字符集，默认落到 latin1，
> 触发 `ERROR 1406 Data too long for column 'nick_name'`（31 字节 UTF-8 读成 varchar(30)）。
> 改为独立 `db-init` 服务并显式 `--default-character-set=utf8mb4` 后修复，
> 且加了幂等守卫（`sys_user` 已存在则跳过）。

---

## 6. 端到端登录（完整链路）

### 6.1 为什么要临时关闭加密与验证码

`platform/.../application.yml` 中 `api-decrypt.enabled: true`，`/auth/login` 带 `@ApiEncrypt`。
**裸 curl 发明文登录请求会被 `CryptoFilter` 直接拒绝（403）** —— 这本身说明载荷加密门禁生效，
不是缺陷。要验证登录链路，需要复刻前端的 RSA+AES 加密，或临时关闭两项。

本次选择**另起一个临时容器**验证，避免改动主容器：

- 端口 `8090`，`--api-decrypt.enabled=false --captcha.enable=false`
- 与主容器共用同一 MySQL、同一 Redis、同一 `SA_TOKEN_JWT_SECRET`
- 验证完立即 `docker rm -f`，**主容器全程未重启**

### 6.2 登录

```
$ curl -s -X POST http://localhost:8090/auth/login -H "Content-Type: application/json" -d \
  '{"clientId":"e5cd7e4891bf95d1d19206ce24a7b32e","grantType":"password","username":"admin","password":"admin123"}'
{"code":200,"msg":"操作成功","data":{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","expire_in":604800,...}}
```

JWT payload 解码后已含数据库读出的字段（证明登录过程查了库）：

```
{"loginId":"sys_user:1","userId":1,"userName":"admin","deptId":103,"deptName":"研发部门","tenantId":"000000",...}
```

### 6.3 鉴权接口

途中踩到两个坑，均已在日志中确认原因（保留作为后续排错参考）：

| 报错 | 原因 |
|---|---|
| `未按照指定前缀提交 token，prefix=Bearer` | 裸 token 不带 `Bearer ` 前缀 → 必须 `Authorization: Bearer <jwt>` |
| `客户端ID与Token不匹配` | 必须同时带 `clientid: e5cd7e4891bf95d1d19206ce24a7b32e` 头（与登录时 clientId 一致） |

补齐后：

```
$ curl -s http://localhost:8090/system/user/getInfo -H "Authorization: Bearer $TOKEN" \
    -H "clientid: e5cd7e4891bf95d1d19206ce24a7b32e"
{"code":200,"msg":"操作成功","data":{"user":{"userId":1,"userName":"admin",
 "nickName":"疯狂的狮子Li","email":"crazyLionLi@163.com","deptId":103,...}}}
```

```
$ curl -s "http://localhost:8090/system/user/list?pageNum=1&pageSize=2" <同上两个头>
{"total":3,"rows":[{"userId":1,...,"nickName":"疯狂的狮子Li","deptName":"研发部门",...},...]}
```

```
$ curl -s http://localhost:8090/system/menu/getRouters <同上两个头>
{"code":200,"msg":"操作成功","data":[{"name":"System1","path":"/system","component":"Layout",
 "meta":{"title":"系统管理","icon":"system",...}},...]}
```

覆盖的能力：MyBatis-Plus 查询、分页、中文读写、Redis 会话、Sa-Token 鉴权、菜单权限装配。

### 6.4 经 nginx 走主容器复验

同一个 token 直接打**主容器**（`api-decrypt` 仍为 `true`，未做任何改动）：

```
$ curl -s http://localhost/prod-api/system/user/getInfo \
    -H "Authorization: Bearer $TOKEN" -H "clientid: e5cd7e4891bf95d1d19206ce24a7b32e"
{"code":200,"msg":"操作成功","data":{"user":{"userId":1,"userName":"admin",...}}}
```

→ nginx `/prod-api/` 反向代理 → backend:8080 链路成立。

### 6.5 清理后状态

```
$ docker rm -f awp-backend-verify
awp-backend-verify

$ curl -s http://localhost/prod-api/auth/code
{"code":200,"msg":"操作成功","data":{"captchaEnabled":true,...}}
```

主容器验证码仍为开启状态，未被临时验证影响。

---

## 7. 未验证项（不声称）

| 项 | 状态 | 原因 |
|---|---|---|
| 浏览器内真实登录（前端 RSA+AES 加密链路） | **已另行验证（2026-11-01）** | 见 `docs/evidence/frontend-verify.md`：Headless Edge 走真实加密链路登录成功，未关 `api-decrypt` / `captcha` |
| 文件上传 / OSS | 未验证 | 依赖外部对象存储配置，local 环境未配置 |
| SnailJob 调度、SpringBootAdmin | 未验证 | 本次 `docker-compose.yml` 显式关闭 |
| 多租户 | 未验证且**已按红线 R2 关闭**（`tenant.enable: false`） | 不启用，非缺陷 |
| 生产可用性 | 不适用 | `deploy/` 仅供本地验证，无 TLS、无多副本、密码在 `.env` |

---

## 8. 复现方式

```bash
cd deploy
cp .env.example .env && export SA_TOKEN_JWT_SECRET=$(openssl rand -hex 32)
./prepare.sh
docker compose up -d --build
```

详见 [deploy/README.md](../../deploy/README.md)。
