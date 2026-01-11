const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const authMiddleware = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

const router = express.Router();

// 获取会话列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const conversations = await Conversation.getUserConversations(req.user.id);

    res.json({
      code: 200,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
});

// 创建或获取私聊会话
router.post('/private', authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new AppError('请指定对方用户ID', 400);
    }

    const result = await Conversation.getOrCreatePrivate(req.user.id, userId);

    res.json({
      code: 200,
      data: { conversationId: result.id, isNew: result.isNew }
    });
  } catch (error) {
    next(error);
  }
});

// 综合搜索（必须放在 /:id 路由之前）
router.get('/search/all', authMiddleware, async (req, res, next) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.trim().length === 0) {
      return res.json({
        code: 200,
        data: { friends: [], groups: [], messages: [] }
      });
    }

    const searchKeyword = keyword.trim();
    const userId = req.user.id;

    // 1. 搜索好友
    const friends = await Conversation.searchFriends(userId, searchKeyword);

    // 2. 搜索群聊
    const groups = await Conversation.searchGroups(userId, searchKeyword);

    // 3. 搜索消息
    const messages = await Message.search(userId, searchKeyword, 20);

    res.json({
      code: 200,
      data: { friends, groups, messages }
    });
  } catch (error) {
    next(error);
  }
});

// 删除会话
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id);
    await Conversation.delete(conversationId, req.user.id);

    res.json({
      code: 200,
      message: '会话已删除'
    });
  } catch (error) {
    next(error);
  }
});

// 获取会话消息（分页）
router.get('/:id/messages', authMiddleware, async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const messages = await Message.getByConversation(conversationId, page, limit);

    // 更新已读状态
    await Message.markAsRead(conversationId, req.user.id);
    await Conversation.updateLastRead(conversationId, req.user.id);

    res.json({
      code: 200,
      data: {
        messages,
        page,
        limit,
        hasMore: messages.length === limit
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
