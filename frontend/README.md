# frontend/ — 前端底座

本目录是 RuoYi-Vue-Plus 配套前端 `plus-ui`（tag `v5.6.2-v2.6.2`）的**框架副本**，
已按仓库统一改名规则处理：组件 `RuoYiDoc`/`RuoYiGit` → `AoyouDoc`/`AoyouGit`，
工具类 `src/utils/ruoyi.ts` → `src/utils/aoyou.ts`，样式 `ruoyi.scss` → `aoyou.scss`。

- 来源、commit、可写接缝与**已登记改动**：见 [PROVENANCE.md](PROVENANCE.md)
- 业务页面落点：`src/views/<context>/`、`src/api/<context>/`（`<context>` 与后端 `business/<context>` 同名）
- 技术基线：Vue 3.5 + TypeScript 5.9 + Vite 7 + Element Plus；Node.js >= 20.19.0

## 运行

```bash
npm ci          # 锁定版本安装；package-lock.json 必须入库
npm run dev     # 开发服务器，/dev-api 代理到 http://localhost:8080
npm run build:prod
```

Docker 一键启动（含后端与数据库）见 [../deploy/README.md](../deploy/README.md)。

## 上游文档

上游自身的 README 未随本副本保留（避免把上游的产品介绍误当成本项目说明）：

| 内容 | 地址 |
|---|---|
| 上游仓库 | https://gitee.com/JavaLionLi/plus-ui |
| 上游文档站 | https://plus-doc.dromara.org |

## 许可证

MIT，见 [LICENSE](LICENSE)。版权归上游作者所有；本仓库的改名不改变许可条款。
