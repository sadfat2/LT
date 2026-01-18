-- 斗地主游戏数据库初始化脚本

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account` VARCHAR(50) NOT NULL COMMENT '账号',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `nickname` VARCHAR(50) NOT NULL COMMENT '昵称',
  `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  `coins` INT UNSIGNED NOT NULL DEFAULT 10000 COMMENT '金币',
  `level` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '等级',
  `experience` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '经验值',
  `total_games` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总场次',
  `wins` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '胜场',
  `chat_user_id` INT UNSIGNED DEFAULT NULL COMMENT '关联的聊天用户ID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_account` (`account`),
  KEY `idx_chat_user_id` (`chat_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 游戏记录表
CREATE TABLE IF NOT EXISTS `game_records` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `room_id` VARCHAR(36) NOT NULL COMMENT '房间ID',
  `role` ENUM('landlord', 'farmer') NOT NULL COMMENT '角色',
  `is_win` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否获胜',
  `coin_change` INT NOT NULL DEFAULT 0 COMMENT '金币变化',
  `multiplier` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '倍数',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_room_id` (`room_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_game_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏记录表';

-- 交易记录表
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `type` ENUM('checkin', 'game', 'bankrupt_aid') NOT NULL COMMENT '交易类型',
  `amount` INT NOT NULL COMMENT '金额（正为收入，负为支出）',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易记录表';

-- 每日签到表
CREATE TABLE IF NOT EXISTS `daily_checkins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `checkin_date` DATE NOT NULL COMMENT '签到日期',
  `consecutive_days` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '连续签到天数',
  `reward` INT UNSIGNED NOT NULL COMMENT '签到奖励',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_date` (`user_id`, `checkin_date`),
  CONSTRAINT `fk_checkins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日签到表';

-- 游戏邀请表
CREATE TABLE IF NOT EXISTS `game_invitations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `inviter_id` INT UNSIGNED NOT NULL COMMENT '邀请者ID',
  `invitee_id` INT UNSIGNED DEFAULT NULL COMMENT '被邀请者ID（可空，表示公开邀请）',
  `room_id` VARCHAR(36) NOT NULL COMMENT '房间ID',
  `code` VARCHAR(20) NOT NULL COMMENT '邀请码',
  `status` ENUM('pending', 'accepted', 'expired') NOT NULL DEFAULT 'pending' COMMENT '状态',
  `expires_at` TIMESTAMP NOT NULL COMMENT '过期时间',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_code` (`code`),
  KEY `idx_inviter` (`inviter_id`),
  KEY `idx_invitee` (`invitee_id`),
  KEY `idx_room_id` (`room_id`),
  CONSTRAINT `fk_invitations_inviter` FOREIGN KEY (`inviter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invitations_invitee` FOREIGN KEY (`invitee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏邀请表';

-- 破产补助记录表
CREATE TABLE IF NOT EXISTS `bankrupt_aids` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `amount` INT UNSIGNED NOT NULL COMMENT '补助金额',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_bankrupt_aids_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='破产补助记录表';

SET FOREIGN_KEY_CHECKS = 1;

-- 插入测试用户
INSERT INTO `users` (`account`, `password`, `nickname`, `coins`) VALUES
('testuser1', '$2a$10$N.G5HWYt0P5KZhZyLxX9Q.QFdQb0eDFRv4D3v4N3XFB2qKL3JQcZm', '测试用户1', 10000),
('testuser2', '$2a$10$N.G5HWYt0P5KZhZyLxX9Q.QFdQb0eDFRv4D3v4N3XFB2qKL3JQcZm', '测试用户2', 10000),
('testuser3', '$2a$10$N.G5HWYt0P5KZhZyLxX9Q.QFdQb0eDFRv4D3v4N3XFB2qKL3JQcZm', '测试用户3', 10000);
-- 密码都是: password123
