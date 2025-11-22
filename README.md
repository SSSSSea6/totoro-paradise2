# Totoro-paradise 2

本仓库基于原项目 [BeiyanYunyi/totoro-paradise](https://github.com/BeiyanYunyi/totoro-paradise) fork 并二次开发，在保留原有体验的基础上，引入了「任务队列 + 后台 Worker」的新架构，适配 Cloudflare Pages、Supabase 和 Koyeb 等平台。

## 🧱 实现原理概述

- **前端与 API 网关（Cloudflare Pages + Nuxt 3）**
  - 使用 Nuxt 3 构建单页应用，部署在 Cloudflare Pages 上。
  - 利用 Nitro 的 cloudflare-pages 预设，将 `server/api/*` 路由打包进 `_worker.js`，充当前端的 API 入口。
  - 新增 `POST /api/submitTask` 路由，将用户的代跑请求写入 Supabase 的 `Tasks` 表。

- **任务队列与实时状态（Supabase）**
  - `Tasks` 表作为轻量级任务队列，字段包括 `user_data`（代跑参数）、`status`（PENDING/PROCESSING/SUCCESS/FAILED）、`result_log` 等。
  - 开启 Supabase Realtime，前端通过 `@supabase/supabase-js` 订阅指定任务 ID 的变更，实时显示执行状态与日志。

- **后台执行引擎（Koyeb + totoro-worker）**
  - 独立的 `totoro-worker` 项目运行在 Koyeb Worker 上，常驻轮询 Supabase。
  - Worker 使用最高权限的 `service_role` key，从 `Tasks` 中按顺序抢占 `PENDING` 任务并标记为 `PROCESSING`，防止多个实例重复执行同一条任务。
  - `runner.js` 复用了原项目的核心加密、路线生成和提交逻辑，直接对接龙猫服务器，完成一次完整代跑后写回 `SUCCESS/FAILED` 与详细日志。

- **前端用户体验**
  - 用户点击「开始跑步/提交到队列」后，立即获得 `taskId`，并进入实时监听状态，而不是在浏览器内长时间阻塞实际代跑过程。
  - 如果未配置 Supabase 环境变量，则自动回退为原来的「本地直接请求龙猫服务器」模式，方便本地开发调试。

## ✨ 在原项目基础上的优化

- **异步队列 + 后台 Worker**
  - 长耗时代跑任务迁移到后台 Worker，避免网页卡死、浏览器挂起或用户误关闭页面导致任务失败。
  - 通过轮询 + 乐观锁方式分配任务，使多个 Worker 实例不会抢占同一条任务。

- **实时状态与可观察性**
  - 利用 Supabase Realtime 订阅任务记录更新，前端可实时看到「排队中 / 执行中 / 成功 / 失败」以及详细的 `result_log`。
  - Worker 的异常（如学校服务器错误、Token 失效等）通过结果日志反馈到前端，便于排错。

- **云原生免费架构**
  - 前端与 API：Cloudflare Pages（无需自备服务器，响应快、全球加速）。
  - 队列与实时：Supabase（Postgres + Realtime，免费额度充足）。
  - 后台执行：Koyeb Worker（免费实例、不会休眠，适合常驻轮询任务）。
  - 在「零自建服务器」前提下，实现接近传统后端队列系统的架构能力。

- **兼容与演进**
  - 尽量保持原有 API 封装与加密逻辑不变，只改动调用链路和运行位置，降低升级成本。
  - 仍支持本地一键构建、开发调试，老用户不必完全依赖云端环境。

## 🏗️ 本地构建

```bash
pnpm i
pnpm build
```

## 🚀 运行

```bash
pnpm start
```

开发模式：

```bash
pnpm dev
```

## 📄 许可证（License）

**AGPL-3.0-or-later**。

详见 [LICENSE](LICENSE)。

