# 💬 Ứng Dụng Chat Realtime với SQL Server

Ứng dụng chat realtime hoàn chỉnh với React, Node.js, Express, Socket.IO và SQL Server (SSMS).

## 🚀 Tính Năng

### Bảo mật & Xác thực
- ✅ Đăng ký tài khoản với email validation
- ✅ Đăng nhập với JWT authentication
- ✅ Mật khẩu được mã hóa với bcrypt
- ✅ Session management với database
- ✅ Yêu cầu hoàn thành thông tin cá nhân sau đăng ký

### Quản lý Profile
- ✅ Form hoàn thành profile sau đăng ký đầu tiên
- ✅ Lưu thông tin: Họ tên, ngày sinh, giới tính
- ✅ Xem thông tin tài khoản chi tiết
- ✅ Chỉnh sửa thông tin cá nhân
- ✅ Tính tuổi tự động từ ngày sinh

### Chat Realtime
- ✅ Chat realtime với nhiều người dùng
- ✅ Hiển thị danh sách người dùng online
- ✅ Thông báo khi có người join/leave
- ✅ Hiển thị trạng thái "đang gõ"
- ✅ Lưu tin nhắn vào SQL Server
- ✅ Lịch sử trò chuyện được lưu trữ
- ✅ Hiển thị tên hiển thị (display name)

### Database
- ✅ Lưu trữ người dùng với mật khẩu mã hóa
- ✅ Lưu tất cả tin nhắn
- ✅ Theo dõi phiên đăng nhập
- ✅ Quản lý phòng chat

## 📋 Yêu Cầu

- Node.js (phiên bản 14 trở lên)
- SQL Server 2016 trở lên (hoặc SQL Server Express)
- SQL Server Management Studio (SSMS)
- npm hoặc yarn

## 🗄️ Cài Đặt SQL Server

### 1. Cài đặt SQL Server

Nếu chưa có SQL Server, bạn có thể tải:
- **SQL Server Express** (miễn phí): https://www.microsoft.com/sql-server/sql-server-downloads
- **SQL Server Developer** (miễn phí cho dev): https://www.microsoft.com/sql-server/sql-server-downloads

### 2. Cài đặt SSMS

Tải và cài đặt SQL Server Management Studio:
https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms

### 3. Tạo Database

Mở SSMS và chạy lệnh sau để tạo database:

```sql
CREATE DATABASE ChatAppDB;
GO
```

### 4. Tạo SQL Login (nếu cần)

Nếu bạn muốn sử dụng SQL authentication:

```sql
USE master;
GO

CREATE LOGIN chatapp_user WITH PASSWORD = 'YourPassword123';
GO

USE ChatAppDB;
GO

CREATE USER chatapp_user FOR LOGIN chatapp_user;
GO

ALTER ROLE db_owner ADD MEMBER chatapp_user;
GO
```

## 🛠️ Cài Đặt Ứng Dụng

### 1. Backend (Node.js Server)

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt dependencies
npm install

# Cấu hình kết nối database
# Mở file .env và cập nhật thông tin:
```

**File .env:**
```env
# Database Configuration
DB_USER=sa                    # Hoặc username SQL của bạn
DB_PASSWORD=YourPassword123   # Mật khẩu SQL Server
DB_SERVER=localhost           # Hoặc IP server của bạn
DB_DATABASE=ChatAppDB
DB_PORT=1433

# JWT Secret (thay đổi trong production)
JWT_SECRET=your-secret-key-change-this-in-production

# Server Port
PORT=5000
```

**Lưu ý quan trọng:**
- Nếu dùng Windows Authentication, để trống `DB_USER` và `DB_PASSWORD`
- Nếu dùng SQL Authentication, điền username và password
- Đảm bảo SQL Server đang chạy và cho phép TCP/IP connections

```bash
# Chạy server (sẽ tự động tạo tables)
npm start

# Hoặc chạy với nodemon (auto-restart)
npm run dev
```

Server sẽ:
1. Kết nối đến SQL Server
2. Tự động tạo các bảng cần thiết
3. Chạy tại `http://localhost:5000`

### 2. Frontend (React App)

```bash
# Mở terminal mới và di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Chạy ứng dụng React
npm start
```

Ứng dụng sẽ tự động mở tại: `http://localhost:3000`

## 📊 Cấu Trúc Database

### Bảng Users
Lưu trữ thông tin người dùng:
```sql
- user_id (INT, PRIMARY KEY)
- username (NVARCHAR, UNIQUE)
- email (NVARCHAR, UNIQUE)
- password_hash (NVARCHAR) - Mật khẩu mã hóa
- display_name (NVARCHAR)
- full_name (NVARCHAR) - Họ tên đầy đủ
- date_of_birth (DATE) - Ngày sinh
- gender (NVARCHAR) - Giới tính
- avatar_url (NVARCHAR)
- profile_completed (BIT) - Đã hoàn thành profile chưa
- is_online (BIT)
- last_seen (DATETIME)
- created_at (DATETIME)
```

### Bảng Messages
Lưu trữ tin nhắn:
```sql
- message_id (INT, PRIMARY KEY)
- user_id (INT, FOREIGN KEY)
- room_id (INT)
- message_text (NVARCHAR)
- message_type (NVARCHAR)
- is_deleted (BIT)
- created_at (DATETIME)
```

### Bảng ChatRooms
Quản lý phòng chat:
```sql
- room_id (INT, PRIMARY KEY)
- room_name (NVARCHAR)
- room_type (NVARCHAR)
- created_by (INT)
- created_at (DATETIME)
```

### Bảng UserSessions
Theo dõi phiên đăng nhập:
```sql
- session_id (INT, PRIMARY KEY)
- user_id (INT, FOREIGN KEY)
- socket_id (NVARCHAR)
- login_time (DATETIME)
- logout_time (DATETIME)
- is_active (BIT)
```

## 📖 Cách Sử Dụng

### Đăng Ký
1. Mở ứng dụng tại `http://localhost:3000`
2. Click "Đăng ký ngay"
3. Nhập username, email, password và tên hiển thị
4. Click "Đăng ký"

### Hoàn Thành Thông Tin (Lần đầu sau đăng ký)
1. Điền họ và tên đầy đủ
2. Chọn ngày sinh (phải từ 13 tuổi trở lên)
3. Chọn giới tính
4. Click "Hoàn tất"

### Đăng Nhập
1. Nhập username và password
2. Click "Đăng nhập"
3. Nếu đã hoàn thành profile → Vào chat ngay
4. Nếu chưa → Được yêu cầu hoàn thành thông tin

### Xem/Sửa Thông Tin Tài Khoản
1. Trong chat, click button "👤 Tài khoản" ở góc trên bên phải
2. Xem thông tin cá nhân: username, email, họ tên, ngày sinh, tuổi, giới tính
3. Click "✏️ Chỉnh sửa thông tin" để cập nhật
4. Lưu thay đổi

### Chat
- Gõ tin nhắn và nhấn Enter hoặc click "Gửi"
- Xem danh sách người online ở sidebar
- Tin nhắn được lưu tự động vào database

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất

### User Profile
- `GET /api/users/profile` - Lấy thông tin profile
- `POST /api/users/complete-profile` - Hoàn thành profile lần đầu
- `PUT /api/users/profile` - Cập nhật thông tin profile

### Messages
- `GET /api/messages/history/:roomId` - Lấy lịch sử tin nhắn
- `DELETE /api/messages/:messageId` - Xóa tin nhắn
- `GET /api/messages/search` - Tìm kiếm tin nhắn

## 🏗️ Cấu Trúc Dự Án

```
chat-app/
├── backend/
│   ├── config/
│   │   ├── database.js         # Cấu hình SQL Server
│   │   └── initDatabase.js     # Script tạo tables
│   ├── middleware/
│   │   └── auth.js             # JWT middleware
│   ├── routes/
│   │   ├── auth.js             # Routes xác thực
│   │   ├── messages.js         # Routes tin nhắn
│   │   └── users.js            # Routes quản lý profile
│   ├── server.js               # Server chính
│   ├── .env                    # Cấu hình môi trường
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.js            # Component đăng nhập/đăng ký
    │   │   ├── CompleteProfile.js  # Component hoàn thành thông tin
    │   │   ├── UserProfile.js      # Component xem/sửa profile
    │   │   ├── ChatRoom.js         # Component phòng chat
    │   │   └── *.css
    │   ├── services/
    │   │   └── api.js              # API service
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 🔐 Bảo Mật

### Mã Hóa Mật Khẩu
- Sử dụng bcryptjs với salt rounds = 10
- Mật khẩu không bao giờ được lưu dạng plain text
- Hash mật khẩu trước khi lưu vào database

### JWT Token
- Token có thời hạn 7 ngày
- Được lưu trong localStorage
- Tự động gửi trong header của mọi request

### SQL Injection Prevention
- Sử dụng parameterized queries
- Validation input với express-validator

## 🐛 Troubleshooting

### Lỗi kết nối SQL Server

**Lỗi: "Login failed for user"**
- Kiểm tra username/password trong file `.env`
- Đảm bảo user có quyền truy cập database

**Lỗi: "Cannot connect to SQL Server"**
1. Kiểm tra SQL Server đang chạy:
   - Mở SQL Server Configuration Manager
   - Kiểm tra SQL Server service
2. Enable TCP/IP:
   - SQL Server Configuration Manager → SQL Server Network Configuration
   - Enable TCP/IP protocol
3. Kiểm tra firewall cho phép port 1433

**Lỗi: "Self-signed certificate"**
- Thêm `trustServerCertificate: true` trong config (đã có sẵn)

### Lỗi Backend

**Port 5000 đã được sử dụng:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

**Database không tự động tạo:**
- Chạy script thủ công trong SSMS (copy từ initDatabase.js)

### Lỗi Frontend

**CORS Error:**
- Đảm bảo backend đang chạy
- Kiểm tra URL trong `api.js` và `App.js`

## 📝 Ghi Chú Quan Trọng

1. **JWT Secret**: Thay đổi `JWT_SECRET` trong production
2. **Database Backup**: Thường xuyên backup database
3. **Connection Pooling**: Đã cấu hình pool size = 10
4. **Indexes**: Đã tạo indexes cho hiệu suất tốt hơn

## 🚀 Deploy Lên Production

### Chuẩn bị

1. **Bảo mật**:
   - Đổi JWT_SECRET thành giá trị phức tạp
   - Sử dụng HTTPS
   - Enable encryption trong SQL connection
   - Thêm rate limiting

2. **Database**:
   - Migrate sang SQL Server production
   - Setup backup schedule
   - Monitor performance

3. **Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

4. **Backend**:
   - Set `NODE_ENV=production`
   - Sử dụng process manager (PM2)

## 📞 Mở Rộng Thêm

Một số ý tưởng để phát triển:

- [ ] Private messaging (chat 1-1)
- [ ] Nhiều phòng chat
- [ ] Upload và chia sẻ files/hình ảnh
- [ ] Voice/Video call
- [ ] Message reactions và emoji
- [ ] User profiles và avatars
- [ ] Search và filter messages
- [ ] Notifications
- [ ] Dark mode
- [ ] Admin panel

## 📄 License

MIT License - Tự do sử dụng cho mục đích học tập và phát triển.

---

**💡 Tips:**
- Sử dụng SSMS để xem dữ liệu trong database
- Kiểm tra SQL Server Profiler để debug queries
- Monitor CPU và memory usage khi có nhiều users

**Chúc bạn code vui vẻ! 🎉**
