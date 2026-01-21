#!/bin/bash

# 安装依赖
echo "📦 安装依赖..."
npm install

# 停止已有进程
echo "🛑 停止已有进程..."
pkill -f "node server.js" 2>/dev/null || true

# 启动服务器
echo "🚀 启动服务器..."
nohup node server.js > server.log 2>&1 &

echo "✅ 服务器已在后台启动"
echo "📊 访问地址: https://mathew-tracker.yunguhs.com/dashboard.html"
echo "📝 查看日志: tail -f server.log"
