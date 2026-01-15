/**
 * 群聊广播负载测试脚本
 * 测试群消息广播性能和延迟
 *
 * 用法: node broadcast-loadtest.js [群成员数] [持续时间秒]
 * 示例: node broadcast-loadtest.js 20 30
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MEMBERS_COUNT = parseInt(process.argv[2]) || 20;
const DURATION_SEC = parseInt(process.argv[3]) || 30;
const MESSAGE_INTERVAL_MS = 2000; // 每2秒发一条群消息

// 统计数据
const stats = {
  loginSuccess: 0,
  loginFailed: 0,
  connectionSuccess: 0,
  connectionFailed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  broadcastLatencies: [],
  errors: 0
};

// 消息追踪（用于计算广播延迟）
const messageTracker = new Map();

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
    const res = await axios.post(`${BASE_URL}/api/auth/login`, { account, password });
    if (res.data.code === 200) {
      stats.loginSuccess++;
      return res.data.data;
    }
  } catch (e) {}
  stats.loginFailed++;
  return null;
}

/**
 * 获取群组列表
 */
async function getGroups(token) {
  try {
    const res = await axios.get(`${BASE_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data.code === 200) {
      // 返回 K6 测试群
      return res.data.data.filter(g => g.name.startsWith('K6测试群'));
    }
  } catch (e) {}
  return [];
}

/**
 * 创建一个群成员虚拟用户
 */
async function createGroupMember(userIndex, targetGroup) {
  const user = users[userIndex % users.length];

  // 登录
  const loginData = await login(user.account, user.password);
  if (!loginData) return null;

  // 获取群组
  const groups = await getGroups(loginData.token);
  const group = groups.find(g => g.id === targetGroup.id);

  if (!group) {
    console.log(`[${user.account}] 不在目标群组中`);
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
      group,
      isSender: userIndex === 0, // 第一个用户负责发送
      messageInterval: null
    };

    socket.on('connect', () => {
      stats.connectionSuccess++;
      console.log(`[${user.account}] 连接成功 ${vuData.isSender ? '(发送者)' : '(接收者)'}`);
      resolve(vuData);
    });

    socket.on('connect_error', (err) => {
      stats.connectionFailed++;
      resolve(null);
    });

    // 监听群消息
    socket.on('new_message', (data) => {
      stats.messagesReceived++;

      // 解析广播延迟
      if (data.message && data.message.content) {
        const match = data.message.content.match(/@(\d+)$/);
        if (match) {
          const sendTime = parseInt(match[1]);
          const latency = Date.now() - sendTime;
          stats.broadcastLatencies.push(latency);
        }
      }
    });

    setTimeout(() => {
      if (!socket.connected) {
        stats.connectionFailed++;
        resolve(null);
      }
    }, 5000);
  });
}

/**
 * 发送群消息
 */
function sendGroupMessage(vuData) {
  const timestamp = Date.now();

  vuData.socket.emit('send_message', {
    conversationId: vuData.group.conversation_id,
    type: 'text',
    content: `群广播测试 [${vuData.account}] @${timestamp}`
  }, (response) => {
    if (response && response.success) {
      stats.messagesSent++;
    } else {
      stats.errors++;
    }
  });
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
function printReport(groupName, memberCount) {
  console.log('\n========================================');
  console.log('群聊广播负载测试报告');
  console.log('========================================');
  console.log(`\n配置:`);
  console.log(`  测试群: ${groupName}`);
  console.log(`  群成员数: ${memberCount}`);
  console.log(`  持续时间: ${DURATION_SEC}s`);
  console.log(`  目标服务器: ${BASE_URL}`);

  console.log(`\n登录:`);
  console.log(`  成功: ${stats.loginSuccess}`);
  console.log(`  失败: ${stats.loginFailed}`);

  console.log(`\n连接:`);
  console.log(`  成功: ${stats.connectionSuccess}`);
  console.log(`  失败: ${stats.connectionFailed}`);

  console.log(`\n广播消息:`);
  console.log(`  发送: ${stats.messagesSent}`);
  console.log(`  接收: ${stats.messagesReceived}`);
  console.log(`  预期接收: ${stats.messagesSent * (stats.connectionSuccess - 1)}`);
  console.log(`  错误: ${stats.errors}`);

  if (stats.broadcastLatencies.length > 0) {
    const avg = stats.broadcastLatencies.reduce((a, b) => a + b, 0) / stats.broadcastLatencies.length;
    console.log(`\n广播延迟 (ms):`);
    console.log(`  平均: ${avg.toFixed(2)}`);
    console.log(`  最小: ${Math.min(...stats.broadcastLatencies)}`);
    console.log(`  最大: ${Math.max(...stats.broadcastLatencies)}`);
    console.log(`  p90: ${percentile(stats.broadcastLatencies, 90)}`);
    console.log(`  p95: ${percentile(stats.broadcastLatencies, 95)}`);
  }

  // 计算广播效率
  if (stats.messagesSent > 0 && stats.connectionSuccess > 1) {
    const expectedReceives = stats.messagesSent * (stats.connectionSuccess - 1);
    const efficiency = (stats.messagesReceived / expectedReceives * 100).toFixed(2);
    console.log(`\n广播效率: ${efficiency}%`);
  }

  console.log('\n========================================');
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('群聊广播负载测试');
  console.log('========================================');
  console.log(`群成员数: ${MEMBERS_COUNT}`);
  console.log(`持续时间: ${DURATION_SEC}s`);
  console.log(`目标: ${BASE_URL}`);
  console.log('----------------------------------------');

  // 先登录获取测试群信息
  console.log('\n获取测试群信息...');
  const firstLogin = await login(users[0].account, users[0].password);
  if (!firstLogin) {
    console.error('无法登录第一个用户');
    process.exit(1);
  }

  const groups = await getGroups(firstLogin.token);
  if (groups.length === 0) {
    console.error('没有找到 K6 测试群，请先运行 setup 脚本创建测试数据');
    process.exit(1);
  }

  const targetGroup = groups[0];
  console.log(`使用测试群: ${targetGroup.name} (ID: ${targetGroup.id}, 会话: ${targetGroup.conversation_id})`);

  // 创建群成员连接
  console.log(`\n创建 ${MEMBERS_COUNT} 个群成员连接...`);
  const vuPromises = [];
  for (let i = 0; i < MEMBERS_COUNT; i++) {
    vuPromises.push(createGroupMember(i, targetGroup));
    await new Promise(r => setTimeout(r, 100));
  }

  const virtualUsers = (await Promise.all(vuPromises)).filter(Boolean);
  console.log(`\n活跃成员: ${virtualUsers.length}/${MEMBERS_COUNT}`);

  if (virtualUsers.length < 2) {
    console.error('群成员不足，无法测试广播');
    process.exit(1);
  }

  // 找到发送者
  const sender = virtualUsers.find(vu => vu.isSender);
  if (!sender) {
    console.error('没有发送者');
    process.exit(1);
  }

  // 开始发送群消息
  console.log('\n开始广播测试...');
  console.log(`发送者: ${sender.account}`);
  console.log(`接收者: ${virtualUsers.length - 1} 人`);

  const startTime = Date.now();

  sender.messageInterval = setInterval(() => {
    if (Date.now() - startTime < DURATION_SEC * 1000) {
      sendGroupMessage(sender);
    }
  }, MESSAGE_INTERVAL_MS);

  // 等待测试完成
  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

  // 停止发送
  console.log('\n停止测试...');
  if (sender.messageInterval) {
    clearInterval(sender.messageInterval);
  }

  // 等待最后的广播消息
  await new Promise(r => setTimeout(r, 3000));

  // 断开所有连接
  for (const vu of virtualUsers) {
    vu.socket.disconnect();
  }

  // 打印报告
  printReport(targetGroup.name, virtualUsers.length);
}

main().catch(console.error);
