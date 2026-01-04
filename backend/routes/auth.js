const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getPool, sql } = require('../config/database');
const { generateToken } = require('../middleware/auth');

// Đăng ký
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username phải từ 3-50 ký tự'),
  body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự'),
  body('displayName').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { username, email, password, displayName } = req.body;
    const pool = await getPool();

    // Kiểm tra username đã tồn tại
    const userCheck = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .query('SELECT user_id FROM Users WHERE username = @username OR email = @email');

    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username hoặc email đã tồn tại' 
      });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Tạo user mới
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, passwordHash)
      .input('display_name', sql.NVarChar, displayName || username)
      .query(`
        INSERT INTO Users (username, email, password_hash, display_name)
        OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.display_name, INSERTED.email
        VALUES (@username, @email, @password_hash, @display_name)
      `);

    const newUser = result.recordset[0];
    const token = generateToken(newUser.user_id, newUser.username);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        user: {
          userId: newUser.user_id,
          username: newUser.username,
          displayName: newUser.display_name,
          email: newUser.email
        },
        token
      }
    });

  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi đăng ký' 
    });
  }
});

// Đăng nhập
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username không được để trống'),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { username, password } = req.body;
    const pool = await getPool();

    // Tìm user
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT 
          user_id, 
          username, 
          password_hash, 
          display_name, 
          email, 
          avatar_url,
          full_name,
          date_of_birth,
          gender,
          profile_completed
        FROM Users 
        WHERE username = @username
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Username hoặc mật khẩu không đúng' 
      });
    }

    const user = result.recordset[0];

    // Kiểm tra mật khẩu
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Username hoặc mật khẩu không đúng' 
      });
    }

    // Cập nhật trạng thái online
    await pool.request()
      .input('user_id', sql.Int, user.user_id)
      .query('UPDATE Users SET is_online = 1, last_seen = GETDATE() WHERE user_id = @user_id');

    const token = generateToken(user.user_id, user.username);

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          userId: user.user_id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatarUrl: user.avatar_url,
          fullName: user.full_name,
          dateOfBirth: user.date_of_birth,
          gender: user.gender,
          profileCompleted: user.profile_completed
        },
        token
      }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi đăng nhập' 
    });
  }
});

// Đăng xuất
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body;
    const pool = await getPool();

    await pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        UPDATE Users SET is_online = 0, last_seen = GETDATE() WHERE user_id = @user_id;
        UPDATE UserSessions SET logout_time = GETDATE(), is_active = 0 
        WHERE user_id = @user_id AND is_active = 1;
      `);

    res.json({
      success: true,
      message: 'Đăng xuất thành công'
    });

  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi đăng xuất' 
    });
  }
});

module.exports = router;
