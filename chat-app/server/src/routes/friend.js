const express = require('express');
const { Friend, FriendRequest } = require('../models/Friend');
const User = require('../models/User');
const authMiddleware = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const router = express.Router();

// 获取好友列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const friends = await Friend.getFriendList(req.user.id);

    // 按首字母分组
    const grouped = {};
    friends.forEach(friend => {
      const firstLetter = (friend.pinyin && friend.pinyin[0]) ?
        friend.pinyin[0].toUpperCase() : '#';
      const key = /^[A-Z]$/.test(firstLetter) ? firstLetter : '#';

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(friend);
    });

    res.json({
      code: 200,
      data: {
        list: friends,
        grouped
      }
    });
  } catch (error) {
    next(error);
  }
});

// 发送好友申请
router.post('/request', authMiddleware, async (req, res, next) => {
  try {
    const { toUserId, message } = req.body;

    if (!toUserId) {
      throw new AppError('请指定目标用户', 400);
    }

    if (toUserId === req.user.id) {
      throw new AppError('不能添加自己为好友', 400);
    }

    // 检查目标用户是否存在
    const targetUser = await User.findById(toUserId);
    if (!targetUser) {
      throw new AppError('用户不存在', 404);
    }

    // 检查是否已是好友
    const isFriend = await Friend.isFriend(req.user.id, toUserId);
    if (isFriend) {
      throw new AppError('已经是好友了', 400);
    }

    // 创建申请
    const result = await FriendRequest.create(req.user.id, toUserId, message);

    // 发送实时通知
    const io = getIO();
    const fromUser = await User.findById(req.user.id);
    io.to(`user_${toUserId}`).emit('friend_request', {
      id: result.id,
      from_user_id: req.user.id,
      account: fromUser.account,
      nickname: fromUser.nickname,
      avatar: fromUser.avatar,
      message
    });

    res.json({
      code: 200,
      message: result.isNew ? '好友申请已发送' : '已有待处理的申请',
      data: { requestId: result.id }
    });
  } catch (error) {
    next(error);
  }
});

// 获取好友申请列表
router.get('/requests', authMiddleware, async (req, res, next) => {
  try {
    const received = await FriendRequest.getReceivedRequests(req.user.id);
    const sent = await FriendRequest.getSentRequests(req.user.id);

    res.json({
      code: 200,
      data: { received, sent }
    });
  } catch (error) {
    next(error);
  }
});

// 获取待处理申请数量
router.get('/requests/pending-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await FriendRequest.getPendingCount(req.user.id);

    res.json({
      code: 200,
      data: { count }
    });
  } catch (error) {
    next(error);
  }
});

// 同意好友申请
router.post('/accept/:id', authMiddleware, async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id);
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      throw new AppError('申请不存在', 404);
    }

    if (request.to_user_id !== req.user.id) {
      throw new AppError('无权操作', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('申请已处理', 400);
    }

    // 更新申请状态
    await FriendRequest.updateStatus(requestId, 'accepted');

    // 添加好友关系
    await Friend.addFriend(request.from_user_id, request.to_user_id);

    // 发送实时通知
    const io = getIO();
    const currentUser = await User.findById(req.user.id);
    io.to(`user_${request.from_user_id}`).emit('friend_accepted', {
      userId: req.user.id,
      account: currentUser.account,
      nickname: currentUser.nickname,
      avatar: currentUser.avatar
    });

    res.json({
      code: 200,
      message: '已同意好友申请'
    });
  } catch (error) {
    next(error);
  }
});

// 拒绝好友申请
router.post('/reject/:id', authMiddleware, async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id);
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      throw new AppError('申请不存在', 404);
    }

    if (request.to_user_id !== req.user.id) {
      throw new AppError('无权操作', 403);
    }

    if (request.status !== 'pending') {
      throw new AppError('申请已处理', 400);
    }

    await FriendRequest.updateStatus(requestId, 'rejected');

    res.json({
      code: 200,
      message: '已拒绝好友申请'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
