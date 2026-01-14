const express = require('express');
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const referralsRoutes = require('./referrals');
const statisticsRoutes = require('./statistics');
const adminsRoutes = require('./admins');

const router = express.Router();

// 管理员认证
router.use('/auth', authRoutes);

// 用户管理
router.use('/users', usersRoutes);

// 推荐链接管理
router.use('/referrals', referralsRoutes);

// 数据统计
router.use('/statistics', statisticsRoutes);

// 管理员管理
router.use('/admins', adminsRoutes);

module.exports = router;
