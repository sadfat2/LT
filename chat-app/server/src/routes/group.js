const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const { Friend } = require('../models/Friend');
const authMiddleware = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const router = express.Router();

// 创建群聊
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('请输入群名称', 400);
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
      throw new AppError('请至少选择一个成员', 400);
    }

    // 验证所有成员都是当前用户的好友
    for (const memberId of memberIds) {
      const isFriend = await Friend.isFriend(req.user.id, memberId);
      if (!isFriend && memberId !== req.user.id) {
        throw new AppError('只能邀请好友加入群聊', 400);
      }
    }

    const { groupId, conversationId } = await Group.create(
      name.trim(),
      req.user.id,
      memberIds
    );

    const group = await Group.getDetail(groupId);

    // 通知所有成员
    const io = getIO();
    memberIds.forEach(memberId => {
      if (memberId !== req.user.id) {
        io.to(`user_${memberId}`).emit('group_created', {
          group,
          conversationId,
          inviter: {
            id: req.user.id,
            nickname: req.user.nickname || req.user.account
          }
        });
      }
    });

    res.json({
      code: 200,
      message: '群聊创建成功',
      data: {
        groupId,
        conversationId,
        group
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取群聊列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const groups = await Group.getUserGroups(req.user.id);
    res.json({
      code: 200,
      data: groups
    });
  } catch (error) {
    next(error);
  }
});

// 获取群详情
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);

    // 验证是否是群成员
    const isMember = await Group.isMember(groupId, req.user.id);
    if (!isMember) {
      throw new AppError('您不是该群成员', 403);
    }

    const group = await Group.getDetail(groupId);
    if (!group) {
      throw new AppError('群聊不存在', 404);
    }

    res.json({
      code: 200,
      data: group
    });
  } catch (error) {
    next(error);
  }
});

// 邀请成员
router.post('/:id/invite', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('请选择要邀请的成员', 400);
    }

    // 验证是否是群成员
    const isMember = await Group.isMember(groupId, req.user.id);
    if (!isMember) {
      throw new AppError('您不是该群成员', 403);
    }

    // 验证所有成员都是当前用户的好友
    for (const userId of userIds) {
      const isFriend = await Friend.isFriend(req.user.id, userId);
      if (!isFriend) {
        const user = await User.findById(userId);
        throw new AppError(`${user?.nickname || '该用户'}不是您的好友`, 400);
      }
    }

    await Group.addMembers(groupId, userIds, req.user.id);

    const group = await Group.getDetail(groupId);

    // 通知新成员
    const io = getIO();
    userIds.forEach(userId => {
      io.to(`user_${userId}`).emit('group_joined', {
        group,
        conversationId: group.conversation_id,
        inviter: {
          id: req.user.id,
          nickname: req.user.nickname || req.user.account
        }
      });
    });

    // 通知现有成员
    const existingMemberIds = await Group.getMemberIds(groupId);
    const newUsers = await Promise.all(userIds.map(id => User.findById(id)));
    existingMemberIds.forEach(memberId => {
      if (!userIds.includes(memberId)) {
        io.to(`user_${memberId}`).emit('member_joined', {
          groupId,
          conversationId: group.conversation_id,
          newMembers: newUsers.map(u => ({
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar
          })),
          inviter: {
            id: req.user.id,
            nickname: req.user.nickname || req.user.account
          }
        });
      }
    });

    res.json({
      code: 200,
      message: '邀请成功',
      data: group
    });
  } catch (error) {
    next(error);
  }
});

// 退出群聊
router.post('/:id/leave', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);

    // 验证是否是群成员
    const isMember = await Group.isMember(groupId, req.user.id);
    if (!isMember) {
      throw new AppError('您不是该群成员', 403);
    }

    const group = await Group.findById(groupId);

    await Group.leave(groupId, req.user.id);

    // 通知其他成员
    const io = getIO();
    const memberIds = await Group.getMemberIds(groupId);
    memberIds.forEach(memberId => {
      io.to(`user_${memberId}`).emit('member_left', {
        groupId,
        userId: req.user.id,
        nickname: req.user.nickname || req.user.account
      });
    });

    res.json({
      code: 200,
      message: '已退出群聊'
    });
  } catch (error) {
    next(error);
  }
});

// 更新群信息
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, avatar } = req.body;

    // 验证是否是群主
    const isOwner = await Group.isOwner(groupId, req.user.id);
    if (!isOwner) {
      throw new AppError('只有群主可以修改群信息', 403);
    }

    await Group.update(groupId, { name, avatar });

    const group = await Group.getDetail(groupId);

    // 通知所有成员
    const io = getIO();
    const memberIds = await Group.getMemberIds(groupId);
    memberIds.forEach(memberId => {
      io.to(`user_${memberId}`).emit('group_updated', {
        groupId,
        group
      });
    });

    res.json({
      code: 200,
      message: '更新成功',
      data: group
    });
  } catch (error) {
    next(error);
  }
});

// 移除成员（群主权限）
router.delete('/:id/members/:userId', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    // 验证是否是群主
    const isOwner = await Group.isOwner(groupId, req.user.id);
    if (!isOwner) {
      throw new AppError('只有群主可以移除成员', 403);
    }

    if (targetUserId === req.user.id) {
      throw new AppError('不能移除自己', 400);
    }

    const targetUser = await User.findById(targetUserId);
    await Group.removeMember(groupId, targetUserId);

    // 通知被移除的成员
    const io = getIO();
    io.to(`user_${targetUserId}`).emit('removed_from_group', {
      groupId,
      groupName: (await Group.findById(groupId))?.name
    });

    // 通知其他成员
    const memberIds = await Group.getMemberIds(groupId);
    memberIds.forEach(memberId => {
      io.to(`user_${memberId}`).emit('member_removed', {
        groupId,
        userId: targetUserId,
        nickname: targetUser?.nickname || targetUser?.account
      });
    });

    res.json({
      code: 200,
      message: '已移除成员'
    });
  } catch (error) {
    next(error);
  }
});

// 解散群聊（群主权限）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);

    const group = await Group.findById(groupId);
    if (!group) {
      throw new AppError('群聊不存在', 404);
    }

    // 获取成员列表用于通知
    const memberIds = await Group.getMemberIds(groupId);

    await Group.dissolve(groupId, req.user.id);

    // 通知所有成员
    const io = getIO();
    memberIds.forEach(memberId => {
      if (memberId !== req.user.id) {
        io.to(`user_${memberId}`).emit('group_dissolved', {
          groupId,
          groupName: group.name
        });
      }
    });

    res.json({
      code: 200,
      message: '群聊已解散'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
