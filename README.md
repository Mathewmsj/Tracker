# 🔍 Tracker - 轻量级网站分析系统

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/SQLite-sql.js-003B57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/Chart.js-4.x-FF6384?logo=chartdotjs&logoColor=white" alt="Chart.js">
</p>

一个自托管的轻量级网站用户行为追踪与分析系统，提供实时流量监控、设备分析、用户路径可视化等功能。

## ✨ 功能特性

- 📊 **实时流量监控** — PV/UV 统计、实时在线用户
- 📱 **设备分析** — 设备类型、浏览器、操作系统分布
- 🔄 **用户流分析** — Sankey 图可视化用户浏览路径
- 📈 **流量渠道分析** — 直接访问/搜索引擎/社交媒体/外链
- 📅 **灵活时间筛选** — 今日/本周/本月/全部
- 🚀 **SPA 完整支持** — 自动追踪单页应用路由变化

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js 18+ |
| 后端框架 | Express.js 4.x |
| 数据库 | sql.js (SQLite) |
| 图表库 | Chart.js 4.x |
| 流程图 | ECharts 5.x |

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式
npm start

# 或使用启动脚本
./start.sh
```

服务默认运行在 `http://localhost:8811`

### 访问控制台

打开浏览器访问 `http://localhost:8811/dashboard.html`

## 📦 项目结构

```
.
├── server.js          # 服务端入口
├── simulate.js        # 流量模拟脚本
├── start.sh           # 启动脚本
├── analytics.db       # SQLite 数据库文件
├── public/
│   ├── dashboard.html # 分析仪表板
│   └── analytics.js   # 客户端 SDK
└── personal-site/     # 示例网站
```

## 🔗 API 接口

### 数据收集

```
GET /collect?uid={uid}&url={url}&referrer={referrer}
```

返回 1x1 透明 GIF 图片

### 统计数据

```
GET /api/stats?range={today|week|month|all}
```

### 用户流数据

```
GET /api/flow?maxLayers={1-10}
```

### 访客列表

```
GET /api/visitors
```

### 清空数据

```
DELETE /api/clear?confirm=yes-delete-all-data
```

## 📊 客户端 SDK 接入

在需要追踪的网站中添加：

```html
<script src="https://your-domain.com/analytics.js"></script>
```

SDK 会自动：
- 生成并存储唯一访客 ID
- 追踪页面访问
- 支持 SPA 路由变化检测

## 🌐 在线演示

- **控制台**: https://mathew-tracker.yunguhs.com/dashboard.html
- **GitHub**: https://github.com/Mathewmsj/Tracker

## 📄 License

MIT License

---

*Made with ❤️ by Mathew*
