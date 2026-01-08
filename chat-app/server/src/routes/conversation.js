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
