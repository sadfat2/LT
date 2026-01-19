-- 聊天应用集成迁移脚本
-- 添加 chat_user_id 字段用于关联聊天应用用户

-- 添加聊天用户ID字段
ALTER TABLE users
ADD COLUMN chat_user_id INT NULL COMMENT '聊天应用用户ID' AFTER updated_at;

-- 添加索引
CREATE INDEX idx_users_chat_user_id ON users(chat_user_id);

-- 添加唯一约束（一个聊天用户只能关联一个游戏用户）
ALTER TABLE users
ADD CONSTRAINT uk_users_chat_user_id UNIQUE (chat_user_id);
