# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

LT 是一个包含多个独立子项目的 monorepo，每个子项目有独立的 CLAUDE.md 文件提供详细指导。

## 子项目

### chat-app - 实时聊天应用

仿微信的实时聊天应用，支持文本、图片、语音、文件、视频消息，以及群聊和语音通话功能。

| 技术栈 | 说明 |
|--------|------|
| 前端 | UniApp (Vue 3 + TypeScript) |
| 后端 | Node.js + Express + Socket.io |
| 数据库 | MySQL + Redis |
| 特色功能 | WebRTC 语音通话、多平台支持 |

**快速启动：**
```bash
cd chat-app
docker-compose up -d                    # 启动后端服务
cd client && npm run dev:h5             # 启动前端 (端口 8080)
cd admin && npm run dev                 # 启动后台管理 (端口 8081)
```

详细文档参见：`chat-app/CLAUDE.md`

---

### doudizhu-game - 在线斗地主游戏

完整的斗地主游戏，支持房间匹配、实时对战、断线重连。

| 技术栈 | 说明 |
|--------|------|
| 前端 | Vue 3 + Phaser 3 |
| 后端 | Node.js + Express + Socket.io |
| 数据库 | MySQL + Redis |
| 特色功能 | Phaser 游戏引擎、完整斗地主规则 |

**快速启动：**
```bash
cd doudizhu-game
docker-compose up -d                    # 启动后端服务
cd client && npm run dev                # 启动前端 (端口 8081)
```

详细文档参见：`doudizhu-game/CLAUDE.md`

## 通用开发说明

- 两个项目使用不同的端口，可以同时运行
- 每个项目有独立的 Docker 容器（MySQL/Redis 使用不同端口）
- 进入子项目目录后再执行相应命令
