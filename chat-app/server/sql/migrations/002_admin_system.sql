-- 后台管理系统数据库迁移脚本
-- 新增功能：管理员、推荐链接、用户状态
-- 版本号: 002

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 1. 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '管理员账号',
    password VARCHAR(255) NOT NULL COMMENT '密码(bcrypt加密)',
    nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '头像',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) DEFAULT NULL COMMENT '最后登录IP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- 2. 推荐链接表
CREATE TABLE IF NOT EXISTS referral_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE COMMENT '用户ID(一个用户只能有一条链接)',
    code VARCHAR(16) NOT NULL UNIQUE COMMENT '唯一推荐码',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活(1=激活,0=禁用)',
    click_count INT DEFAULT 0 COMMENT '点击次数',
    register_count INT DEFAULT 0 COMMENT '通过此链接注册的用户数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_code (code),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐链接表';

-- 3. 推荐注册记录表
CREATE TABLE IF NOT EXISTS referral_registrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    referral_link_id INT NOT NULL COMMENT '推荐链接ID',
    referrer_id INT NOT NULL COMMENT '推荐人ID',
    referee_id INT NOT NULL COMMENT '被推荐人ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referee_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_referrer (referrer_id),
    INDEX idx_referee (referee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推荐注册记录表';

-- 4. 用户表扩展字段 (使用存储过程处理兼容性)
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS add_user_admin_columns()
BEGIN
    -- 检查 status 列是否存在
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status ENUM('active', 'banned') DEFAULT 'active' COMMENT '用户状态';
    END IF;

    -- 检查 banned_at 列是否存在
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'banned_at'
    ) THEN
        ALTER TABLE users ADD COLUMN banned_at TIMESTAMP NULL COMMENT '封停时间';
    END IF;

    -- 检查 banned_reason 列是否存在
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'banned_reason'
    ) THEN
        ALTER TABLE users ADD COLUMN banned_reason VARCHAR(200) DEFAULT NULL COMMENT '封停原因';
    END IF;

    -- 检查索引是否存在
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND INDEX_NAME = 'idx_status'
    ) THEN
        ALTER TABLE users ADD INDEX idx_status (status);
    END IF;
END //

DELIMITER ;

CALL add_user_admin_columns();
DROP PROCEDURE IF EXISTS add_user_admin_columns;

-- 5. 插入默认管理员账号 (密码: admin123)
-- bcrypt hash for 'admin123'
INSERT IGNORE INTO admins (username, password, nickname)
VALUES ('admin', '$2a$10$uBWCdFNNneUTLizRAOEgBeKdhBAyaQywVen7dFeGox01ZBYWq8ofe', '超级管理员');
