/**
 * 预生成测试用户 token
 *
 * 功能:
 * 1. 登录所有测试用户获取 token
 * 2. 获取每个用户的好友列表
 * 3. 获取每个用户的群组信息
 * 4. 保存为 CSV 和 JSON 格式
 *
 * 用法:
 *   node generate-tokens.js
 *
 * 环境变量:
 *   BASE_URL - 目标服务器地址 (默认: https://chat.laoyegong.xyz)
 *   USER_COUNT - 生成用户数量 (默认: 50)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://chat.laoyegong.xyz';
const USER_COUNT = parseInt(process.env.USER_COUNT) || 50;

const urlObj = new URL(BASE_URL);
const isHttps = urlObj.protocol === 'https:';
const httpModule = isHttps ? https : http;
const hostname = urlObj.hostname;
const port = urlObj.port || (isHttps ? 443 : 80);

/**
 * HTTP 请求封装
 */
function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${responseData.substring(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * 登录获取 token
 */
async function login(account, password) {
  const result = await request('POST', '/api/auth/login', { account, password });
  if (result.code === 200 && result.data) {
    return result.data;
  }
  throw new Error(result.message || 'Login failed');
}

/**
 * 获取好友列表
 */
async function getFriends(token) {
  try {
    const result = await request('GET', '/api/friends', null, token);
    const friends = result.data?.list || result.data || [];
    if (friends.length > 0) {
      // 随机选择一个好友
      const friend = friends[Math.floor(Math.random() * friends.length)];
      return friend.id;
    }
  } catch (e) {
    // 忽略错误
  }
  return 1; // 默认 ID
}

/**
 * 获取群组列表
 */
async function getGroups(token) {
  try {
    const result = await request('GET', '/api/groups', null, token);
    const groups = result.data || [];
    if (groups.length > 0) {
      // 随机选择一个群
      const group = groups[Math.floor(Math.random() * groups.length)];
      return {
        groupId: group.id,
        groupConversationId: group.conversation_id || group.conversationId || 0
      };
    }
  } catch (e) {
    // 忽略错误
  }
  return { groupId: 0, groupConversationId: 0 };
}

/**
 * 获取会话列表 (用于获取群会话ID)
 */
async function getConversations(token, groupId) {
  try {
    const result = await request('GET', '/api/conversations', null, token);
    const conversations = result.data || [];
    // 找到对应群的会话
    const groupConv = conversations.find(c => c.type === 'group' && c.group_id === groupId);
    if (groupConv) {
      return groupConv.id;
    }
  } catch (e) {
    // 忽略错误
  }
  return 0;
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('Artillery 测试 - Token 生成器');
  console.log('========================================');
  console.log(`目标服务器: ${BASE_URL}`);
  console.log(`用户数量: ${USER_COUNT}`);
  console.log('');

  const tokens = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= USER_COUNT; i++) {
    const account = `testuser${i}`;
    process.stdout.write(`[${i}/${USER_COUNT}] ${account} ... `);

    try {
      // 登录
      const loginData = await login(account, 'password123');

      // 获取好友
      const friendId = await getFriends(loginData.token);

      // 获取群组
      const groupInfo = await getGroups(loginData.token);

      // 如果有群但没有会话ID，尝试获取会话
      let groupConversationId = groupInfo.groupConversationId;
      if (groupInfo.groupId && !groupConversationId) {
        groupConversationId = await getConversations(loginData.token, groupInfo.groupId);
      }

      tokens.push({
        account,
        userId: loginData.user.id,
        token: loginData.token,
        friendId,
        groupId: groupInfo.groupId,
        groupConversationId
      });

      successCount++;
      console.log(`✓ (friend: ${friendId}, group: ${groupInfo.groupId})`);
    } catch (e) {
      failCount++;
      console.log(`✗ ${e.message}`);
    }

    // 请求间隔
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('');
  console.log('========================================');
  console.log(`成功: ${successCount}, 失败: ${failCount}`);
  console.log('========================================');

  if (tokens.length === 0) {
    console.error('\n错误: 没有成功获取任何 token!');
    console.error('请检查:');
    console.error('  1. 服务器是否在线');
    console.error('  2. 测试用户是否已创建 (运行 setup/create-users.js)');
    process.exit(1);
  }

  // 保存 CSV (带表头)
  const csvPath = './tokens.csv';
  const csvHeader = 'account,userId,token,friendId,groupId,groupConversationId';
  const csvContent = csvHeader + '\n' +
    tokens.map(t =>
      `${t.account},${t.userId},${t.token},${t.friendId},${t.groupId},${t.groupConversationId}`
    ).join('\n');

  fs.writeFileSync(csvPath, csvContent);
  console.log(`\n✓ 已保存 ${tokens.length} 条记录到 ${csvPath}`);

  // 保存 JSON
  const jsonPath = './tokens.json';
  fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
  console.log(`✓ 已保存 ${tokens.length} 条记录到 ${jsonPath}`);

  // 统计信息
  const withGroups = tokens.filter(t => t.groupId > 0).length;
  const withGroupConv = tokens.filter(t => t.groupConversationId > 0).length;
  console.log(`\n统计:`);
  console.log(`  - 有好友的用户: ${tokens.filter(t => t.friendId > 0).length}`);
  console.log(`  - 有群组的用户: ${withGroups}`);
  console.log(`  - 有群会话的用户: ${withGroupConv}`);

  if (withGroupConv === 0 && withGroups > 0) {
    console.log('\n提示: 用户有群组但没有群会话 ID，群消息测试可能受影响');
    console.log('请确保运行 setup/create-users.js 创建完整的测试数据');
  }
}

main().catch(err => {
  console.error('\n执行失败:', err.message);
  process.exit(1);
});
