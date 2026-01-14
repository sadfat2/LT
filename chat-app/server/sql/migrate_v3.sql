-- v3 功能迁移脚本
-- 执行命令: docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_v3.sql

SET NAMES utf8mb4;

-- 1. 用户表添加注册IP字段
DELIMITER //

CREATE PROCEDURE add_register_ip_column()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'register_ip'
    ) THEN
        ALTER TABLE users ADD COLUMN register_ip VARCHAR(45) DEFAULT NULL COMMENT '注册IP地址';
    END IF;
END //

DELIMITER ;

CALL add_register_ip_column();
DROP PROCEDURE IF EXISTS add_register_ip_column;

-- 2. 创建IP注册限制表
CREATE TABLE IF NOT EXISTS ip_register_limits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL COMMENT 'IP地址',
    referral_link_id INT NOT NULL COMMENT '推荐链接ID',
    user_id INT NOT NULL COMMENT '注册的用户ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ip_address (ip_address),
    INDEX idx_referral_link (referral_link_id),
    INDEX idx_ip_referral (ip_address, referral_link_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='IP注册限制表';

SELECT 'v3迁移完成!' AS message;
