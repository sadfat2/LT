/**
 * 长时间稳定性测试脚本
 * 持续运行并监控连接稳定性、消息延迟、断线重连等
 *
 * 用法: node stability-test.js [并发数] [持续时间分钟]
 * 示例: node stability-test.js 30 5
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_USERS = parseInt(process.argv[2]) || 30;
const DURATION_MIN = parseInt(process.argv[3]) || 5;
const MESSAGE_INTERVAL_MS = 2000;
const STATS_INTERVAL_MS = 10000; // 每10秒输出一次统计

// 全局统计
const stats = {
  startTime: Date.now(),
  loginSuccess: 0,
  loginFailed: 0,
  connectionSuccess: 0,
  connectionFailed: 0,
  disconnects: 0,
  reconnects: 0,
  messagesSent: 0,
  messagesAcked: 0,
  messagesReceived: 0,
  errors: 0,
  latencies: [],
  latencyHistory: [], // 每分钟平均延迟
  activeConnections: 0
};

// 测试用户
const users = Array.from({ length: 100 }, (_, i) => ({
  account: `testuser${i + 1}`,
  password: 'password123'
}));

/**
 * 登录
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
 * 获取好友
 */
async function getFriends(token) {
  try {
    const res = await axios.get(`${BASE_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data.code === 200 && res.data.data) {
      return res.data.data.list || [];
    }
  } catch (e) {}
  return [];
}

/**
 * 创建虚拟用户（带自动重连）
 */
async function createVirtualUser(userIndex) {
  const user = users[userIndex % users.length];

  const loginData = await login(user.account, user.password);
  if (!loginData) return null;

  const friends = await getFriends(loginData.token);
  if (friends.length === 0) return null;

  return new Promise((resolve) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      query: { token: loginData.token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    const vuData = {
      socket,
      account: user.account,
      userId: loginData.user.id,
      friends,
      connected: false,
      messageInterval: null
    };

    socket.on('connect', () => {
      if (!vuData.connected) {
        stats.connectionSuccess++;
        vuData.connected = true;
      } else {
        stats.reconnects++;
        console.log(`[${user.account}] 重连成功`);
      }
      stats.activeConnections++;
    });

    socket.on('disconnect', (reason) => {
      stats.disconnects++;
      stats.activeConnections--;
      if (reason !== 'io client disconnect') {
        console.log(`[${user.account}] 断开连接: ${reason}`);
      }
    });

    socket.on('connect_error', (err) => {
      if (!vuData.connected) {
        stats.connectionFailed++;
      }
    });

    socket.on('new_message', () => {
      stats.messagesReceived++;
    });

    setTimeout(() => {
      if (vuData.connected) {
        resolve(vuData);
      } else {
        resolve(null);
      }
    }, 5000);
  });
}

/**
 * 发送消息
 */
function sendMessage(vuData) {
  if (!vuData.friends || vuData.friends.length === 0) return;
  if (!vuData.socket.connected) return;

  const friend = vuData.friends[Math.floor(Math.random() * vuData.friends.length)];
  const startTime = Date.now();

  vuData.socket.emit('send_message', {
    receiverId: friend.id,
    type: 'text',
    content: `稳定性测试 [${vuData.account}] ${Date.now()}`
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
 * 格式化时间
 */
function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${s.toString().padStart(2, '0')}`;
}

/**
 * 输出实时统计
 */
function printLiveStats() {
  const elapsed = Date.now() - stats.startTime;
  const elapsedStr = formatDuration(elapsed);

  // 计算最近的延迟统计
  const recentLatencies = stats.latencies.slice(-100);
  const avgLatency = recentLatencies.length > 0
    ? (recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length).toFixed(1)
    : 0;
  const p95Latency = percentile(recentLatencies, 95);

  // 计算成功率
  const ackRate = stats.messagesSent > 0
    ? ((stats.messagesAcked / stats.messagesSent) * 100).toFixed(1)
    : 100;

  // 记录延迟历史
  if (recentLatencies.length > 0) {
    stats.latencyHistory.push(parseFloat(avgLatency));
  }

  console.log(`[${elapsedStr}] 连接: ${stats.activeConnections} | 发送: ${stats.messagesSent} | 确认率: ${ackRate}% | 延迟: ${avgLatency}ms (p95: ${p95Latency}ms) | 断线: ${stats.disconnects} | 重连: ${stats.reconnects}`);
}

/**
 * 打印最终报告
 */
function printFinalReport() {
  const elapsed = Date.now() - stats.startTime;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              长时间稳定性测试报告                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  console.log(`║ 测试时长: ${formatDuration(elapsed).padEnd(50)}║`);
  console.log(`║ 并发用户: ${CONCURRENT_USERS.toString().padEnd(50)}║`);
  console.log(`║ 目标服务器: ${BASE_URL.padEnd(48)}║`);

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ 连接统计                                                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const connSuccessRate = ((stats.connectionSuccess / (stats.connectionSuccess + stats.connectionFailed)) * 100).toFixed(1);
  console.log(`║   初始连接成功: ${stats.connectionSuccess.toString().padEnd(44)}║`);
  console.log(`║   初始连接失败: ${stats.connectionFailed.toString().padEnd(44)}║`);
  console.log(`║   连接成功率: ${(connSuccessRate + '%').padEnd(46)}║`);
  console.log(`║   断线次数: ${stats.disconnects.toString().padEnd(48)}║`);
  console.log(`║   重连次数: ${stats.reconnects.toString().padEnd(48)}║`);

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ 消息统计                                                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const ackRate = stats.messagesSent > 0 ? ((stats.messagesAcked / stats.messagesSent) * 100).toFixed(2) : 100;
  const msgPerSec = (stats.messagesSent / (elapsed / 1000)).toFixed(2);
  console.log(`║   消息发送: ${stats.messagesSent.toString().padEnd(48)}║`);
  console.log(`║   消息确认: ${stats.messagesAcked.toString().padEnd(48)}║`);
  console.log(`║   消息接收: ${stats.messagesReceived.toString().padEnd(48)}║`);
  console.log(`║   确认率: ${(ackRate + '%').padEnd(50)}║`);
  console.log(`║   吞吐量: ${(msgPerSec + ' msg/s').padEnd(50)}║`);
  console.log(`║   错误数: ${stats.errors.toString().padEnd(50)}║`);

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ 延迟统计 (ms)                                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  if (stats.latencies.length > 0) {
    const avg = (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(2);
    const min = Math.min(...stats.latencies);
    const max = Math.max(...stats.latencies);
    const p90 = percentile(stats.latencies, 90);
    const p95 = percentile(stats.latencies, 95);
    const p99 = percentile(stats.latencies, 99);

    console.log(`║   平均: ${avg.toString().padEnd(52)}║`);
    console.log(`║   最小: ${min.toString().padEnd(52)}║`);
    console.log(`║   最大: ${max.toString().padEnd(52)}║`);
    console.log(`║   p90: ${p90.toString().padEnd(53)}║`);
    console.log(`║   p95: ${p95.toString().padEnd(53)}║`);
    console.log(`║   p99: ${p99.toString().padEnd(53)}║`);
  }

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ 稳定性评估                                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  // 评估稳定性
  const issues = [];
  if (stats.disconnects > stats.connectionSuccess * 0.1) {
    issues.push('断线率过高 (>10%)');
  }
  if (parseFloat(ackRate) < 99) {
    issues.push('消息确认率低于99%');
  }
  if (stats.latencies.length > 0) {
    const p95 = percentile(stats.latencies, 95);
    if (p95 > 500) {
      issues.push('p95延迟超过500ms');
    }
  }

  if (issues.length === 0) {
    console.log(`║   ✅ 系统稳定，无异常                                          ║`);
  } else {
    issues.forEach(issue => {
      console.log(`║   ⚠️  ${issue.padEnd(54)}║`);
    });
  }

  console.log('╚══════════════════════════════════════════════════════════════╝');
}

/**
 * 主函数
 */
async function main() {
  const durationMs = DURATION_MIN * 60 * 1000;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              长时间稳定性测试                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ 并发用户: ${CONCURRENT_USERS.toString().padEnd(50)}║`);
  console.log(`║ 持续时间: ${(DURATION_MIN + ' 分钟').padEnd(50)}║`);
  console.log(`║ 目标服务器: ${BASE_URL.padEnd(48)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 创建虚拟用户
  console.log('\n创建虚拟用户...');
  const vuPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    vuPromises.push(createVirtualUser(i));
    await new Promise(r => setTimeout(r, 50));
  }

  const virtualUsers = (await Promise.all(vuPromises)).filter(Boolean);
  console.log(`活跃用户: ${virtualUsers.length}/${CONCURRENT_USERS}\n`);

  if (virtualUsers.length === 0) {
    console.error('没有用户连接成功，退出');
    process.exit(1);
  }

  // 开始定时发送消息
  for (const vu of virtualUsers) {
    vu.messageInterval = setInterval(() => {
      sendMessage(vu);
    }, MESSAGE_INTERVAL_MS);
  }

  // 定时输出统计
  const statsInterval = setInterval(printLiveStats, STATS_INTERVAL_MS);

  console.log('开始稳定性测试...\n');
  printLiveStats();

  // 等待测试完成
  await new Promise(r => setTimeout(r, durationMs));

  // 停止
  console.log('\n停止测试...');
  clearInterval(statsInterval);

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

  // 打印最终报告
  printFinalReport();
}

main().catch(console.error);
