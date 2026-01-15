/**
 * Artillery 自定义处理器
 * 用于登录获取 token 和准备测试数据
 */

const http = require('http');

// 测试用户配置
const USERS = Array.from({ length: 100 }, (_, i) => ({
  account: `testuser${i + 1}`,
  password: 'password123'
}));

// 用户索引计数器
let userCounter = 0;

/**
 * 登录函数 - 在 Socket.IO 连接前调用
 */
async function login(context, events, done) {
  // 轮询选择用户
  const userIndex = userCounter++ % USERS.length;
  const user = USERS[userIndex];

  const postData = JSON.stringify({
    account: user.account,
    password: user.password
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 200 && result.data) {
            // 保存 token 和用户信息到 context
            context.vars.token = result.data.token;
            context.vars.userId = result.data.user.id;
            context.vars.account = user.account;

            // 设置 Socket.IO 连接选项
            context.socketio = {
              query: {
                token: result.data.token
              }
            };

            console.log(`[${user.account}] 登录成功, userId: ${result.data.user.id}`);
            events.emit('counter', 'login.success', 1);
          } else {
            console.error(`[${user.account}] 登录失败:`, result.message);
            events.emit('counter', 'login.failed', 1);
          }
        } catch (e) {
          console.error(`[${user.account}] 解析响应失败:`, e.message);
          events.emit('counter', 'login.error', 1);
        }
        done();
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`[${user.account}] 请求失败:`, e.message);
      events.emit('counter', 'login.error', 1);
      done();
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 获取好友列表
 */
async function getFriends(context, events, done) {
  if (!context.vars.token) {
    console.error('No token available');
    done();
    return;
  }

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/friends',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${context.vars.token}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 200 && result.data && result.data.length > 0) {
            // 随机选择一个好友
            const friend = result.data[Math.floor(Math.random() * result.data.length)];
            context.vars.friendId = friend.id;
            console.log(`[${context.vars.account}] 获取好友成功, 选择好友 ID: ${friend.id}`);
          } else {
            console.warn(`[${context.vars.account}] 没有好友`);
            // 使用默认好友 ID
            context.vars.friendId = 1;
          }
        } catch (e) {
          console.error('解析好友列表失败:', e.message);
          context.vars.friendId = 1;
        }
        done();
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('获取好友请求失败:', e.message);
      context.vars.friendId = 1;
      done();
      reject(e);
    });

    req.end();
  });
}

/**
 * 处理连接成功
 */
function onConnected(context, events, done) {
  console.log(`[${context.vars.account}] Socket.IO 连接成功`);
  events.emit('counter', 'socketio.connected', 1);
  done();
}

/**
 * 处理消息发送成功
 */
function onMessageSent(context, events, done) {
  events.emit('counter', 'message.sent', 1);
  done();
}

module.exports = {
  login,
  getFriends,
  onConnected,
  onMessageSent
};
