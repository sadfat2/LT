const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const config = require('../config');
const redisClient = require('../config/redis');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Group = require('../models/Group');
const { initCallHandlers } = require('./call');

let io;

const initSocket = (server) => {
  // 生产环境 CORS 配置
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['*'];

  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // 心跳优化（适合跨境网络）
    pingTimeout: 60000,      // 60秒无响应断开
    pingInterval: 25000,     // 25秒发送一次心跳
    // 传输优化
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    // 消息压缩（减少跨境传输数据量）
    perMessageDeflate: {
      threshold: 1024,  // 超过 1KB 才压缩
      zlibDeflateOptions: {
        chunkSize: 16 * 1024
      }
    },
    // 连接超时
    connectTimeout: 45000
  });

  // PM2 多进程模式下使用 Redis adapter
  // 允许不同进程间共享 Socket.io 状态
  const pubClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port
    }
  });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter 已启用（支持多进程）');
    })
    .catch(err => {
      console.error('Redis adapter 连接失败:', err);
    });

  // 认证中间件
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('未提供认证令牌'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);

      // 检查用户是否被封停
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('用户不存在'));
      }
      if (user.status === 'banned') {
        return next(new Error('账号已被封停'));
      }

      socket.userId = decoded.id;
      socket.userAccount = decoded.account;
      next();
    } catch (error) {
      next(new Error('认证失败'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`用户 ${userId} 已连接`);

    // 加入用户专属房间
    socket.join(`user_${userId}`);

    // 加入所有群聊房间（房间广播优化）
    try {
      const groups = await Group.getUserGroups(userId);
      for (const group of groups) {
        socket.join(`group_${group.id}`);
      }
      if (groups.length > 0) {
        console.log(`用户 ${userId} 加入 ${groups.length} 个群房间`);
      }
    } catch (error) {
      console.error('加入群房间失败:', error);
    }

    // 存储在线状态到 Redis
    await redisClient.set(`online:${userId}`, socket.id);

    // 通知好友上线
    socket.broadcast.emit('user_online', { userId });

    // 初始化语音通话处理
    initCallHandlers(socket, io);

    // 发送消息
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, receiverId, type, content, mediaUrl, duration, fileName, fileSize, thumbnailUrl } = data;

        let convId = conversationId;

        // 如果没有会话ID，创建私聊会话
        if (!convId && receiverId) {
          const result = await Conversation.getOrCreatePrivate(userId, receiverId);
          convId = result.id;
        }

        // 创建消息
        const messageId = await Message.create(
          convId,
          userId,
          type || 'text',
          content,
          mediaUrl,
          duration,
          fileName,
          fileSize,
          thumbnailUrl
        );

        // 更新会话时间
        await Conversation.updateTime(convId);

        // 获取完整消息
        const message = await Message.findById(messageId);

        // 检查是否是群聊
        const group = await Group.findByConversationId(convId);

        if (group) {
          // 群聊消息：使用房间广播（O(1) 复杂度，性能优化）
          // socket.to() 会广播给房间内所有人（除了发送者自己）
          const roomName = `group_${group.id}`;
          socket.to(roomName).emit('new_message', {
            conversationId: convId,
            message
          });
          console.log(`[群消息] 用户 ${userId} 发送到房间 ${roomName}`);
        } else {
          // 私聊消息
          let targetId = receiverId;
          if (!targetId) {
            // 直接从数据库获取对方ID（更高效、更可靠）
            targetId = await Conversation.getOtherParticipant(convId, userId);
          }

          // 发送给接收者
          if (targetId) {
            io.to(`user_${targetId}`).emit('new_message', {
              conversationId: convId,
              message
            });
            console.log(`[私聊消息] 用户 ${userId} -> 用户 ${targetId}, 会话 ${convId}`);
          } else {
            console.warn(`[私聊消息] 找不到接收者，会话ID: ${convId}`);
          }
        }

        // 回调确认
        if (callback) {
          callback({ success: true, message, conversationId: convId });
        }
      } catch (error) {
        console.error('发送消息错误:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    // 消息已读
    socket.on('message_read', async (data) => {
      try {
        const { conversationId, messageId } = data;

        // 更新已读状态
        await Message.markAsRead(conversationId, userId);
        await Conversation.updateLastRead(conversationId, userId);

        // 获取消息发送者
        const message = await Message.findById(messageId);
        if (message && message.sender_id !== userId) {
          // 通知发送者消息已读
          io.to(`user_${message.sender_id}`).emit('message_read_ack', {
            conversationId,
            messageId,
            readBy: userId
          });
        }
      } catch (error) {
        console.error('已读状态更新错误:', error);
      }
    });

    // 撤回消息
    socket.on('revoke_message', async (data, callback) => {
      try {
        const { messageId, conversationId } = data;

        const success = await Message.revoke(messageId, userId);

        if (!success) {
          if (callback) {
            callback({ success: false, error: '无法撤回消息（超过2分钟或不是您的消息）' });
          }
          return;
        }

        // 获取会话中的其他用户
        const conversations = await Conversation.getUserConversations(userId);
        const conv = conversations.find(c => c.id === conversationId);

        if (conv && conv.other_user) {
          io.to(`user_${conv.other_user.id}`).emit('message_revoked', {
            conversationId,
            messageId
          });
        }

        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        console.error('撤回消息错误:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    // 正在输入
    socket.on('typing', (data) => {
      const { conversationId, receiverId } = data;
      io.to(`user_${receiverId}`).emit('user_typing', {
        conversationId,
        userId
      });
    });

    // 断开连接
    socket.on('disconnect', async () => {
      console.log(`用户 ${userId} 已断开`);

      // 删除在线状态
      await redisClient.del(`online:${userId}`);

      // 通知好友下线
      socket.broadcast.emit('user_offline', { userId });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io 未初始化');
  }
  return io;
};

module.exports = { initSocket, getIO };
