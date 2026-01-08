const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Tạo group chat mới
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { groupName, memberIds, description } = req.body;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên nhóm không được để trống' 
      });
    }

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phải có ít nhất 1 thành viên' 
      });
    }

    const pool = await getPool();

    // Tạo conversation mới
    const newConv = await pool.request()
      .input('conversation_type', sql.NVarChar, 'group')
      .input('group_name', sql.NVarChar, groupName.trim())
      .input('created_by', sql.Int, userId)
      .input('group_description', sql.NVarChar, description || null)
      .query(`
        INSERT INTO Conversations (conversation_type, group_name, created_by, group_description)
        OUTPUT INSERTED.conversation_id
        VALUES (@conversation_type, @group_name, @created_by, @group_description)
      `);

    const conversationId = newConv.recordset[0].conversation_id;

    // Thêm creator vào group với role admin
    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .input('role', sql.NVarChar, 'admin')
      .query(`
        INSERT INTO ConversationParticipants (conversation_id, user_id, role)
        VALUES (@conversation_id, @user_id, @role)
      `);

    // Thêm các thành viên khác với role member
    for (const memberId of memberIds) {
      if (memberId !== userId) { // Không thêm creator 2 lần
        await pool.request()
          .input('conversation_id', sql.Int, conversationId)
          .input('user_id', sql.Int, memberId)
          .input('role', sql.NVarChar, 'member')
          .query(`
            INSERT INTO ConversationParticipants (conversation_id, user_id, role)
            VALUES (@conversation_id, @user_id, @role)
          `);
      }
    }

    // Lấy thông tin group vừa tạo
    const groupInfo = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT 
          c.conversation_id,
          c.group_name,
          c.group_description,
          c.group_avatar_url,
          c.conversation_type,
          c.created_by,
          c.created_at,
          (SELECT COUNT(*) FROM ConversationParticipants 
           WHERE conversation_id = c.conversation_id AND is_active = 1) as member_count,
          cp.role as user_role
        FROM Conversations c
        INNER JOIN ConversationParticipants cp ON c.conversation_id = cp.conversation_id
        WHERE c.conversation_id = @conversation_id AND cp.user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Tạo nhóm thành công',
      data: groupInfo.recordset[0]
    });

  } catch (error) {
    console.error('Lỗi tạo group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi tạo nhóm' 
    });
  }
});

// Lấy thông tin chi tiết group
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const pool = await getPool();

    // Kiểm tra user có trong group không
    const memberCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT participant_id, role
        FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (memberCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xem nhóm này' 
      });
    }

    // Lấy thông tin group
    const groupInfo = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .query(`
        SELECT 
          c.conversation_id,
          c.group_name,
          c.group_description,
          c.group_avatar_url,
          c.conversation_type,
          c.created_by,
          c.created_at,
          creator.username as creator_username,
          creator.display_name as creator_display_name,
          creator.full_name as creator_full_name
        FROM Conversations c
        LEFT JOIN Users creator ON c.created_by = creator.user_id
        WHERE c.conversation_id = @conversation_id
      `);

    // Lấy danh sách thành viên
    const members = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .query(`
        SELECT 
          cp.user_id,
          cp.role,
          cp.nickname,
          cp.joined_at,
          u.username,
          u.display_name,
          u.full_name,
          u.avatar_url,
          u.is_online
        FROM ConversationParticipants cp
        INNER JOIN Users u ON cp.user_id = u.user_id
        WHERE cp.conversation_id = @conversation_id AND cp.is_active = 1
        ORDER BY cp.role DESC, cp.joined_at ASC
      `);

    res.json({
      success: true,
      data: {
        group: groupInfo.recordset[0],
        members: members.recordset,
        userRole: memberCheck.recordset[0].role
      }
    });

  } catch (error) {
    console.error('Lỗi lấy group info:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Thêm thành viên vào group
router.post('/:conversationId/add-members', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { memberIds } = req.body;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phải chọn ít nhất 1 thành viên' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền admin
    const roleCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT role FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (roleCheck.recordset.length === 0 || roleCheck.recordset[0].role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có thể thêm thành viên' 
      });
    }

    // Thêm từng thành viên
    const added = [];
    for (const memberId of memberIds) {
      // Kiểm tra đã có trong group chưa
      const existCheck = await pool.request()
        .input('conversation_id', sql.Int, conversationId)
        .input('user_id', sql.Int, memberId)
        .query(`
          SELECT participant_id FROM ConversationParticipants 
          WHERE conversation_id = @conversation_id AND user_id = @user_id
        `);

      if (existCheck.recordset.length === 0) {
        // Thêm mới
        await pool.request()
          .input('conversation_id', sql.Int, conversationId)
          .input('user_id', sql.Int, memberId)
          .input('role', sql.NVarChar, 'member')
          .query(`
            INSERT INTO ConversationParticipants (conversation_id, user_id, role)
            VALUES (@conversation_id, @user_id, @role)
          `);
        added.push(memberId);
      } else {
        // Reactive nếu đã tồn tại nhưng bị xóa
        await pool.request()
          .input('conversation_id', sql.Int, conversationId)
          .input('user_id', sql.Int, memberId)
          .query(`
            UPDATE ConversationParticipants 
            SET is_active = 1, joined_at = GETDATE()
            WHERE conversation_id = @conversation_id AND user_id = @user_id
          `);
        added.push(memberId);
      }
    }

    res.json({
      success: true,
      message: `Đã thêm ${added.length} thành viên`,
      data: { added }
    });

  } catch (error) {
    console.error('Lỗi thêm members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Xóa thành viên khỏi group
router.post('/:conversationId/remove-member', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin thành viên' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền admin
    const roleCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT role FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (roleCheck.recordset.length === 0 || roleCheck.recordset[0].role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có thể xóa thành viên' 
      });
    }

    // Không cho xóa chính mình
    if (memberId === userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể xóa chính mình. Hãy dùng chức năng rời nhóm' 
      });
    }

    // Xóa (soft delete)
    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, memberId)
      .query(`
        UPDATE ConversationParticipants 
        SET is_active = 0
        WHERE conversation_id = @conversation_id AND user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Đã xóa thành viên'
    });

  } catch (error) {
    console.error('Lỗi xóa member:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Rời nhóm
router.post('/:conversationId/leave', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const pool = await getPool();

    // Kiểm tra có phải creator không
    const convInfo = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .query(`
        SELECT created_by FROM Conversations WHERE conversation_id = @conversation_id
      `);

    if (convInfo.recordset.length > 0 && convInfo.recordset[0].created_by === userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Người tạo nhóm không thể rời nhóm. Hãy chuyển quyền admin cho người khác trước' 
      });
    }

    // Rời nhóm
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
      message: 'Đã rời nhóm'
    });

  } catch (error) {
    console.error('Lỗi rời nhóm:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Đổi tên nhóm
router.put('/:conversationId/name', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { groupName } = req.body;

    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên nhóm không được để trống' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền admin
    const roleCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT role FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (roleCheck.recordset.length === 0 || roleCheck.recordset[0].role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có thể đổi tên nhóm' 
      });
    }

    // Cập nhật tên
    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('group_name', sql.NVarChar, groupName.trim())
      .query(`
        UPDATE Conversations 
        SET group_name = @group_name, updated_at = GETDATE()
        WHERE conversation_id = @conversation_id
      `);

    res.json({
      success: true,
      message: 'Đã đổi tên nhóm'
    });

  } catch (error) {
    console.error('Lỗi đổi tên:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Phân quyền admin
router.post('/:conversationId/promote', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin thành viên' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền admin
    const roleCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT role FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (roleCheck.recordset.length === 0 || roleCheck.recordset[0].role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có thể phân quyền' 
      });
    }

    // Phân quyền
    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, memberId)
      .input('role', sql.NVarChar, 'admin')
      .query(`
        UPDATE ConversationParticipants 
        SET role = @role
        WHERE conversation_id = @conversation_id AND user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Đã phân quyền admin'
    });

  } catch (error) {
    console.error('Lỗi phân quyền:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Upload avatar cho group
router.post('/:conversationId/upload-avatar', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { conversationId } = req.params;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu URL avatar' 
      });
    }

    const pool = await getPool();

    // Kiểm tra quyền admin
    const roleCheck = await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT role FROM ConversationParticipants 
        WHERE conversation_id = @conversation_id AND user_id = @user_id AND is_active = 1
      `);

    if (roleCheck.recordset.length === 0 || roleCheck.recordset[0].role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới có thể thay đổi ảnh nhóm' 
      });
    }

    // Cập nhật avatar
    await pool.request()
      .input('conversation_id', sql.Int, conversationId)
      .input('group_avatar_url', sql.NVarChar, avatarUrl)
      .query(`
        UPDATE Conversations 
        SET group_avatar_url = @group_avatar_url, updated_at = GETDATE()
        WHERE conversation_id = @conversation_id
      `);

    res.json({
      success: true,
      message: 'Đã cập nhật ảnh nhóm'
    });

  } catch (error) {
    console.error('Lỗi upload group avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

module.exports = router;