# 斗地主游戏实施计划

## 阶段一：项目初始化与基础架构

- [x] 1. 创建项目目录结构
  - 创建 `doudizhu-game/` 目录
  - 初始化 `client/` 前端项目 (Vite + Vue 3 + TypeScript)
  - 初始化 `server/` 后端项目 (Node.js + Express)
  - 创建 `.gitignore`、`README.md`
  - _需求: 基础架构_

- [x] 2. 配置前端开发环境
  - 安装依赖：Vue 3、Pinia、Vue Router、Socket.io-client、Axios
  - 安装 Phaser 3 游戏引擎
  - 配置 Vite（端口 8081、代理配置）
  - 配置 TypeScript
  - 配置 SCSS
  - _需求: 基础架构_

- [x] 3. 配置后端开发环境
  - 安装依赖：Express、Socket.io、mysql2、redis、jsonwebtoken、bcryptjs
  - 创建 `src/app.js` 服务入口
  - 配置 CORS、JSON 中间件
  - 创建配置文件 `src/config/index.js`
  - _需求: 基础架构_

- [x] 4. 配置 Docker 环境
  - 创建 `docker-compose.yml`（MySQL:3307、Redis:6380、Server:4000）
  - 创建 `server/Dockerfile`
  - 配置网络和数据卷
  - 测试 `docker-compose up -d` 启动
  - _需求: 基础架构_

- [x] 5. 创建数据库表结构
  - 创建 `server/sql/init.sql`
  - 创建 users 表（含积分字段）
  - 创建 game_records 表
  - 创建 transactions 表
  - 创建 daily_checkins 表
  - 创建 game_invitations 表
  - 创建 bankrupt_aids 表
  - 测试数据库初始化
  - _需求: REQ-003_

---

## 阶段二：用户系统

- [x] 6. 实现用户注册/登录 API
  - 创建 `server/src/models/User.js`
  - 创建 `server/src/routes/auth.js`
  - 实现 `POST /api/auth/register`（账号、密码、昵称）
  - 实现 `POST /api/auth/login`（返回 JWT）
  - 实现密码 bcrypt 加密
  - _需求: REQ-001_

- [x] 7. 实现 JWT 认证中间件
  - 创建 `server/src/middlewares/auth.js`
  - 验证 Authorization Header
  - 解析 JWT 获取用户信息
  - 处理过期和无效 token
  - _需求: REQ-001_

- [x] 8. 实现用户信息 API
  - 创建 `server/src/routes/user.js`
  - 实现 `GET /api/user/profile`
  - 实现 `PUT /api/user/profile`（修改昵称）
  - 实现 `GET /api/user/stats`（战绩统计）
  - _需求: REQ-013_

- [ ] 9. 实现从聊天应用跳转登录
  - 实现 `POST /api/auth/login-from-chat`
  - 调用聊天服务验证 token
  - 自动创建/关联游戏用户
  - 签发游戏服务 JWT
  - _需求: REQ-002_

- [x] 10. 前端登录页面
  - 创建 `client/src/pages/login/index.vue`
  - 实现登录表单
  - 实现注册表单（切换）
  - 实现 token 存储和自动登录
  - 实现路由守卫
  - _需求: REQ-001_

- [x] 11. 前端用户状态管理
  - 创建 `client/src/store/user.ts`
  - 实现 login、register、logout actions
  - 实现 token 持久化
  - 实现用户信息获取
  - _需求: REQ-001_

---

## 阶段三：积分系统

- [x] 12. 实现积分相关 API
  - 创建 `server/src/routes/coins.js`
  - 实现 `POST /api/coins/checkin`（每日签到）
  - 实现 `GET /api/coins/checkin-status`（签到状态）
  - 实现 `POST /api/coins/bankrupt-aid`（破产补助）
  - 实现 `GET /api/coins/transactions`（交易记录）
  - _需求: REQ-003_

- [x] 13. 实现签到逻辑
  - 检查今日是否已签到
  - 计算连续签到天数
  - 计算签到奖励（500-2000 递增）
  - 记录签到和交易
  - _需求: REQ-003_

- [x] 14. 实现破产补助逻辑
  - 检查金币是否低于 1000
  - 检查当日领取次数（限 3 次）
  - 发放 2000 金币补助
  - 记录交易
  - _需求: REQ-003_

---

## 阶段四：Socket.io 基础设施

- [x] 15. 配置 Socket.io 服务端
  - 创建 `server/src/socket/index.js`
  - 配置 Socket.io 与 Express 集成
  - 实现 JWT 认证中间件
  - 配置 Redis adapter（可选，用于多进程）
  - _需求: 基础架构_

- [x] 16. 实现在线状态管理
  - Redis 存储用户在线状态
  - 实现 `connect` 事件处理
  - 实现 `disconnect` 事件处理
  - 广播上下线通知
  - _需求: 基础架构_

- [x] 17. 前端 Socket 状态管理
  - 创建 `client/src/store/socket.ts`
  - 实现 connect、disconnect actions
  - 实现事件监听和发送封装
  - 实现断线重连逻辑
  - _需求: 基础架构_

---

## 阶段五：游戏大厅

- [x] 18. 实现房间 API
  - 创建 `server/src/routes/room.js`
  - 实现 `GET /api/rooms`（房间列表）
  - 实现 `POST /api/rooms`（创建房间）
  - 实现 `GET /api/rooms/:id`（房间详情）
  - _需求: REQ-004_

- [x] 19. 实现房间 Socket 事件（服务端）
  - 创建 `server/src/socket/room.js`
  - 实现 `room:create` 事件
  - 实现 `room:join` 事件
  - 实现 `room:leave` 事件
  - 实现 `room:ready` 事件
  - 实现 `room:kick` 事件
  - Redis 存储房间状态
  - _需求: REQ-005_

- [x] 20. 实现快速匹配逻辑
  - 实现 `room:quickMatch` 事件
  - 自动查找或创建房间
  - Redis 房间状态管理
  - _需求: REQ-004_

- [x] 21. 前端游戏大厅页面
  - 创建 `client/src/pages/lobby/index.vue`
  - 显示用户信息（头像、昵称、金币）
  - 实现快速匹配入口
  - 实现创建房间入口
  - 实现房间列表
  - 实现签到入口
  - _需求: REQ-004_

- [x] 22. 前端房间状态管理
  - 创建 `client/src/store/room.ts`
  - 实现 createRoom、joinRoom、leaveRoom actions
  - 实现 setReady action
  - 监听房间事件更新状态
  - _需求: REQ-005_

- [x] 23. 前端游戏房间等待页面
  - 创建 `client/src/pages/room/index.vue`
  - 显示 3 个座位
  - 显示玩家信息和准备状态
  - 实现准备/取消准备按钮
  - 实现踢人功能（房主）
  - 实现离开房间按钮
  - _需求: REQ-005_

---

## 阶段六：Phaser 3 游戏引擎集成

- [x] 24. 搭建 Phaser 3 基础框架
  - 创建 `client/src/phaser/config.ts`
  - 创建 `client/src/phaser/GameManager.ts`
  - 创建 `client/src/phaser/EventBus.ts`（Vue-Phaser 通信）
  - 实现 Vue 组件与 Phaser 的桥接
  - 配置 Phaser 缩放模式（1280×720，FIT 自适应）
  - _需求: 基础架构_

- [x] 25. 实现 BootScene 资源加载
  - 创建 `client/src/phaser/scenes/BootScene.ts`
  - 使用 Canvas API 动态生成 54 张扑克牌纹理
  - 动态生成牌背纹理
  - 实现加载进度条
  - _需求: 基础架构_

- [x] 26. 准备游戏素材
  - Canvas 动态生成扑克牌（无需外部图片）
  - Canvas 动态生成牌背
  - Canvas 动态生成牌桌背景
  - 地主/农民标识通过文字和样式实现
  - _需求: 基础架构_

- [x] 27. 实现 Card 扑克牌对象
  - 创建 `client/src/phaser/objects/Card.ts`
  - 实现牌面渲染（花色、点数）
  - 实现点击选中/取消（上移 20px 动画）
  - 实现悬停高亮效果
  - 实现翻牌动画
  - 实现禁用状态
  - _需求: REQ-007_

- [x] 28. 实现 CardGroup 手牌组
  - 创建 `client/src/phaser/objects/CardGroup.ts`
  - 实现手牌居中排列（叠放间距 30px）
  - 实现手牌排序（从大到小）
  - 实现选中牌管理
  - 实现出牌后重新排列动画
  - 实现批量添加/移除牌
  - _需求: REQ-007_

- [x] 29. 实现 GameScene 主游戏场景
  - 创建 `client/src/phaser/scenes/GameScene.ts`
  - 创建 `client/src/phaser/objects/PlayedCardsArea.ts`（出牌区域）
  - 创建 `client/src/phaser/objects/PlayerAvatar.ts`（玩家头像）
  - 创建 `client/src/phaser/objects/Timer.ts`（倒计时）
  - 创建渐变牌桌背景
  - 创建 3 个玩家位置（自己下方，对手左右）
  - 创建底牌显示区
  - 实现从 Store 更新状态
  - _需求: REQ-007_

- [x] 30. 实现 UIScene UI 场景
  - 创建 `client/src/phaser/scenes/UIScene.ts`
  - 创建 `client/src/phaser/ui/BidPanel.ts`（叫地主面板）
  - 创建 `client/src/phaser/ui/ActionButtons.ts`（出牌/不出/提示按钮）
  - 创建 `client/src/phaser/ui/ResultPanel.ts`（结算弹窗）
  - 实现面板显示/隐藏动画
  - 实现按钮启用/禁用状态
  - _需求: REQ-006, REQ-007, REQ-008_

- [x] 31. 实现游戏动画
  - 创建 `client/src/phaser/animations/index.ts`
  - 实现发牌动画（从上方飞入）
  - 实现出牌动画（飞向出牌区）
  - 实现收牌动画
  - 实现胜利/失败动画（金币飞入）
  - 实现淡入淡出效果
  - _需求: 用户体验_

---

## 阶段七：游戏核心逻辑

- [x] 32. 实现扑克牌工具函数
  - 创建 `client/src/game/cardUtils.ts`（类型定义在 types/index.ts）
  - 实现洗牌算法（Fisher-Yates）
  - 实现发牌函数
  - 实现手牌排序函数
  - _需求: REQ-006_

- [x] 33. 实现牌型判断（前端）
  - 创建 `client/src/game/cardTypes.ts`
  - 实现单张、对子、三张判断
  - 实现顺子、连对判断
  - 实现三带一、三带二判断
  - 实现飞机判断
  - 实现炸弹、王炸判断
  - _需求: REQ-007_

- [x] 34. 实现牌型比较（前端）
  - 创建 `client/src/game/cardCompare.ts`
  - 实现同类型牌比较
  - 实现炸弹压制普通牌
  - 实现王炸最大
  - _需求: REQ-007_

- [x] 35. 实现游戏引擎（服务端）
  - 创建 `server/src/game/GameEngine.js`
  - 实现游戏状态机
  - 实现发牌逻辑
  - 实现叫地主逻辑
  - 实现出牌验证
  - 实现回合控制
  - 实现游戏结束判定
  - _需求: REQ-006, REQ-007_

- [x] 36. 实现牌型验证（服务端）
  - 创建 `server/src/game/CardValidator.js`
  - 实现所有牌型判断（与前端一致）
  - 实现出牌合法性验证
  - 实现是否能压过上家判断
  - _需求: REQ-007_

- [x] 37. 实现游戏 Socket 事件（服务端）
  - 更新 `server/src/socket/game.js`
  - 实现 `game:start`（游戏开始，发牌）
  - 实现 `game:bid_turn`、`game:bid`（叫地主）
  - 实现 `game:play_turn`、`game:play`、`game:pass`（出牌）
  - 实现 `game:ended`（游戏结束）
  - 实现超时自动处理
  - _需求: REQ-006, REQ-007_

- [x] 38. 实现游戏结算逻辑
  - 计算倍数（叫分 × 炸弹 × 春天）
  - 计算积分变化
  - 更新玩家金币
  - 记录游戏记录
  - 记录交易记录
  - 更新玩家战绩
  - _需求: REQ-008_

- [x] 39. 前端游戏状态管理
  - 创建 `client/src/store/game.ts`
  - 实现游戏状态管理（phase、cards、currentSeat 等）
  - 实现叫地主 actions（bid）
  - 实现出牌 actions（playCards、pass）
  - 实现提示功能（getHint）
  - 监听游戏事件更新 Phaser 场景
  - 通过 EventBus 与 Phaser 双向通信
  - _需求: REQ-006, REQ-007_

- [x] 40. 前端游戏页面容器
  - 更新 `client/src/pages/game/index.vue`
  - 集成 Phaser GameManager
  - 实现 Phaser 生命周期管理
  - 实现房间状态监听和跳转
  - _需求: REQ-007_

---

## 阶段八：游戏内社交

- [x] 41. 实现表情和快捷消息（服务端）
  - 创建 `server/src/socket/chat.js`
  - 实现 `chat:emoji` 事件
  - 实现 `chat:quick` 事件
  - 实现发送频率限制（10秒内最多5条）
  - _需求: REQ-009_

- [x] 42. 实现表情和快捷消息（前端）
  - 创建聊天常量 `client/src/game/chatConstants.ts`
  - 创建表情气泡组件 `client/src/phaser/objects/EmojiBubble.ts`
  - 创建聊天面板 `client/src/phaser/ui/ChatPanel.ts`
  - 创建聊天按钮 `client/src/phaser/ui/ChatButton.ts`
  - 在 Phaser 场景中显示表情动画
  - 在 game store 中集成聊天事件
  - _需求: REQ-009_

---

## 阶段九：聊天应用集成

- [x] 43. 实现集成 API（游戏服务端）
  - 创建 `server/src/routes/integration.js`
  - 实现 `POST /api/integration/invite`（创建邀请）
  - 实现 `GET /api/integration/join`（加入邀请）
  - 实现 `POST /api/integration/verify-token`（验证聊天 token）
  - 实现 `POST /api/integration/login-from-chat`（从聊天登录）
  - 实现 API Key 认证中间件
  - _需求: REQ-010_

- [x] 44. 聊天应用添加集成接口
  - 在 chat-app 添加 `POST /api/integration/verify`
  - 在 chat-app 添加 `POST /api/integration/game-result`
  - 配置游戏服务 URL 环境变量
  - _需求: REQ-010, REQ-011_

- [x] 45. 实现游戏结果同步
  - 游戏结束后调用聊天服务接口
  - 发送游戏结果卡片消息到玩家私聊
  - 处理调用失败情况（不阻塞主流程）
  - _需求: REQ-011_

---

## 阶段十：断线重连

- [x] 46. 实现断线检测（服务端）
  - Socket 断开时保留座位 60 秒
  - Redis 存储重连 token（60秒过期）
  - 通知其他玩家断线状态和超时时间
  - _需求: REQ-012_

- [x] 47. 实现断线重连（服务端）
  - 实现 `game:reconnect` 事件
  - 实现 `game:check-pending` 检查未完成游戏
  - 取消断线超时定时器
  - 恢复游戏状态
  - 60 秒超时处理（断线方判负）
  - _需求: REQ-012_

- [x] 48. 实现断线重连（前端）
  - 检测未完成的游戏
  - 显示重连提示弹窗（倒计时）
  - 恢复游戏状态
  - 监听玩家上线/下线事件
  - _需求: REQ-012_

---

## 阶段十一：个人中心

- [x] 49. 前端个人中心页面
  - 更新 `client/src/pages/profile/index.vue`
  - 显示用户信息（头像、昵称、金币）
  - 显示战绩统计（总场/胜利/胜率/地主/农民）
  - 显示签到状态和签到功能
  - 显示交易记录（最近10条）
  - 实现修改昵称功能（弹窗编辑）
  - _需求: REQ-013_

---

## 阶段十二：测试与优化

- [ ] 50. 编写单元测试
  - 测试牌型判断函数
  - 测试牌型比较函数
  - 测试积分计算逻辑
  - _需求: 质量保证_

- [ ] 51. 集成测试
  - 测试完整游戏流程
  - 测试断线重连
  - 测试多人并发
  - _需求: 质量保证_

- [ ] 52. 性能优化
  - 优化 Phaser 渲染性能
  - 优化 Socket 消息频率
  - 优化数据库查询
  - _需求: NFR-001_

- [ ] 53. 安全审查
  - 检查 SQL 注入防护
  - 检查 XSS 防护
  - 检查游戏逻辑服务端验证
  - _需求: NFR-002_

---

## 阶段十三：部署

- [ ] 54. 生产环境配置
  - 配置生产环境变量
  - 配置 Nginx 反向代理
  - 配置 SSL 证书
  - _需求: 部署_

- [ ] 55. 部署上线
  - 构建前端生产版本
  - 部署后端服务
  - 配置域名解析
  - 测试生产环境
  - _需求: 部署_

---

## 优先级说明

| 优先级 | 阶段 | 说明 |
|--------|------|------|
| P0 | 一至七 | 核心功能，必须完成 |
| P1 | 八至十 | 重要功能，建议完成 |
| P2 | 十一至十三 | 增强功能，可后续迭代 |

---

## 进度总结

**已完成阶段：**
- 阶段一：项目初始化与基础架构 (5/5)
- 阶段二：用户系统 (5/6，跳过聊天集成登录)
- 阶段三：积分系统 (3/3)
- 阶段四：Socket.io 基础设施 (3/3)
- 阶段五：游戏大厅 (6/6)
- 阶段六：Phaser 3 游戏引擎集成 (8/8) ✅
- 阶段七：游戏核心逻辑 (9/9) ✅
- 阶段八：游戏内社交 (2/2) ✅
- 阶段九：聊天应用集成 (3/3) ✅
- 阶段十：断线重连 (3/3) ✅
- 阶段十一：个人中心 (1/1) ✅

**阶段七实现详情：**
- 前端 `client/src/game/` 模块：
  - `cardUtils.ts` - 洗牌（Fisher-Yates）、发牌、排序函数
  - `cardTypes.ts` - 牌型判断（单张/对子/三张/顺子/连对/飞机/炸弹/王炸等）
  - `cardCompare.ts` - 牌型比较、出牌提示
- 服务端 `server/src/game/` 模块：
  - `GameEngine.js` - 游戏状态机、发牌、叫地主、出牌、回合控制、结算
  - `CardValidator.js` - 牌型验证（与前端一致）
- Socket 事件完整实现：
  - `game:start` - 开始游戏、发牌
  - `game:bid_turn`/`game:bid` - 叫地主回合
  - `game:play_turn`/`game:play`/`game:pass` - 出牌回合
  - `game:ended` - 游戏结束、结算
  - 30秒超时自动处理
- 结算逻辑：
  - 倍数计算（叫分 × 炸弹 × 春天）
  - 金币结算、战绩更新
  - 游戏记录和交易记录入库

**测试记录（2026-01-18）：**
- 创建完整游戏流程测试脚本 `server/test-game.js`
- 测试通过项：
  - ✅ 3玩家登录和Socket连接
  - ✅ 房间创建和加入（修复并发竞态问题）
  - ✅ 玩家准备功能
  - ✅ 游戏开始和发牌（每人17张，底牌3张）
  - ✅ 叫地主流程（都不叫时重新发牌，叫3分成为地主）
  - ✅ 地主确定和底牌分发
  - ✅ 出牌阶段轮转

**阶段八实现详情：**
- 服务端 `server/src/socket/chat.js`：
  - 表情列表（8种表情：哈哈/生气/哭/思考/酷/惊讶/流汗/喜欢）
  - 快捷消息列表（8条预设消息）
  - 频率限制（10秒内最多5条，使用 Redis ZSET）
  - `chat:emoji` 事件 - 发送/广播表情
  - `chat:quick` 事件 - 发送/广播快捷消息
- 前端聊天组件：
  - `chatConstants.ts` - 表情和快捷消息定义
  - `EmojiBubble.ts` - 表情气泡显示（带动画）
  - `ChatPanel.ts` - 聊天面板（表情/快捷消息切换）
  - `ChatButton.ts` - 聊天按钮（右下角）
- GameScene 集成：
  - 在玩家头像旁显示表情气泡
  - 3秒自动消失（表情）/ 4秒自动消失（消息）
- game store 集成：
  - `sendEmoji()` / `sendQuickMessage()` 方法
  - 监听 `chat:emoji` / `chat:quick` 事件

**阶段九实现详情：**
- 游戏服务端 `server/src/routes/integration.js`：
  - `POST /api/integration/invite` - 创建游戏邀请（生成6位邀请码）
  - `GET /api/integration/join` - 加入邀请（验证邀请码并加入房间）
  - `POST /api/integration/verify-token` - 验证聊天 token
  - `POST /api/integration/login-from-chat` - 从聊天应用登录（自动创建/关联用户）
  - API Key 认证中间件
- 聊天服务端 `chat-app/server/src/routes/integration.js`：
  - `POST /api/integration/verify` - 验证用户 token
  - `POST /api/integration/game-result` - 接收游戏结果并发送消息
  - 游戏结果消息格式化（地主/农民/倍数/金币变化）
- 游戏结果同步 `server/src/socket/game.js`：
  - `syncGameResultToChat()` - 异步同步游戏结果
  - 收集玩家 chatUserId
  - 调用聊天服务 API（5秒超时，失败不阻塞主流程）
- 数据库迁移 `server/sql/migrate_chat_integration.sql`：
  - 添加 `chat_user_id` 字段到 users 表
  - 创建索引和唯一约束
- User 模型扩展：
  - `findByChatUserId()` - 根据聊天用户ID查找
  - `createFromChat()` - 从聊天应用创建用户
  - `syncFromChat()` - 同步聊天应用用户信息

**阶段十实现详情：**
- 服务端断线检测 `server/src/socket/index.js`：
  - 生成重连 token（crypto.randomBytes）
  - Redis 存储重连信息（`reconnect:{userId}`，60秒过期）
  - 60秒超时定时器（disconnectTimers Map）
  - `cancelDisconnectTimer()` 取消定时器
- 服务端断线处理 `server/src/socket/game.js`：
  - `game:reconnect` - 重连到游戏
  - `game:check-pending` - 检查未完成游戏
  - `handleDisconnectForceEnd()` - 断线判负处理
  - 断线方输掉全部积分（地主双倍、农民单倍）
- 前端断线重连 `client/src/store/game.ts`：
  - `checkPendingGame()` - 检查未完成游戏
  - `reconnectToGame()` - 执行重连
  - `pendingGameInfo` / `isReconnecting` 状态
  - 监听 `player:offline` / `player:online` 事件
- 前端重连提示 `client/src/pages/lobby/index.vue`：
  - 重连对话框（倒计时显示）
  - 自动检查未完成游戏
  - 监听 socket 连接状态

**阶段十一实现详情：**
- 个人中心页面 `client/src/pages/profile/index.vue`：
  - 用户信息卡片（头像、昵称、账号、金币）
  - 修改昵称功能（弹窗编辑）
  - 签到卡片（连续签到天数、签到按钮）
  - 战绩统计（总场/胜利/胜率/地主战绩/农民战绩）
  - 交易记录列表（最近10条）
- User Store 扩展：
  - `setUser()` - 设置用户信息

**下一步：**
- 阶段十二：测试与优化（任务 50-53）
- 阶段十三：部署（任务 54-55）
