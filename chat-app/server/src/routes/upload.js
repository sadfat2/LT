const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const User = require('../models/User');
const authMiddleware = require('../middlewares/auth');
const config = require('../config');
const { AppError } = require('../middlewares/errorHandler');

const router = express.Router();

// 创建上传目录
const uploadDirs = ['avatars', 'images', 'voices'];
uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '../../uploads', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 按日期生成目录
const getDateDir = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

// 通用存储配置
const createStorage = (subDir) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dateDir = getDateDir();
    const uploadPath = path.join(__dirname, '../../uploads', subDir, dateDir);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// 图片过滤器
const imageFilter = (req, file, cb) => {
  if (config.upload.allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('只允许上传图片文件', 400), false);
  }
};

// 语音过滤器
const voiceFilter = (req, file, cb) => {
  if (config.upload.allowedVoiceTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('只允许上传音频文件', 400), false);
  }
};

// 头像上传
const avatarUpload = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: imageFilter
});

router.post('/avatar', authMiddleware, avatarUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请选择要上传的图片', 400);
    }

    // 压缩头像
    const dateDir = getDateDir();
    const thumbName = `thumb_${req.file.filename}`;
    const thumbPath = path.join(__dirname, '../../uploads/avatars', dateDir, thumbName);

    await sharp(req.file.path)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    const avatarUrl = `/uploads/avatars/${dateDir}/${thumbName}`;

    // 更新用户头像
    await User.update(req.user.id, { avatar: avatarUrl });

    res.json({
      code: 200,
      message: '头像上传成功',
      data: { url: avatarUrl }
    });
  } catch (error) {
    next(error);
  }
});

// 图片上传
const imageUpload = multer({
  storage: createStorage('images'),
  limits: { fileSize: config.upload.maxSize },
  fileFilter: imageFilter
});

router.post('/image', authMiddleware, imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请选择要上传的图片', 400);
    }

    const dateDir = getDateDir();

    // 生成缩略图
    const thumbName = `thumb_${req.file.filename}`;
    const thumbPath = path.join(__dirname, '../../uploads/images', dateDir, thumbName);

    await sharp(req.file.path)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(thumbPath);

    res.json({
      code: 200,
      message: '图片上传成功',
      data: {
        url: `/uploads/images/${dateDir}/${req.file.filename}`,
        thumbnail: `/uploads/images/${dateDir}/${thumbName}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// 语音上传
const voiceUpload = multer({
  storage: createStorage('voices'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: voiceFilter
});

router.post('/voice', authMiddleware, voiceUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('请选择要上传的语音', 400);
    }

    const dateDir = getDateDir();
    const duration = parseInt(req.body.duration) || 0;

    res.json({
      code: 200,
      message: '语音上传成功',
      data: {
        url: `/uploads/voices/${dateDir}/${req.file.filename}`,
        duration
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
