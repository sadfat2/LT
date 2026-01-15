-- ==============================================
-- 性能优化索引迁移脚本
-- 执行方式: docker exec -i chat-mysql mysql -uroot -proot123456 chat_app < chat-app/server/sql/migrate_performance.sql
-- ==============================================

DELIMITER //

-- 辅助存储过程：安全创建索引（如果不存在）
DROP PROCEDURE IF EXISTS create_index_if_not_exists//
CREATE PROCEDURE create_index_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns VARCHAR(256)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO index_exists
    FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index;

    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, '(', p_columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Created index: ', p_index, ' on ', p_table) AS result;
    ELSE
        SELECT CONCAT('Index already exists: ', p_index, ' on ', p_table) AS result;
    END IF;
END//

DELIMITER ;

-- ==============================================
-- 创建性能优化索引
-- ==============================================

-- 1. 会话更新时间索引（会话列表排序）
CALL create_index_if_not_exists('conversations', 'idx_conversations_updated_at', 'updated_at DESC');

-- 2. 消息复合索引（消息分页查询）
CALL create_index_if_not_exists('messages', 'idx_messages_conv_created', 'conversation_id, created_at DESC');

-- 3. 未读消息计数索引
CALL create_index_if_not_exists('messages', 'idx_messages_unread', 'conversation_id, sender_id, status, created_at');

-- 4. 群成员索引优化
CALL create_index_if_not_exists('group_members', 'idx_group_members_group_user', 'group_id, user_id');

-- 5. 会话类型索引（快速定位私聊/群聊）
CALL create_index_if_not_exists('conversations', 'idx_conversations_type', 'type');

-- 6. 会话参与者索引（快速查询用户参与的会话）
CALL create_index_if_not_exists('conversation_participants', 'idx_conversation_participants_user', 'user_id, conversation_id');

-- 7. 好友关系索引（好友列表查询）
CALL create_index_if_not_exists('friendships', 'idx_friendships_user', 'user_id, friend_id');

-- ==============================================
-- 全文索引（单独处理，因为语法不同）
-- ==============================================
DELIMITER //

DROP PROCEDURE IF EXISTS create_fulltext_index//
CREATE PROCEDURE create_fulltext_index()
BEGIN
    DECLARE ft_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO ft_exists
    FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name = 'messages'
      AND index_name = 'ft_content';

    IF ft_exists = 0 THEN
        ALTER TABLE messages ADD FULLTEXT INDEX ft_content (content) WITH PARSER ngram;
        SELECT 'Created fulltext index: ft_content on messages' AS result;
    ELSE
        SELECT 'Fulltext index already exists: ft_content on messages' AS result;
    END IF;
END//

DELIMITER ;

CALL create_fulltext_index();

-- ==============================================
-- 更新表统计信息
-- ==============================================
ANALYZE TABLE conversations;
ANALYZE TABLE messages;
ANALYZE TABLE group_members;
ANALYZE TABLE conversation_participants;
ANALYZE TABLE friendships;

-- ==============================================
-- 清理临时存储过程
-- ==============================================
DROP PROCEDURE IF EXISTS create_index_if_not_exists;
DROP PROCEDURE IF EXISTS create_fulltext_index;

-- ==============================================
-- 执行完成提示
-- ==============================================
SELECT 'Performance optimization indexes migration completed!' AS final_result;
