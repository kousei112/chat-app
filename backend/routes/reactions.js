const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Thêm reaction vào tin nhắn
router.post('/:messageId/react', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu emoji' 
      });
    }

    const pool = await getPool();

    // Kiểm tra tin nhắn có tồn tại không
    const messageCheck = await pool.request()
      .input('message_id', sql.Int, messageId)
      .query('SELECT message_id FROM Messages WHERE message_id = @message_id');

    if (messageCheck.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tin nhắn không tồn tại' 
      });
    }

    // Kiểm tra user đã react emoji này chưa
    const existingReaction = await pool.request()
      .input('message_id', sql.Int, messageId)
      .input('user_id', sql.Int, userId)
      .input('emoji', sql.NVarChar, emoji)
      .query(`
        SELECT reaction_id 
        FROM MessageReactions 
        WHERE message_id = @message_id AND user_id = @user_id AND emoji = @emoji
      `);

    if (existingReaction.recordset.length > 0) {
      // Đã react rồi -> Xóa reaction (toggle off)
      await pool.request()
        .input('reaction_id', sql.Int, existingReaction.recordset[0].reaction_id)
        .query('DELETE FROM MessageReactions WHERE reaction_id = @reaction_id');

      // Lấy reactions còn lại
      const reactions = await getMessageReactions(pool, messageId);

      return res.json({
        success: true,
        action: 'removed',
        data: { reactions }
      });
    } else {
      // Chưa react -> Thêm reaction
      await pool.request()
        .input('message_id', sql.Int, messageId)
        .input('user_id', sql.Int, userId)
        .input('emoji', sql.NVarChar, emoji)
        .query(`
          INSERT INTO MessageReactions (message_id, user_id, emoji)
          VALUES (@message_id, @user_id, @emoji)
        `);

      // Lấy reactions mới
      const reactions = await getMessageReactions(pool, messageId);

      return res.json({
        success: true,
        action: 'added',
        data: { reactions }
      });
    }

  } catch (error) {
    console.error('Lỗi react:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Lấy reactions của tin nhắn
router.get('/:messageId/reactions', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const pool = await getPool();

    const reactions = await getMessageReactions(pool, messageId);

    res.json({
      success: true,
      data: { reactions }
    });

  } catch (error) {
    console.error('Lỗi lấy reactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Xóa reaction
router.delete('/:messageId/react', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { messageId } = req.params;
    const { emoji } = req.body;

    const pool = await getPool();

    await pool.request()
      .input('message_id', sql.Int, messageId)
      .input('user_id', sql.Int, userId)
      .input('emoji', sql.NVarChar, emoji)
      .query(`
        DELETE FROM MessageReactions 
        WHERE message_id = @message_id AND user_id = @user_id AND emoji = @emoji
      `);

    // Lấy reactions còn lại
    const reactions = await getMessageReactions(pool, messageId);

    res.json({
      success: true,
      data: { reactions }
    });

  } catch (error) {
    console.error('Lỗi xóa reaction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Helper function: Lấy reactions của tin nhắn
async function getMessageReactions(pool, messageId) {
  const result = await pool.request()
    .input('message_id', sql.Int, messageId)
    .query(`
      SELECT 
        emoji,
        COUNT(*) as count,
        STRING_AGG(CAST(user_id AS NVARCHAR(MAX)), ',') as user_ids
      FROM MessageReactions
      WHERE message_id = @message_id
      GROUP BY emoji
      ORDER BY COUNT(*) DESC
    `);

  return result.recordset.map(row => ({
    emoji: row.emoji,
    count: row.count,
    userIds: row.user_ids ? row.user_ids.split(',').map(id => parseInt(id)) : []
  }));
}

module.exports = router;