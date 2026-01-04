const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Lấy lịch sử tin nhắn
router.get('/history/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('room_id', sql.Int, roomId)
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, parseInt(offset))
      .query(`
        SELECT 
          m.message_id,
          m.message_text,
          m.message_type,
          m.created_at,
          u.user_id,
          u.username,
          u.display_name,
          u.avatar_url
        FROM Messages m
        INNER JOIN Users u ON m.user_id = u.user_id
        WHERE m.room_id = @room_id AND m.is_deleted = 0
        ORDER BY m.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json({
      success: true,
      data: {
        messages: result.recordset.reverse(),
        total: result.recordset.length
      }
    });

  } catch (error) {
    console.error('Lỗi lấy lịch sử tin nhắn:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi lấy lịch sử tin nhắn' 
    });
  }
});

// Xóa tin nhắn
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.user;
    const pool = await getPool();

    // Kiểm tra quyền sở hữu
    const checkResult = await pool.request()
      .input('message_id', sql.Int, messageId)
      .input('user_id', sql.Int, userId)
      .query('SELECT user_id FROM Messages WHERE message_id = @message_id');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy tin nhắn' 
      });
    }

    if (checkResult.recordset[0].user_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xóa tin nhắn này' 
      });
    }

    // Soft delete
    await pool.request()
      .input('message_id', sql.Int, messageId)
      .query('UPDATE Messages SET is_deleted = 1 WHERE message_id = @message_id');

    res.json({
      success: true,
      message: 'Xóa tin nhắn thành công'
    });

  } catch (error) {
    console.error('Lỗi xóa tin nhắn:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi xóa tin nhắn' 
    });
  }
});

// Tìm kiếm tin nhắn
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { keyword, roomId = 1 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('keyword', sql.NVarChar, `%${keyword}%`)
      .input('room_id', sql.Int, roomId)
      .query(`
        SELECT TOP 50
          m.message_id,
          m.message_text,
          m.created_at,
          u.username,
          u.display_name
        FROM Messages m
        INNER JOIN Users u ON m.user_id = u.user_id
        WHERE m.room_id = @room_id 
          AND m.is_deleted = 0
          AND m.message_text LIKE @keyword
        ORDER BY m.created_at DESC
      `);

    res.json({
      success: true,
      data: {
        messages: result.recordset,
        count: result.recordset.length
      }
    });

  } catch (error) {
    console.error('Lỗi tìm kiếm tin nhắn:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi tìm kiếm tin nhắn' 
    });
  }
});

module.exports = router;
