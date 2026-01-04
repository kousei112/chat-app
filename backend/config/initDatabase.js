const { sql, getPool } = require('./database');

const createTables = async () => {
  try {
    const pool = await getPool();
    
    console.log('Đang tạo bảng Users...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
      CREATE TABLE Users (
        user_id INT PRIMARY KEY IDENTITY(1,1),
        username NVARCHAR(50) UNIQUE NOT NULL,
        email NVARCHAR(100) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        display_name NVARCHAR(100),
        full_name NVARCHAR(100),
        date_of_birth DATE,
        gender NVARCHAR(20),
        avatar_url NVARCHAR(255),
        profile_completed BIT DEFAULT 0,
        is_online BIT DEFAULT 0,
        last_seen DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('Đang tạo bảng Messages...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
      CREATE TABLE Messages (
        message_id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT FOREIGN KEY REFERENCES Users(user_id),
        room_id INT DEFAULT 1,
        message_text NVARCHAR(MAX) NOT NULL,
        message_type NVARCHAR(20) DEFAULT 'text',
        is_deleted BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('Đang tạo bảng ChatRooms...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatRooms' AND xtype='U')
      CREATE TABLE ChatRooms (
        room_id INT PRIMARY KEY IDENTITY(1,1),
        room_name NVARCHAR(100) NOT NULL,
        room_type NVARCHAR(20) DEFAULT 'public',
        created_by INT FOREIGN KEY REFERENCES Users(user_id),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    console.log('Đang tạo bảng UserSessions...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserSessions' AND xtype='U')
      CREATE TABLE UserSessions (
        session_id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT FOREIGN KEY REFERENCES Users(user_id),
        socket_id NVARCHAR(255),
        login_time DATETIME DEFAULT GETDATE(),
        logout_time DATETIME,
        is_active BIT DEFAULT 1
      )
    `);

    console.log('Đang tạo phòng chat mặc định...');
    const roomCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM ChatRooms WHERE room_id = 1
    `);
    
    if (roomCheck.recordset[0].count === 0) {
      await pool.request().query(`
        SET IDENTITY_INSERT ChatRooms ON;
        INSERT INTO ChatRooms (room_id, room_name, room_type, created_at)
        VALUES (1, N'Phòng Chat Chung', 'public', GETDATE());
        SET IDENTITY_INSERT ChatRooms OFF;
      `);
    }

    console.log('Đang tạo indexes...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_UserId')
      CREATE INDEX IX_Messages_UserId ON Messages(user_id);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_RoomId')
      CREATE INDEX IX_Messages_RoomId ON Messages(room_id);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_CreatedAt')
      CREATE INDEX IX_Messages_CreatedAt ON Messages(created_at DESC);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_UserSessions_UserId')
      CREATE INDEX IX_UserSessions_UserId ON UserSessions(user_id);
    `);

    console.log('✅ Database được khởi tạo thành công!');
    console.log('📋 Các bảng đã được tạo:');
    console.log('   - Users (Quản lý người dùng)');
    console.log('   - Messages (Lưu tin nhắn)');
    console.log('   - ChatRooms (Quản lý phòng chat)');
    console.log('   - UserSessions (Theo dõi phiên đăng nhập)');
    
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo database:', error);
    throw error;
  }
};

module.exports = { createTables };
