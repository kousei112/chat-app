const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Lấy danh sách conversations của user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const pool = await getPool();

    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT 
          c.conversation_id,
          c.conversation_type,
          c.group_name,
          c.group_avatar_url,
          DATEADD(HOUR, 7, c.updated_at) as updated_at,
          -- Thông tin cho private chat
          other_user.user_id as other_user_id,
          other_user.username as other_username,
          other_user.display_name as other_display_name,
          other_user.full_name as other_full_name,
          other_user.avatar_url as other_avatar_url,
          other_user.is_online as other_is_online,
          -- Thông tin chung
          last_msg.message_text as last_message,
          DATEADD(HOUR, 7, last_msg.created_at) as last_message_time,
          last_msg.sender_id as last_sender_id,
          (SELECT COUNT(*) 
           FROM Messages m2 
           WHERE m2.conversation_id = c.conversation_id 
             AND m2.receiver_id = @user_id 
             AND m2.is_read = 0
             AND m2.is_deleted = 0
          ) as unread_count,
          -- Thông tin group
          (SELECT COUNT(*) 
           FROM ConversationParticipants 
           WHERE conversation_id = c.conversation_id AND is_active = 1
          ) as member_count
        FROM Conversations c
        INNER JOIN ConversationParticipants cp ON c.conversation_id = cp.conversation_id
        LEFT JOIN ConversationParticipants cp_other ON c.conversation_id = cp_other.conversation_id 
          AND cp_other.user_id != @user_id 
          AND c.conversation_type = 'private'
        LEFT JOIN Users other_user ON cp_other.user_id = other_user.user_id
        OUTER APPLY (
          SELECT TOP 1 message_text, created_at, sender_id
          FROM Messages
          WHERE conversation_id = c.conversation_id AND is_deleted = 0
          ORDER BY created_at DESC
        ) last_msg
        WHERE cp.user_id = @user_id AND cp.is_active = 1
        ORDER BY c.updated_at DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Lỗi lấy conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi lấy danh sách conversations' 
    });
  }
});

// Tạo hoặc lấy conversation với user khác
router.post('/get-or-create', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { otherUserId } = req.body;

    if (!otherUserId || otherUserId === userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID không hợp lệ' 
      });
    }

    const pool = await getPool();

    // Kiểm tra user khác có tồn tại không
    const userCheck = await pool.request()
      .input('other_user_id', sql.Int, otherUserId)
      .query('SELECT user_id, username, display_name, full_name, avatar_url, is_online FROM Users WHERE user_id = @other_user_id');

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy người dùng' 
      });
    }

    // Tìm conversation đã tồn tại
    const existingConv = await pool.request()
      .input('user_id', sql.Int, userId)
      .input('other_user_id', sql.Int, otherUserId)
      .query(`
        SELECT c.conversation_id
        FROM Conversations c
        INNER JOIN ConversationParticipants cp1 ON c.conversation_id = cp1.conversation_id
        INNER JOIN ConversationParticipants cp2 ON c.conversation_id = cp2.conversation_id
        WHERE c.conversation_type = 'private'
          AND cp1.user_id = @user_id
          AND cp2.user_id = @other_user_id
          AND cp1.is_active = 1
          AND cp2.is_active = 1
      `);

    let conversationId;

    if (existingConv.recordset.length > 0) {
      // Conversation đã tồn tại
      conversationId = existingConv.recordset[0].conversation_id;
    } else {
      // Tạo conversation mới
      const newConv = await pool.request()
        .query(`
          INSERT INTO Conversations (conversation_type)
          OUTPUT INSERTED.conversation_id
          VALUES ('private')
        `);

      conversationId = newConv.recordset[0].conversation_id;

      // Thêm cả 2 users vào conversation
      await pool.request()
        .input('conversation_id', sql.Int, conversationId)
        .input('user_id', sql.Int, userId)
        .input('other_user_id', sql.Int, otherUserId)
        .query(`
          INSERT INTO ConversationParticipants (conversation_id, user_id)
          VALUES (@conversation_id, @user_id), (@conversation_id, @other_user_id)
        `);
    }

    res.json({
      success: true,
      data: {
        conversation_id: conversationId,
        other_user: userCheck.recordset[0]
      }
    });

  } catch (error) {
    console.error('Lỗi tạo/lấy conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi tạo conversation' 
    });
  }
});

// Lấy tin nhắn trong conversation
router.get('/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const pool = await getPool();

    // Kiểm tra user có phải thành viên của conversation không
    const memberCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT participant_id 
        FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (memberCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền truy cập conversation này' 
      });
    }

    // Lấy tin nhắn
    const messages = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT 
          m.message_id,
          m.message_text,
          m.message_type,
          m.sender_id,
          m.receiver_id,
          m.is_read,
          m.read_at,
          m.is_recalled,
          m.recalled_at,
          m.file_url,
          m.file_name,
          m.file_size,
          m.file_type,
          DATEADD(HOUR, 7, m.created_at) as created_at,
          sender.username as sender_username,
          sender.display_name as sender_display_name,
          sender.full_name as sender_full_name,
          sender.avatar_url as sender_avatar_url
        FROM Messages m
        INNER JOIN Users sender ON m.sender_id = sender.user_id
        WHERE m.conversation_id = @conversation_id AND m.is_deleted = 0
        ORDER BY m.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    // Lấy reactions cho từng tin nhắn
    const messageIds = messages.recordset.map(m => m.message_id);
    let reactionsMap = {};

    if (messageIds.length > 0) {
      const reactionsResult = await pool.request()
        .query(`
          SELECT 
            message_id,
            emoji,
            COUNT(*) as count,
            STRING_AGG(CAST(user_id AS NVARCHAR(MAX)), ',') as user_ids
          FROM MessageReactions
          WHERE message_id IN (${messageIds.join(',')})
          GROUP BY message_id, emoji
        `);

      // Tạo map reactions theo message_id
      reactionsResult.recordset.forEach(r => {
        if (!reactionsMap[r.message_id]) {
          reactionsMap[r.message_id] = [];
        }
        reactionsMap[r.message_id].push({
          emoji: r.emoji,
          count: r.count,
          userIds: r.user_ids ? r.user_ids.split(',').map(id => parseInt(id)) : []
        });
      });
    }

    // Thêm reactions vào messages
    const messagesWithReactions = messages.recordset.map(msg => ({
      ...msg,
      reactions: reactionsMap[msg.message_id] || []
    }));

    res.json({
      success: true,
      data: {
        messages: messagesWithReactions.reverse()
      }
    });

  } catch (error) {
    console.error('Lỗi lấy messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi lấy tin nhắn' 
    });
  }
});

// Đánh dấu tin nhắn đã đọc
router.post('/:conversationId/mark-read', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        UPDATE Messages 
        SET is_read = 1, read_at = GETDATE()
        WHERE conversation_id = @conversation_id 
          AND receiver_id = @user_id 
          AND is_read = 0
      `);

    res.json({
      success: true,
      message: 'Đã đánh dấu đã đọc'
    });

  } catch (error) {
    console.error('Lỗi mark read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Xóa conversation (soft delete)
router.delete('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        UPDATE ConversationParticipants 
        SET is_active = 0
        WHERE conversation_id = @conversation_id AND user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Đã xóa conversation'
    });

  } catch (error) {
    console.error('Lỗi xóa conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Tìm kiếm tin nhắn trong conversation
router.get('/:conversationId/search', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { keyword } = req.query;

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu từ khóa tìm kiếm' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền truy cập
    const memberCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT participant_id 
        FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (memberCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền truy cập' 
      });
    }

    // Tìm kiếm tin nhắn
    const result = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('keyword', sql.NVarChar, `%${keyword}%`)
      .query(`
        SELECT TOP 50
          m.message_id,
          m.message_text,
          m.message_type,
          m.sender_id,
          DATEADD(HOUR, 7, m.created_at) as created_at,
          sender.username as sender_username,
          sender.display_name as sender_display_name,
          sender.full_name as sender_full_name,
          sender.avatar_url as sender_avatar_url
        FROM Messages m
        INNER JOIN Users sender ON m.sender_id = sender.user_id
        WHERE m.conversation_id = @conversation_id 
          AND m.is_deleted = 0
          AND m.message_text LIKE @keyword
        ORDER BY m.created_at DESC
      `);

    res.json({
      success: true,
      data: {
        results: result.recordset,
        count: result.recordset.length
      }
    });

  } catch (error) {
    console.error('Lỗi search messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Lấy media (ảnh/file) trong conversation
router.get('/:conversationId/media', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { type = 'all' } = req.query; // 'all', 'image', 'file'

    const pool = await getPool();

    // Kiểm tra quyền truy cập
    const memberCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT participant_id 
        FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (memberCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền truy cập' 
      });
    }

    // Build query based on type
    let typeCondition = '';
    if (type === 'image') {
      typeCondition = "AND m.message_type = 'image'";
    } else if (type === 'file') {
      typeCondition = "AND m.message_type = 'file'";
    } else {
      typeCondition = "AND m.message_type IN ('image', 'file')";
    }

    const result = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .query(`
        SELECT 
          m.message_id,
          m.message_text,
          m.message_type,
          m.sender_id,
          m.file_url,
          m.file_name,
          m.file_size,
          m.file_type,
          DATEADD(HOUR, 7, m.created_at) as created_at,
          sender.username as sender_username,
          sender.display_name as sender_display_name,
          sender.full_name as sender_full_name,
          sender.avatar_url as sender_avatar_url
        FROM Messages m
        INNER JOIN Users sender ON m.sender_id = sender.user_id
        WHERE m.conversation_id = @conversation_id 
          AND m.is_deleted = 0
          ${typeCondition}
        ORDER BY m.created_at DESC
      `);

    res.json({
      success: true,
      data: {
        media: result.recordset,
        count: result.recordset.length
      }
    });

  } catch (error) {
    console.error('Lỗi lấy media:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Thu hồi tin nhắn
router.post('/:conversationId/messages/:messageId/recall', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId, messageId } = req.params;

    const pool = await getPool();

    // Kiểm tra tin nhắn có tồn tại và thuộc về user này không
    const messageCheck = await pool.request()
      .input('message_id', sql.Int, messageId)
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT message_id, sender_id, is_recalled, created_at
        FROM Messages
        WHERE message_id = @message_id 
          AND conversation_id = @conversation_id
          AND sender_id = @user_id
          AND is_deleted = 0
      `);

    if (messageCheck.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy tin nhắn hoặc bạn không có quyền thu hồi' 
      });
    }

    const message = messageCheck.recordset[0];

    // Kiểm tra đã thu hồi chưa
    if (message.is_recalled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tin nhắn đã được thu hồi trước đó' 
      });
    }

    // Kiểm tra thời gian (optional - chỉ cho phép thu hồi trong 24h)
    // const messageAge = Date.now() - new Date(message.created_at).getTime();
    // const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    // if (messageAge > maxAge) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: 'Chỉ có thể thu hồi tin nhắn trong vòng 24 giờ' 
    //   });
    // }

    // Thu hồi tin nhắn
    await pool.request()
      .input('message_id', sql.Int, messageId)
      .query(`
        UPDATE Messages 
        SET is_recalled = 1,
            recalled_at = GETDATE()
        WHERE message_id = @message_id
      `);

    res.json({
      success: true,
      message: 'Đã thu hồi tin nhắn',
      data: {
        messageId: parseInt(messageId),
        conversationId: parseInt(conversationId),
        recalledAt: new Date()
      }
    });

  } catch (error) {
    console.error('Lỗi thu hồi tin nhắn:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

module.exports = router;