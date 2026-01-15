/**
 * Artillery 自定义处理脚本
 *
 * 提供测试过程中的自定义逻辑：
 * 1. 动态生成测试数据
 * 2. 自定义断言验证
 * 3. 自定义指标收集
 */

const crypto = require('crypto');

/**
 * 生成唯一消息 ID
 */
function generateMessageId(requestParams, context, ee, next) {
  context.vars.messageId = crypto.randomUUID();
  context.vars.timestamp = Date.now();
  return next();
}

/**
 * 生成随机消息内容
 */
function generateRandomMessage(requestParams, context, ee, next) {
  const messages = [
    '你好，最近怎么样？',
    '今天天气不错！',
    '在吗？有事找你',
    '收到请回复',
    '晚上一起吃饭吗？',
    '刚看到一个有趣的新闻',
    '这个项目进展如何？',
    '周末有什么安排？',
    '好的，没问题！',
    '稍等，我确认一下',
  ];

  context.vars.randomMessage = messages[Math.floor(Math.random() * messages.length)];
  context.vars.timestamp = Date.now();
  return next();
}

/**
 * 记录请求开始时间
 */
function startTimer(requestParams, context, ee, next) {
  context.vars.startTime = Date.now();
  return next();
}

/**
 * 计算请求耗时并发送自定义指标
 */
function endTimer(requestParams, response, context, ee, next) {
  const duration = Date.now() - context.vars.startTime;

  // 发送自定义指标
  ee.emit('histogram', 'custom.response_time', duration);

  // 根据响应状态记录
  if (response && response.statusCode === 200) {
    ee.emit('counter', 'custom.success', 1);
  } else {
    ee.emit('counter', 'custom.error', 1);
  }

  return next();
}

/**
 * 验证登录响应
 */
function validateLoginResponse(requestParams, response, context, ee, next) {
  try {
    const body = JSON.parse(response.body);
    if (body.code === 200 && body.data && body.data.token) {
      ee.emit('counter', 'login.success', 1);
      context.vars.authToken = body.data.token;
      context.vars.userId = body.data.user.id;
    } else {
      ee.emit('counter', 'login.failed', 1);
    }
  } catch (e) {
    ee.emit('counter', 'login.parse_error', 1);
  }
  return next();
}

/**
 * 验证好友列表响应
 */
function validateFriendsResponse(requestParams, response, context, ee, next) {
  try {
    const body = JSON.parse(response.body);
    if (body.code === 200 && body.data) {
      const friends = body.data.list || body.data;
      ee.emit('histogram', 'friends.count', friends.length);

      // 随机选择一个好友用于后续测试
      if (friends.length > 0) {
        const randomFriend = friends[Math.floor(Math.random() * friends.length)];
        context.vars.selectedFriendId = randomFriend.id;
      }
    }
  } catch (e) {
    // 忽略解析错误
  }
  return next();
}

/**
 * Socket.IO 消息发送后回调
 */
function onMessageSent(context, ee, next) {
  ee.emit('counter', 'socketio.message_sent', 1);
  return next();
}

/**
 * 打印调试信息
 */
function logDebug(requestParams, context, ee, next) {
  console.log('[DEBUG] User:', context.vars.account);
  console.log('[DEBUG] Token:', context.vars.token ? 'present' : 'missing');
  console.log('[DEBUG] FriendId:', context.vars.friendId);
  return next();
}

/**
 * 设置请求头
 */
function setAuthHeader(requestParams, context, ee, next) {
  if (context.vars.token) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['Authorization'] = `Bearer ${context.vars.token}`;
  }
  return next();
}

/**
 * 处理 Socket.IO 连接成功
 */
function onSocketConnected(context, ee, next) {
  ee.emit('counter', 'socketio.connected', 1);
  return next();
}

/**
 * 处理 Socket.IO 连接失败
 */
function onSocketError(context, ee, next) {
  ee.emit('counter', 'socketio.error', 1);
  return next();
}

module.exports = {
  generateMessageId,
  generateRandomMessage,
  startTimer,
  endTimer,
  validateLoginResponse,
  validateFriendsResponse,
  onMessageSent,
  logDebug,
  setAuthHeader,
  onSocketConnected,
  onSocketError,
};
