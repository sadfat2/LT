/**
 * 语音通话信令处理模块
 * 基于 WebRTC P2P 架构，Socket.io 仅用于信令交换
 *
 * 通话状态使用 Redis 存储，支持多进程/多实例部署
 */

const redisClient = require('../config/redis');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Redis key 前缀
const CALL_PREFIX = 'call:';
const USER_CALL_PREFIX = 'user_call:';
const CALL_TTL = 120; // 通话记录过期时间（秒）

// 生成唯一通话ID
const generateCallId = (userId1, userId2) => {
  const sorted = [userId1, userId2].sort((a, b) => a - b);
  return `call_${sorted[0]}_${sorted[1]}_${Date.now()}`;
};

// 获取通话记录
const getCall = async (callId) => {
  try {
    const key = `${CALL_PREFIX}${callId}`;
    const data = await redisClient.get(key);
    console.log(`[Call] Redis GET ${key}:`, data ? '找到' : '未找到');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Call] Redis 获取通话记录失败:', error);
    return null;
  }
};

// 保存通话记录
const setCall = async (callId, callData) => {
  try {
    const key = `${CALL_PREFIX}${callId}`;
    console.log(`[Call] Redis SET ${key}:`, JSON.stringify(callData));
    await redisClient.set(key, JSON.stringify(callData), { EX: CALL_TTL });
    // 同时记录用户的当前通话ID
    await redisClient.set(`${USER_CALL_PREFIX}${callData.callerId}`, callId, { EX: CALL_TTL });
    await redisClient.set(`${USER_CALL_PREFIX}${callData.receiverId}`, callId, { EX: CALL_TTL });
    console.log(`[Call] Redis 保存成功: ${callId}`);
    return true;
  } catch (error) {
    console.error('[Call] Redis 保存通话记录失败:', error);
    return false;
  }
};

// 更新通话记录
const updateCall = async (callId, updates) => {
  try {
    const call = await getCall(callId);
    if (!call) return null;

    const updatedCall = { ...call, ...updates };
    await redisClient.set(
      `${CALL_PREFIX}${callId}`,
      JSON.stringify(updatedCall),
      { EX: CALL_TTL }
    );
    return updatedCall;
  } catch (error) {
    console.error('[Call] Redis 更新通话记录失败:', error);
    return null;
  }
};

// 删除通话记录
const deleteCall = async (callId) => {
  try {
    const call = await getCall(callId);
    if (call) {
      await redisClient.del(`${USER_CALL_PREFIX}${call.callerId}`);
      await redisClient.del(`${USER_CALL_PREFIX}${call.receiverId}`);
    }
    await redisClient.del(`${CALL_PREFIX}${callId}`);
    return true;
  } catch (error) {
    console.error('[Call] Redis 删除通话记录失败:', error);
    return false;
  }
};

// 检查用户是否在通话中
const isUserInCall = async (userId) => {
  try {
    const callId = await redisClient.get(`${USER_CALL_PREFIX}${userId}`);
    if (!callId) return { inCall: false };

    const call = await getCall(callId);
    if (!call) {
      // 清理孤立的用户通话记录
      await redisClient.del(`${USER_CALL_PREFIX}${userId}`);
      return { inCall: false };
    }

    if (['calling', 'ringing', 'connected'].includes(call.status)) {
      return { inCall: true, callId, call };
    }

    return { inCall: false };
  } catch (error) {
    console.error('[Call] Redis 检查用户通话状态失败:', error);
    return { inCall: false };
  }
};

/**
 * 创建通话记录消息
 * @param {number} callerId - 呼叫者ID
 * @param {number} receiverId - 接收者ID
 * @param {string} status - 通话状态: 'completed' | 'rejected' | 'cancelled' | 'missed'
 * @param {number} duration - 通话时长（秒）
 * @param {Object} io - Socket.io 实例
 */
const createCallMessage = async (callerId, receiverId, status, duration, io) => {
  try {
    // 获取或创建会话
    const conversation = await Conversation.getOrCreatePrivate(callerId, receiverId);
    const convId = conversation.id;

    // 生成通话记录内容
    let content = '';
    switch (status) {
      case 'completed':
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
        content = `语音通话 ${durationStr}`;
        break;
      case 'rejected':
        content = '对方已拒绝';
        break;
      case 'cancelled':
        content = '已取消';
        break;
      case 'missed':
        content = '未接听';
        break;
      default:
        content = '语音通话';
    }

    // 创建系统消息
    const messageId = await Message.create(
      convId,
      callerId,  // 发送者是呼叫者
      'system',  // 使用系统消息类型
      content,
      null,      // mediaUrl
      duration,  // duration 字段记录通话时长
      null,      // fileName
      null,      // fileSize
      null       // thumbnailUrl
    );

    // 更新会话时间
    await Conversation.updateTime(convId);

    // 获取完整消息
    const message = await Message.findById(messageId);

    // 通知双方
    io.to(`user_${callerId}`).emit('new_message', {
      conversationId: convId,
      message
    });
    io.to(`user_${receiverId}`).emit('new_message', {
      conversationId: convId,
      message
    });

    return message;
  } catch (error) {
    console.error('创建通话记录消息失败:', error);
    return null;
  }
};

/**
 * 初始化通话事件处理
 * @param {Socket} socket - Socket.io socket 实例
 * @param {Server} io - Socket.io server 实例
 */
const initCallHandlers = (socket, io) => {
  const userId = socket.userId;

  /**
   * 发起通话请求
   * data: { targetUserId: number }
   */
  socket.on('call:request', async (data, callback) => {
    try {
      const { targetUserId } = data;

      // 验证目标用户
      if (!targetUserId || targetUserId === userId) {
        return callback?.({ success: false, error: '无效的目标用户' });
      }

      // 检查自己是否在通话中
      const selfCallStatus = await isUserInCall(userId);
      if (selfCallStatus.inCall) {
        return callback?.({ success: false, error: '您正在通话中' });
      }

      // 检查对方是否在通话中
      const targetCallStatus = await isUserInCall(targetUserId);
      if (targetCallStatus.inCall) {
        return callback?.({ success: false, error: '对方正在通话中', code: 'BUSY' });
      }

      // 检查对方是否在线
      const targetOnline = await redisClient.get(`online:${targetUserId}`);
      if (!targetOnline) {
        return callback?.({ success: false, error: '对方不在线', code: 'OFFLINE' });
      }

      // 获取呼叫者信息
      const caller = await User.findById(userId);
      if (!caller) {
        return callback?.({ success: false, error: '用户信息获取失败' });
      }

      // 创建通话记录（存储到 Redis）
      const callId = generateCallId(userId, targetUserId);
      await setCall(callId, {
        callerId: userId,
        receiverId: targetUserId,
        status: 'calling',
        startTime: Date.now()
      });

      // 通知对方有来电
      io.to(`user_${targetUserId}`).emit('call:incoming', {
        callId,
        callerId: userId,
        callerInfo: {
          id: caller.id,
          nickname: caller.nickname,
          avatar: caller.avatar
        }
      });

      // 设置呼叫超时（30秒无响应自动取消）
      setTimeout(async () => {
        const call = await getCall(callId);
        if (call && call.status === 'calling') {
          await deleteCall(callId);
          // 通知双方呼叫超时
          io.to(`user_${userId}`).emit('call:timeout', { callId });
          io.to(`user_${targetUserId}`).emit('call:timeout', { callId });
          // 创建未接听通话记录消息
          await createCallMessage(userId, targetUserId, 'missed', 0, io);
        }
      }, 30000);

      callback?.({ success: true, callId });

    } catch (error) {
      console.error('发起通话错误:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * 接受通话
   * data: { callId: string }
   */
  socket.on('call:accept', async (data, callback) => {
    try {
      const { callId } = data;
      console.log(`[Call] 用户 ${userId} 尝试接听通话 ${callId}`);

      const call = await getCall(callId);
      if (!call) {
        console.log(`[Call] 通话 ${callId} 不存在`);
        return callback?.({ success: false, error: '通话不存在或已结束' });
      }

      if (call.receiverId !== userId) {
        return callback?.({ success: false, error: '无权操作此通话' });
      }

      if (call.status !== 'calling') {
        return callback?.({ success: false, error: '通话状态无效' });
      }

      // 获取接听者信息
      const receiver = await User.findById(userId);

      // 更新通话状态（存储到 Redis）
      await updateCall(callId, {
        status: 'connected',
        connectedTime: Date.now()
      });

      // 通知呼叫者对方已接听
      io.to(`user_${call.callerId}`).emit('call:accepted', {
        callId,
        receiverInfo: {
          id: receiver.id,
          nickname: receiver.nickname,
          avatar: receiver.avatar
        }
      });

      console.log(`[Call] 通话 ${callId} 已接通`);
      callback?.({ success: true });

    } catch (error) {
      console.error('接受通话错误:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * 拒绝通话
   * data: { callId: string, reason?: string }
   */
  socket.on('call:reject', async (data, callback) => {
    try {
      const { callId, reason } = data;

      const call = await getCall(callId);
      if (!call) {
        return callback?.({ success: false, error: '通话不存在' });
      }

      if (call.receiverId !== userId) {
        return callback?.({ success: false, error: '无权操作此通话' });
      }

      // 删除通话记录（从 Redis）
      await deleteCall(callId);

      // 通知呼叫者被拒绝
      io.to(`user_${call.callerId}`).emit('call:rejected', {
        callId,
        reason: reason || 'declined'
      });

      // 创建通话记录消息
      await createCallMessage(call.callerId, call.receiverId, 'rejected', 0, io);

      callback?.({ success: true });

    } catch (error) {
      console.error('拒绝通话错误:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * 结束通话
   * data: { callId: string }
   */
  socket.on('call:end', async (data, callback) => {
    try {
      const { callId } = data;

      const call = await getCall(callId);
      if (!call) {
        return callback?.({ success: false, error: '通话不存在' });
      }

      // 验证是通话参与者
      if (call.callerId !== userId && call.receiverId !== userId) {
        return callback?.({ success: false, error: '无权操作此通话' });
      }

      // 计算通话时长
      const duration = call.connectedTime
        ? Math.floor((Date.now() - call.connectedTime) / 1000)
        : 0;

      // 删除通话记录（从 Redis）
      await deleteCall(callId);

      // 通知对方通话结束
      const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
      io.to(`user_${otherUserId}`).emit('call:ended', {
        callId,
        duration,
        endedBy: userId
      });

      // 创建通话记录消息（只有接通过的通话才记录时长）
      if (duration > 0) {
        await createCallMessage(call.callerId, call.receiverId, 'completed', duration, io);
      }

      callback?.({ success: true, duration });

    } catch (error) {
      console.error('结束通话错误:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  /**
   * 取消呼叫（呼叫者在对方接听前取消）
   * data: { callId: string }
   */
  socket.on('call:cancel', async (data, callback) => {
    try {
      const { callId } = data;

      const call = await getCall(callId);
      if (!call) {
        return callback?.({ success: false, error: '通话不存在' });
      }

      if (call.callerId !== userId) {
        return callback?.({ success: false, error: '只有呼叫者可以取消' });
      }

      if (call.status !== 'calling') {
        return callback?.({ success: false, error: '通话已接通，请使用挂断' });
      }

      // 删除通话记录（从 Redis）
      await deleteCall(callId);

      // 通知接收者呼叫已取消
      io.to(`user_${call.receiverId}`).emit('call:cancelled', { callId });

      // 创建通话记录消息
      await createCallMessage(call.callerId, call.receiverId, 'cancelled', 0, io);

      callback?.({ success: true });

    } catch (error) {
      console.error('取消呼叫错误:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  // ==================== WebRTC 信令转发 ====================

  /**
   * 转发 WebRTC Offer
   * data: { callId: string, sdp: RTCSessionDescription }
   */
  socket.on('webrtc:offer', async (data) => {
    const { callId, sdp } = data;
    const call = await getCall(callId);

    if (call && call.callerId === userId) {
      io.to(`user_${call.receiverId}`).emit('webrtc:offer', {
        callId,
        sdp,
        from: userId
      });
    }
  });

  /**
   * 转发 WebRTC Answer
   * data: { callId: string, sdp: RTCSessionDescription }
   */
  socket.on('webrtc:answer', async (data) => {
    const { callId, sdp } = data;
    const call = await getCall(callId);

    if (call && call.receiverId === userId) {
      io.to(`user_${call.callerId}`).emit('webrtc:answer', {
        callId,
        sdp,
        from: userId
      });
    }
  });

  /**
   * 转发 ICE Candidate
   * data: { callId: string, candidate: RTCIceCandidate }
   */
  socket.on('webrtc:ice', async (data) => {
    const { callId, candidate } = data;
    const call = await getCall(callId);

    if (call) {
      const targetId = call.callerId === userId ? call.receiverId : call.callerId;
      io.to(`user_${targetId}`).emit('webrtc:ice', {
        callId,
        candidate,
        from: userId
      });
    }
  });

  // ==================== 断开连接处理 ====================

  socket.on('disconnect', async () => {
    // 检查用户是否在通话中
    const callStatus = await isUserInCall(userId);
    if (callStatus.inCall) {
      const { callId, call } = callStatus;

      // 计算通话时长
      const duration = call.connectedTime
        ? Math.floor((Date.now() - call.connectedTime) / 1000)
        : 0;

      // 删除通话记录（从 Redis）
      await deleteCall(callId);

      // 通知对方通话结束
      const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
      io.to(`user_${otherUserId}`).emit('call:ended', {
        callId,
        duration,
        endedBy: userId,
        reason: 'disconnected'
      });
    }
  });
};

module.exports = { initCallHandlers };
