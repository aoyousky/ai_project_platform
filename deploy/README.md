# deploy/ — 本地 Docker 一键启动

用于**在本地验证脚手架能否跑通**：MySQL + Redis + 后端 + 前端。
这不是生产部署方案（没有 TLS、没有多副本、密码明文在 `.env`）。

## 前置

| 依赖 | 要求 |
|---|---|
| Docker Desktop | 已启动（未启动时 `docker info` 报 `npipe:////./dockerDesktopLinuxEngine` 找不到） |
| JDK / Maven | 17 / 3.9+（`prepare.sh` 会打包后端） |
| Node.js | >= 20.19.0（`prepare.sh` 会构建前端） |

**镜像源**：本机到 Docker Hub（`registry-1.docker.io`）不通，默认走公共代理 `docker.m.daocloud.io/library`。
能直连时在 `deploy/.env` 里改成 `REGISTRY=docker.io/library`。

## 三步启动

```bash
cd deploy
cp .env.example .env
# 必填：编辑 .env，把 SA_TOKEN_JWT_SECRET 设成随机值
#   export SA_TOKEN_JWT_SECRET=$(openssl rand -hex 32)

./prepare.sh                              # 产出 build/app.jar 与 build/dist/
docker compose up -d --build              # 起 4 个容器
```

`prepare.sh` 只写 `deploy/build/`（已 gitignore），不改 `platform/` 或 `frontend/`。

## 端口

| 服务 | 容器内 | 宿主机 | 说明 |
|---|---|---|---|
| frontend (nginx) | 80 | **80** | 页面入口 |
| backend | 8080 | 8080 | `/prod-api/*` 由 nginx 反代 |
| mysql | 3306 | **3307** | 宿主机 3306 常被本机 mysqld 占用 |
| redis | 6379 | 6379 | 密码 `REDIS_PASSWORD` |

## 验证

```bash
# 1. 容器状态：mysql / redis 应为 healthy
docker compose ps

# 2. 页面能打开
curl -I http://localhost/

# 3. 后端接口通（验证码接口，无需登录）
curl -s http://localhost/prod-api/auth/code | head -c 200

# 4. 数据库表已建（首次启动会执行 db/migrations/sql 下的 V1/V2）
docker exec awp-mysql mysql -uroot -proot -e \
  "select count(*) as tables_count from information_schema.tables where table_schema='ry-vue';"
```

## 停止与清理

```bash
docker compose down          # 停容器，保留数据卷
docker compose down -v       # 连数据卷一起删（下次启动会重新初始化数据库）
```

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `docker compose` 报 `SA_TOKEN_JWT_SECRET` 缺失 | `.env` 没填该值。这是刻意的（红线 R3），不要加默认值绕过 |
| `pull access denied` / 超时 | 镜像源不可用，换 `REGISTRY` |
| 端口 80 被占用 | 改 `docker-compose.yml` 里 frontend 的 `ports`，如 `"8081:80"` |
| 后端起不来，日志显示连不上数据库 | 等 mysql healthy 再起；首次初始化约 30–60 秒 |
| 页面能打开但接口 502 | backend 还没就绪，稍等或 `docker logs awp-backend` |
| 流程设计器空白，控制台 404 `/prod-api/warm-flow-ui/js/*.js` | `nginx/default.conf` 的 `location ^~ /prod-api/` 少了 `^~`。正则 location（`\.js\|\.css$`）优先级高于前缀，会把 API 请求截到本地静态目录。**不要删这个 `^~`** |

## 与业务交付的关系

`deploy/` 是**本地验证工具**，不属于交付物；业务代码仍只落在
`business/<context>/` 与 `frontend/src/(views|api)/<context>/`（见 `docs/AI-DELIVERY-REDLINES.md`）。
