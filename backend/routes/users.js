const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getPool, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Lấy thông tin profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const pool = await getPool();

    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT 
          user_id,
          username,
          email,
          display_name,
          full_name,
          date_of_birth,
          gender,
          avatar_url,
          profile_completed,
          created_at
        FROM Users 
        WHERE user_id = @user_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy người dùng' 
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Lỗi lấy profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi lấy thông tin profile' 
    });
  }
});

// Cập nhật thông tin profile (lần đầu sau khi đăng ký)
router.post('/complete-profile', [
  authMiddleware,
  body('fullName').trim().notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2-100 ký tự'),
  body('dateOfBirth').isISO8601().withMessage('Ngày sinh không hợp lệ')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 13 || age > 120) {
        throw new Error('Tuổi phải từ 13-120');
      }
      return true;
    }),
  body('gender').isIn(['Nam', 'Nữ', 'Khác']).withMessage('Giới tính không hợp lệ')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { userId } = req.user;
    const { fullName, dateOfBirth, gender } = req.body;
    const pool = await getPool();

    // Kiểm tra xem profile đã hoàn thành chưa
    const checkResult = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT profile_completed FROM Users WHERE user_id = @user_id');

    if (checkResult.recordset[0].profile_completed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Profile đã được hoàn thành' 
      });
    }

    // Cập nhật thông tin profile
    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .input('full_name', sql.NVarChar, fullName)
      .input('date_of_birth', sql.Date, dateOfBirth)
      .input('gender', sql.NVarChar, gender)
      .query(`
        UPDATE Users 
        SET 
          full_name = @full_name,
          date_of_birth = @date_of_birth,
          gender = @gender,
          profile_completed = 1,
          updated_at = GETDATE()
        OUTPUT 
          INSERTED.user_id,
          INSERTED.username,
          INSERTED.email,
          INSERTED.display_name,
          INSERTED.full_name,
          INSERTED.date_of_birth,
          INSERTED.gender,
          INSERTED.profile_completed
        WHERE user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Hoàn thành thông tin profile thành công',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Lỗi cập nhật profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi cập nhật profile' 
    });
  }
});

// Cập nhật profile (sau khi đã hoàn thành lần đầu)
router.put('/profile', [
  authMiddleware,
  body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['Nam', 'Nữ', 'Khác']),
  body('displayName').optional().trim().isLength({ min: 2, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { userId } = req.user;
    const { fullName, dateOfBirth, gender, displayName } = req.body;
    const pool = await getPool();

    // Build dynamic update query
    let updateFields = [];
    let inputs = { user_id: userId };

    if (fullName) {
      updateFields.push('full_name = @full_name');
      inputs.full_name = fullName;
    }
    if (dateOfBirth) {
      updateFields.push('date_of_birth = @date_of_birth');
      inputs.date_of_birth = dateOfBirth;
    }
    if (gender) {
      updateFields.push('gender = @gender');
      inputs.gender = gender;
    }
    if (displayName) {
      updateFields.push('display_name = @display_name');
      inputs.display_name = displayName;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có thông tin để cập nhật' 
      });
    }

    updateFields.push('updated_at = GETDATE()');

    const request = pool.request();
    Object.keys(inputs).forEach(key => {
      if (key === 'user_id') {
        request.input(key, sql.Int, inputs[key]);
      } else if (key === 'date_of_birth') {
        request.input(key, sql.Date, inputs[key]);
      } else {
        request.input(key, sql.NVarChar, inputs[key]);
      }
    });

    const result = await request.query(`
      UPDATE Users 
      SET ${updateFields.join(', ')}
      OUTPUT 
        INSERTED.user_id,
        INSERTED.username,
        INSERTED.email,
        INSERTED.display_name,
        INSERTED.full_name,
        INSERTED.date_of_birth,
        INSERTED.gender,
        INSERTED.profile_completed
      WHERE user_id = @user_id
    `);

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Lỗi cập nhật profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi cập nhật profile' 
    });
  }
});

// Lấy danh sách tất cả users (để tìm người chat)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { search } = req.query;
    const pool = await getPool();

    let query = `
      SELECT 
        user_id,
        username,
        display_name,
        full_name,
        avatar_url,
        is_online
      FROM Users
      WHERE user_id != @user_id
        AND profile_completed = 1
    `;

    const request = pool.request().input('user_id', sql.Int, userId);

    if (search) {
      query += ` AND (username LIKE @search OR display_name LIKE @search OR full_name LIKE @search)`;
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    query += ` ORDER BY is_online DESC, display_name ASC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Upload avatar cho user
router.post('/upload-avatar', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu URL avatar' 
      });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .input('avatar_url', sql.NVarChar, avatarUrl)
      .query(`
        UPDATE Users 
        SET avatar_url = @avatar_url
        OUTPUT 
          INSERTED.user_id,
          INSERTED.username,
          INSERTED.email,
          INSERTED.display_name,
          INSERTED.full_name,
          INSERTED.avatar_url
        WHERE user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Cập nhật avatar thành công',
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Lỗi upload avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Update theme preference
router.post('/update-theme', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { theme } = req.body;

    if (!theme || !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Theme không hợp lệ. Chỉ chấp nhận: light, dark' 
      });
    }

    const pool = await getPool();

    await pool.request()
      .input('user_id', sql.Int, userId)
      .input('theme', sql.NVarChar, theme)
      .query(`
        UPDATE Users 
        SET theme = @theme
        WHERE user_id = @user_id
      `);

    res.json({
      success: true,
      message: 'Cập nhật theme thành công',
      data: { theme }
    });

  } catch (error) {
    console.error('Lỗi update theme:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

module.exports = router;