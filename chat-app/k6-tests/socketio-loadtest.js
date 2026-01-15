/**
 * Socket.IO 负载测试脚本
 * 使用 Node.js + socket.io-client 进行真实 Socket.IO 连接和消息测试
 *
 * 用法: node socketio-loadtest.js [并发数] [持续时间秒]
 * 示例: node socketio-loadtest.js 10 30
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_USERS = parseInt(process.argv[2]) || 10;
const DURATION_SEC = parseInt(process.argv[3]) || 30;
const MESSAGE_INTERVAL_MS = 1000;

// 统计数据
const stats = {
  loginSuccess: 0,
  loginFailed: 0,
  connectionSuccess: 0,
  connectionFailed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  messagesAcked: 0,
  errors: 0,
  latencies: []
};

// 测试用户
const users = Array.from({ length: 100 }, (_, i) => ({
  account: `testuser${i + 1}`,
  password: 'password123'
}));

/**
 * 登录获取 token
 */
async function login(account, password) {
  try {
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      account,
      password
    });
    if (res.data.code === 200) {
      stats.loginSuccess++;
      return res.data.data;
    }
  } catch (e) {
    // 静默处理
  }
  stats.loginFailed++;
  return null;
}

/**
 * 获取好友列表
 */
async function getFriends(token) {
  try {
    const res = await axios.get(`${BASE_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data.code === 200 && res.data.data) {
      // API 返回格式是 { list: [...], grouped: {...} }
      return res.data.data.list || res.data.data || [];
    }
  } catch (e) {
    // 静默处理
  }
  return [];
}

/**
 * 创建一个虚拟用户
 */
async function createVirtualUser(userIndex) {
  const user = users[userIndex % users.length];

  // 登录
  const loginData = await login(user.account, user.password);
  if (!loginData) {
    return null;
  }

  // 获取好友
  const friends = await getFriends(loginData.token);
  if (friends.length === 0) {
    console.log(`[${user.account}] 没有好友，跳过`);
    return null;
  }

  // 建立 Socket.IO 连接
  return new Promise((resolve) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      query: { token: loginData.token }
    });

    const vuData = {
      socket,
      account: user.account,
      userId: loginData.user.id,
      friends,
      messageInterval: null
    };

    socket.on('connect', () => {
      stats.connectionSuccess++;
      console.log(`[${user.account}] 连接成功`);
      resolve(vuData);
    });

    socket.on('connect_error', (err) => {
      stats.connectionFailed++;
      console.error(`[${user.account}] 连接失败: ${err.message}`);
      resolve(null);
    });

    socket.on('new_message', (data) => {
      stats.messagesReceived++;
    });

    socket.on('disconnect', () => {
      if (vuData.messageInterval) {
        clearInterval(vuData.messageInterval);
      }
    });

    // 超时处理
    setTimeout(() => {
      if (!socket.connected) {
        stats.connectionFailed++;
        resolve(null);
      }
    }, 5000);
  });
}

/**
 * 发送消息
 */
function sendMessage(vuData) {
  if (!vuData.friends || vuData.friends.length === 0) {
    stats.errors++;
    return;
  }

  const friend = vuData.friends[Math.floor(Math.random() * vuData.friends.length)];
  if (!friend || !friend.id) {
    stats.errors++;
    return;
  }

  const startTime = Date.now();

  vuData.socket.emit('send_message', {
    receiverId: friend.id,
    type: 'text',
    content: `测试消息 [${vuData.account}] ${Date.now()}`
  }, (response) => {
    const latency = Date.now() - startTime;
    stats.latencies.push(latency);

    if (response && response.success) {
      stats.messagesAcked++;
    } else {
      stats.errors++;
    }
  });

  stats.messagesSent++;
}

/**
 * 计算百分位数
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * 打印统计报告
 */
function printReport() {
  console.log('\n========================================');
  console.log('Socket.IO 负载测试报告');
  console.log('========================================');
  console.log(`\n配置:`);
  console.log(`  并发用户: ${CONCURRENT_USERS}`);
  console.log(`  持续时间: ${DURATION_SEC}s`);
  console.log(`  目标服务器: ${BASE_URL}`);

  console.log(`\n登录:`);
  console.log(`  成功: ${stats.loginSuccess}`);
  console.log(`  失败: ${stats.loginFailed}`);

  console.log(`\n连接:`);
  console.log(`  成功: ${stats.connectionSuccess}`);
  console.log(`  失败: ${stats.connectionFailed}`);

  console.log(`\n消息:`);
  console.log(`  发送: ${stats.messagesSent}`);
  console.log(`  确认: ${stats.messagesAcked}`);
  console.log(`  接收: ${stats.messagesReceived}`);
  console.log(`  错误: ${stats.errors}`);

  if (stats.latencies.length > 0) {
    const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
    console.log(`\n延迟 (ms):`);
    console.log(`  平均: ${avg.toFixed(2)}`);
    console.log(`  最小: ${Math.min(...stats.latencies)}`);
    console.log(`  最大: ${Math.max(...stats.latencies)}`);
    console.log(`  p90: ${percentile(stats.latencies, 90)}`);
    console.log(`  p95: ${percentile(stats.latencies, 95)}`);
  }

  console.log('\n========================================');
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('Socket.IO 负载测试');
  console.log('========================================');
  console.log(`并发用户: ${CONCURRENT_USERS}`);
  console.log(`持续时间: ${DURATION_SEC}s`);
  console.log(`目标: ${BASE_URL}`);
  console.log('----------------------------------------');

  // 创建虚拟用户
  console.log('\n创建虚拟用户...');
  const vuPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    vuPromises.push(createVirtualUser(i));
    // 错开连接时间
    await new Promise(r => setTimeout(r, 100));
  }

  const virtualUsers = (await Promise.all(vuPromises)).filter(Boolean);
  console.log(`\n活跃用户: ${virtualUsers.length}/${CONCURRENT_USERS}`);

  if (virtualUsers.length === 0) {
    console.error('没有用户连接成功，退出');
    process.exit(1);
  }

  // 开始发送消息
  console.log('\n开始发送消息...');
  const startTime = Date.now();

  for (const vu of virtualUsers) {
    vu.messageInterval = setInterval(() => {
      if (Date.now() - startTime < DURATION_SEC * 1000) {
        sendMessage(vu);
      }
    }, MESSAGE_INTERVAL_MS);
  }

  // 等待测试完成
  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

  // 停止发送
  console.log('\n停止测试...');
  for (const vu of virtualUsers) {
    if (vu.messageInterval) {
      clearInterval(vu.messageInterval);
    }
  }

  // 等待最后的响应
  await new Promise(r => setTimeout(r, 2000));

  // 断开连接
  for (const vu of virtualUsers) {
    vu.socket.disconnect();
  }

  // 打印报告
  printReport();
}

main().catch(console.error);
