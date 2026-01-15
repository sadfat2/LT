/**
 * Artillery 简单处理器
 */

const http = require('http');

// 用户计数器
let userCounter = 0;

/**
 * beforeScenario hook - 在场景开始前登录并设置连接参数
 */
function beforeConnect(context, ee, next) {
  const userIndex = (userCounter++ % 100) + 1;
  const account = `testuser${userIndex}`;

  console.log(`[${account}] 开始登录...`);

  const postData = JSON.stringify({
    account: account,
    password: 'password123'
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

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.code === 200 && result.data) {
          context.vars.token = result.data.token;
          context.vars.userId = result.data.user.id;
          context.vars.account = account;

          // 关键：设置 Socket.IO 连接查询参数
          context.socketioOpts = {
            query: { token: result.data.token },
            transports: ['websocket']
          };

          console.log(`[${account}] 登录成功, userId: ${result.data.user.id}`);

          // 获取好友
          getFriends(context, () => {
            next();
          });
        } else {
          console.error(`[${account}] 登录失败: ${result.message}`);
          next(new Error('Login failed'));
        }
      } catch (e) {
        console.error(`[${account}] 错误: ${e.message}`);
        next(e);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`请求失败: ${e.message}`);
    next(e);
  });

  req.write(postData);
  req.end();
}

/**
 * 获取好友
 */
function getFriends(context, callback) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/friends',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${context.vars.token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.code === 200 && result.data?.length > 0) {
          const friend = result.data[Math.floor(Math.random() * result.data.length)];
          context.vars.friendId = friend.id;
          console.log(`[${context.vars.account}] 选择好友 ID: ${friend.id}`);
        } else {
          context.vars.friendId = 1;
        }
      } catch (e) {
        context.vars.friendId = 1;
      }
      callback();
    });
  });

  req.on('error', () => {
    context.vars.friendId = 1;
    callback();
  });

  req.end();
}

module.exports = { beforeConnect };
