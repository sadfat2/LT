-- 聊天室应用数据库迁移脚本 v2
-- 新增功能：群聊、文件传输
-- 执行方式：docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < migrate_v2.sql

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 1. 创建群组表
CREATE TABLE IF NOT EXISTS `groups` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL COMMENT '群名称',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '群头像',
    owner_id INT NOT NULL COMMENT '群主ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群组表';

-- 2. 创建群成员表
CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL COMMENT '群组ID',
    user_id INT NOT NULL COMMENT '用户ID',
    role ENUM('owner', 'member') DEFAULT 'member' COMMENT '成员角色',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_group_user (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_group (group_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群成员表';

-- 3. 修改 conversations 表添加 group_id 字段
-- 先检查字段是否存在
SET @column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND COLUMN_NAME = 'group_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE conversations ADD COLUMN group_id INT DEFAULT NULL COMMENT ''群组ID(群聊时使用)''',
    'SELECT ''group_id column already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 修改 messages 表扩展消息类型
-- 扩展 type 枚举值
ALTER TABLE messages
MODIFY COLUMN type ENUM('text', 'image', 'voice', 'file', 'video', 'system') DEFAULT 'text' COMMENT '消息类型';

-- 添加新字段（如果不存在）
SET @col1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'thumbnail_url');
SET @sql1 = IF(@col1 = 0, 'ALTER TABLE messages ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL COMMENT ''缩略图URL(视频封面等)''', 'SELECT 1');
PREPARE stmt FROM @sql1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'file_name');
SET @sql2 = IF(@col2 = 0, 'ALTER TABLE messages ADD COLUMN file_name VARCHAR(255) DEFAULT NULL COMMENT ''文件名''', 'SELECT 1');
PREPARE stmt FROM @sql2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col3 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'file_size');
SET @sql3 = IF(@col3 = 0, 'ALTER TABLE messages ADD COLUMN file_size INT DEFAULT NULL COMMENT ''文件大小(bytes)''', 'SELECT 1');
PREPARE stmt FROM @sql3;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 完成
SELECT 'Migration v2 completed successfully!' AS result;
