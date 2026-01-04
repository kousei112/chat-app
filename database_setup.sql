-- =============================================
-- Chat App Database Setup Script
-- Chạy script này trong SQL Server Management Studio (SSMS)
-- =============================================

-- Tạo Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ChatAppDB')
BEGIN
    CREATE DATABASE ChatAppDB;
    PRINT 'Database ChatAppDB đã được tạo';
END
ELSE
BEGIN
    PRINT 'Database ChatAppDB đã tồn tại';
END
GO

USE ChatAppDB;
GO

-- =============================================
-- Tạo bảng Users
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
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
    );
    PRINT 'Bảng Users đã được tạo';
END
GO

-- =============================================
-- Tạo bảng ChatRooms
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatRooms' AND xtype='U')
BEGIN
    CREATE TABLE ChatRooms (
        room_id INT PRIMARY KEY IDENTITY(1,1),
        room_name NVARCHAR(100) NOT NULL,
        room_type NVARCHAR(20) DEFAULT 'public',
        created_by INT FOREIGN KEY REFERENCES Users(user_id),
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'Bảng ChatRooms đã được tạo';
END
GO

-- =============================================
-- Tạo bảng Messages
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
BEGIN
    CREATE TABLE Messages (
        message_id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT FOREIGN KEY REFERENCES Users(user_id),
        room_id INT FOREIGN KEY REFERENCES ChatRooms(room_id) DEFAULT 1,
        message_text NVARCHAR(MAX) NOT NULL,
        message_type NVARCHAR(20) DEFAULT 'text',
        is_deleted BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'Bảng Messages đã được tạo';
END
GO

-- =============================================
-- Tạo bảng UserSessions
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserSessions' AND xtype='U')
BEGIN
    CREATE TABLE UserSessions (
        session_id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT FOREIGN KEY REFERENCES Users(user_id),
        socket_id NVARCHAR(255),
        login_time DATETIME DEFAULT GETDATE(),
        logout_time DATETIME,
        is_active BIT DEFAULT 1
    );
    PRINT 'Bảng UserSessions đã được tạo';
END
GO

-- =============================================
-- Tạo Indexes để tăng hiệu suất
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_UserId')
    CREATE INDEX IX_Messages_UserId ON Messages(user_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_RoomId')
    CREATE INDEX IX_Messages_RoomId ON Messages(room_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Messages_CreatedAt')
    CREATE INDEX IX_Messages_CreatedAt ON Messages(created_at DESC);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_UserSessions_UserId')
    CREATE INDEX IX_UserSessions_UserId ON UserSessions(user_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Users_Username')
    CREATE INDEX IX_Users_Username ON Users(username);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Users_Email')
    CREATE INDEX IX_Users_Email ON Users(email);
GO

PRINT 'Indexes đã được tạo';
GO

-- =============================================
-- Tạo phòng chat mặc định
-- =============================================
IF NOT EXISTS (SELECT * FROM ChatRooms WHERE room_id = 1)
BEGIN
    SET IDENTITY_INSERT ChatRooms ON;
    
    INSERT INTO ChatRooms (room_id, room_name, room_type, created_at)
    VALUES (1, N'Phòng Chat Chung', 'public', GETDATE());
    
    SET IDENTITY_INSERT ChatRooms OFF;
    
    PRINT 'Phòng chat mặc định đã được tạo';
END
GO

-- =============================================
-- Xem thông tin các bảng
-- =============================================
PRINT '================================================';
PRINT 'Danh sách các bảng đã được tạo:';
PRINT '================================================';

SELECT 
    TABLE_NAME as [Tên Bảng],
    (SELECT COUNT(*) 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = t.TABLE_NAME) as [Số Cột]
FROM INFORMATION_SCHEMA.TABLES t
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

PRINT '================================================';
PRINT 'Setup hoàn tất! Database đã sẵn sàng sử dụng.';
PRINT '================================================';
GO

-- =============================================
-- Các queries hữu ích để kiểm tra dữ liệu
-- =============================================

-- Xem tất cả users
-- SELECT * FROM Users;

-- Xem tất cả tin nhắn
-- SELECT m.*, u.username, u.display_name 
-- FROM Messages m 
-- INNER JOIN Users u ON m.user_id = u.user_id
-- ORDER BY m.created_at DESC;

-- Xem người dùng online
-- SELECT user_id, username, display_name, is_online, last_seen
-- FROM Users
-- WHERE is_online = 1;

-- Xem sessions đang active
-- SELECT s.*, u.username
-- FROM UserSessions s
-- INNER JOIN Users u ON s.user_id = u.user_id
-- WHERE s.is_active = 1;

-- Đếm số tin nhắn theo user
-- SELECT u.username, u.display_name, COUNT(m.message_id) as total_messages
-- FROM Users u
-- LEFT JOIN Messages m ON u.user_id = m.user_id
-- GROUP BY u.username, u.display_name
-- ORDER BY total_messages DESC;

-- Xóa tất cả dữ liệu (cẩn thận!)
-- TRUNCATE TABLE UserSessions;
-- TRUNCATE TABLE Messages;
-- DELETE FROM Users;
-- DELETE FROM ChatRooms WHERE room_id > 1;
