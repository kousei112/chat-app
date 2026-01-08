const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { getPool, sql } = require('./config/database');
const { createTables } = require('./config/initDatabase');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const uploadRoutes = require('./routes/upload');
const groupRoutes = require('./routes/groups');
const reactionRoutes = require('./routes/reactions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files (uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/reactions', reactionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server đang hoạt động' });
});

// Lưu trữ socket của người dùng online
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('Socket kết nối:', socket.id);

  // Khi người dùng join với token
  socket.on('join', async (data) => {
    try {
      const { userId, username, displayName, token } = data;
      
      // Lưu mapping socket
      userSockets.set(userId, socket.id);
      socket.userId = userId;
      socket.username = username;

      const pool = await getPool();

      // Cập nhật trạng thái online
      await pool.request()
        .input('user_id', sql.Int, userId)
        .query('UPDATE Users SET is_online = 1, last_seen = GETDATE() WHERE user_id = @user_id');

      // Tạo session
      await pool.request()
        .input('user_id', sql.Int, userId)
        .input('socket_id', sql.NVarChar, socket.id)
        .query('INSERT INTO UserSessions (user_id, socket_id) VALUES (@user_id, @socket_id)');

      console.log(`${username} (ID: ${userId}) đã tham gia chat`);

      // Lấy danh sách người dùng online
      const onlineUsers = await pool.request().query(`
        SELECT user_id, username, display_name, avatar_url, is_online
        FROM Users
        WHERE is_online = 1
      `);

      // Gửi danh sách người dùng online cho tất cả
      io.emit('users-update', onlineUsers.recordset);

      // Lấy lịch sử tin nhắn từ database (50 tin gần nhất)
      const messages = await pool.request()
        .input('room_id', sql.Int, 1)
        .query(`
          SELECT TOP 50
            m.message_id as id,
            m.message_text as text,
            m.created_at as timestamp,
            u.user_id as userId,
            u.username,
            u.display_name as displayName,
            u.avatar_url as avatarUrl
          FROM Messages m
          INNER JOIN Users u ON m.user_id = u.user_id
          WHERE m.room_id = @room_id AND m.is_deleted = 0
          ORDER BY m.created_at DESC
        `);

      // Gửi lịch sử tin nhắn cho người dùng mới (đảo ngược để hiển thị đúng thứ tự)
      socket.emit('message-history', messages.recordset.reverse());

      // Thông báo người dùng mới join
      io.emit('user-joined', {
        userId,
        username,
        displayName,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Lỗi khi join:', error);
      socket.emit('error', { message: 'Lỗi khi tham gia chat' });
    }
  });

  // Nhận tin nhắn từ client
  socket.on('send-private-message', async (messageData) => {
    try {
      const { conversationId, receiverId, text, fileUrl, fileName, fileSize, fileType, messageType } = messageData;
      const senderId = socket.userId;
      
      if (!senderId) {
        socket.emit('error', { message: 'Chưa đăng nhập' });
        return;
      }

      const pool = await getPool();

      // Kiểm tra user có trong conversation không
      const memberCheck = await pool.request()
        .input('conversation_id', sql.Int, conversationId)
        .input('sender_id', sql.Int, senderId)
        .query(`
          SELECT participant_id 
          FROM ConversationParticipants 
          WHERE conversation_id = @conversation_id AND user_id = @sender_id AND is_active = 1
        `);

      if (memberCheck.recordset.length === 0) {
        socket.emit('error', { message: 'Không có quyền gửi tin nhắn' });
        return;
      }

      // Lưu tin nhắn vào database
      const result = await pool.request()
        .input('conversation_id', sql.Int, conversationId)
        .input('sender_id', sql.Int, senderId)
        .input('receiver_id', sql.Int, receiverId)
        .input('message_text', sql.NVarChar, text || '')
        .input('message_type', sql.NVarChar, messageType || 'text')
        .input('file_url', sql.NVarChar, fileUrl || null)
        .input('file_name', sql.NVarChar, fileName || null)
        .input('file_size', sql.BigInt, fileSize || null)
        .input('file_type', sql.NVarChar, fileType || null)
        .query(`
          INSERT INTO Messages (
            conversation_id, sender_id, receiver_id, message_text, message_type,
            file_url, file_name, file_size, file_type, user_id
          )
          OUTPUT 
            INSERTED.message_id, 
            DATEADD(HOUR, 7, INSERTED.created_at) as created_at
          VALUES (
            @conversation_id, @sender_id, @receiver_id, @message_text, @message_type,
            @file_url, @file_name, @file_size, @file_type, @sender_id
          )
        `);

      const messageId = result.recordset[0].message_id;
      const createdAt = result.recordset[0].created_at;

      // Cập nhật updated_at của conversation
      await pool.request()
        .input('conversation_id', sql.Int, conversationId)
        .query('UPDATE Conversations SET updated_at = GETDATE() WHERE conversation_id = @conversation_id');

      // Lấy thông tin sender
      const userInfo = await pool.request()
        .input('sender_id', sql.Int, senderId)
        .query('SELECT username, display_name, full_name, avatar_url FROM Users WHERE user_id = @sender_id');

      const sender = userInfo.recordset[0];

      // Tạo message object
      const message = {
        message_id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
        message_text: text || '',
        message_type: messageType || 'text',
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        file_type: fileType || null,
        is_read: false,
        created_at: createdAt,
        sender_username: sender.username,
        sender_display_name: sender.display_name,
        sender_full_name: sender.full_name,
        sender_avatar_url: sender.avatar_url
      };

      // Gửi tin nhắn cho cả sender và receiver
      socket.emit('receive-private-message', message);
      
      // Gửi cho receiver nếu họ online
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive-private-message', message);
        io.to(receiverSocketId).emit('new-message-notification', {
          conversationId,
          senderId,
          senderName: sender.display_name || sender.username,
          messageText: text
        });
      }

    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      socket.emit('error', { message: 'Lỗi khi gửi tin nhắn' });
    }
  });

  // Khi người dùng đang gõ
  socket.on('typing', (data) => {
    const { conversationId, userId, username } = data;
    if (conversationId && userId && username) {
      // Broadcast cho tất cả người trong conversation trừ người gửi
      socket.broadcast.emit('user-typing', {
        conversationId,
        userId,
        username
      });
    }
  });

  // Khi người dùng ngừng gõ
  socket.on('stop-typing', (data) => {
    const { conversationId } = data;
    if (conversationId) {
      socket.broadcast.emit('user-stop-typing', {
        conversationId
      });
    }
  });

  // Khi người dùng disconnect
  socket.on('disconnect', async () => {
    try {
      const userId = socket.userId;
      const username = socket.username;

      if (userId) {
        const pool = await getPool();

        // Cập nhật trạng thái offline
        await pool.request()
          .input('user_id', sql.Int, userId)
          .query(`
            UPDATE Users SET is_online = 0, last_seen = GETDATE() WHERE user_id = @user_id;
            UPDATE UserSessions SET logout_time = GETDATE(), is_active = 0 
            WHERE socket_id = '${socket.id}' AND is_active = 1;
          `);

        console.log(`${username} (ID: ${userId}) đã rời khỏi chat`);
        userSockets.delete(userId);

        // Lấy danh sách người dùng online còn lại
        const onlineUsers = await pool.request().query(`
          SELECT user_id, username, display_name, avatar_url, is_online
          FROM Users
          WHERE is_online = 1
        `);

        // Cập nhật danh sách người dùng
        io.emit('users-update', onlineUsers.recordset);

        // Thông báo người dùng rời
        io.emit('user-left', {
          userId,
          username,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Lỗi khi disconnect:', error);
    }
  });

  socket.on('message-reaction', (data) => {
  const { conversationId, messageId, reactions } = data;
  
  // Broadcast reaction update đến tất cả users trong conversation
  io.emit('message-reaction-update', {
    conversationId,
    messageId,
    reactions
  });
  });
});

const PORT = process.env.PORT || 5000;

// Khởi tạo database và chạy server
const startServer = async () => {
  try {
    console.log('🔄 Đang kết nối database...');
    await getPool();
    console.log('✅ Kết nối database thành công!');

    console.log('🔄 Đang khởi tạo tables...');
    await createTables();

    server.listen(PORT, () => {
      console.log(`\n🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log('📡 Socket.IO đã sẵn sàng');
      console.log('💾 Database: Connected');
      console.log('\n✨ Sẵn sàng nhận kết nối!\n');
    });

  } catch (error) {
    console.error('❌ Lỗi khi khởi động server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  console.log('\n🛑 Đang tắt server...');
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});