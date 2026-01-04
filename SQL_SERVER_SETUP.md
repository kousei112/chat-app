# 🗄️ Hướng Dẫn Cấu Hình SQL Server

## 📥 Cài Đặt SQL Server

### Option 1: SQL Server Express (Miễn Phí)

1. Tải SQL Server Express: https://www.microsoft.com/sql-server/sql-server-downloads
2. Chọn "Basic" installation
3. Chấp nhận license terms
4. Chọn thư mục cài đặt
5. Đợi cài đặt hoàn tất
6. Ghi nhớ connection string hiển thị

### Option 2: SQL Server Developer (Miễn Phí cho Dev)

1. Tải SQL Server Developer Edition
2. Chọn "Custom" installation
3. Chọn các features cần thiết:
   - Database Engine Services
   - SQL Server Replication
   - Full-Text and Semantic Extractions for Search
4. Cấu hình instance:
   - Default instance hoặc Named instance
   - Chọn authentication mode
5. Hoàn tất cài đặt

## 🔧 Cài Đặt SSMS (SQL Server Management Studio)

1. Tải SSMS: https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms
2. Chạy installer
3. Follow wizard để cài đặt
4. Khởi động lại máy nếu cần

## 🔌 Kết Nối SQL Server

### Mở SSMS và Connect

1. Mở SQL Server Management Studio
2. Trong Connect to Server dialog:
   - **Server type**: Database Engine
   - **Server name**: 
     - `localhost` hoặc `(local)` - nếu local
     - `localhost\SQLEXPRESS` - nếu dùng Express edition
     - `YOUR_IP\INSTANCE_NAME` - nếu remote
   - **Authentication**:
     - **Windows Authentication** (khuyên dùng cho local)
     - **SQL Server Authentication** (nếu đã setup)
3. Click "Connect"

### Test Connection từ Node.js

Tạo file test connection:

```javascript
// test-connection.js
const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'YourPassword123',
  server: 'localhost',
  database: 'master',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function testConnection() {
  try {
    await sql.connect(config);
    console.log('✅ Kết nối thành công!');
    await sql.close();
  } catch (err) {
    console.error('❌ Lỗi kết nối:', err);
  }
}

testConnection();
```

Chạy: `node test-connection.js`

## 🔐 Cấu Hình Authentication

### Sử dụng Windows Authentication

**File .env:**
```env
DB_SERVER=localhost
DB_DATABASE=ChatAppDB
DB_PORT=1433
# Để trống DB_USER và DB_PASSWORD
```

**Cập nhật database.js:**
```javascript
const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  authentication: {
    type: 'default'
  }
};
```

### Sử dụng SQL Authentication

#### 1. Enable SQL Authentication trong SSMS

```sql
-- Chạy query này trong SSMS
USE master;
GO

EXEC xp_instance_regwrite 
  N'HKEY_LOCAL_MACHINE', 
  N'Software\Microsoft\MSSQLServer\MSSQLServer',
  N'LoginMode', 
  REG_DWORD, 
  2;
GO
```

Hoặc:
1. Right-click server name → Properties
2. Security → Server authentication
3. Chọn "SQL Server and Windows Authentication mode"
4. Restart SQL Server service

#### 2. Tạo SQL Login

```sql
USE master;
GO

-- Tạo login
CREATE LOGIN chatapp_user WITH PASSWORD = 'YourStrongPassword123!';
GO

-- Chuyển sang database
USE ChatAppDB;
GO

-- Tạo user từ login
CREATE USER chatapp_user FOR LOGIN chatapp_user;
GO

-- Cấp quyền db_owner
ALTER ROLE db_owner ADD MEMBER chatapp_user;
GO

-- Hoặc cấp quyền chi tiết hơn:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO chatapp_user;
-- GRANT CREATE TABLE TO chatapp_user;
-- GRANT ALTER ON SCHEMA::dbo TO chatapp_user;
```

#### 3. Cấu hình .env

```env
DB_USER=chatapp_user
DB_PASSWORD=YourStrongPassword123!
DB_SERVER=localhost
DB_DATABASE=ChatAppDB
DB_PORT=1433
```

## 🌐 Enable TCP/IP Connections

### Bước 1: Enable TCP/IP

1. Mở **SQL Server Configuration Manager**
2. SQL Server Network Configuration → Protocols for [YOUR_INSTANCE]
3. Right-click **TCP/IP** → Enable
4. Right-click **TCP/IP** → Properties
5. Tab **IP Addresses**:
   - Tìm **IPAll**
   - **TCP Port**: 1433
   - **Enabled**: Yes
6. Click OK
7. Restart SQL Server service

### Bước 2: Configure Windows Firewall

#### Mở Port 1433:

**PowerShell (Run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "SQL Server" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
```

**Hoặc qua GUI:**
1. Control Panel → Windows Defender Firewall
2. Advanced settings
3. Inbound Rules → New Rule
4. Port → TCP → 1433
5. Allow the connection
6. Apply to all profiles

## 🔄 Restart SQL Server Service

### Cách 1: SQL Server Configuration Manager

1. Mở SQL Server Configuration Manager
2. SQL Server Services
3. Right-click SQL Server (MSSQLSERVER hoặc instance của bạn)
4. Restart

### Cách 2: Services (services.msc)

1. Win + R → services.msc
2. Tìm "SQL Server (MSSQLSERVER)"
3. Right-click → Restart

### Cách 3: Command Line (Run as Admin)

```cmd
net stop MSSQLSERVER
net start MSSQLSERVER

# Hoặc cho Express:
net stop MSSQL$SQLEXPRESS
net start MSSQL$SQLEXPRESS
```

## 🐛 Troubleshooting

### Lỗi: "Login failed for user"

**Giải pháp:**
1. Kiểm tra username/password
2. Đảm bảo SQL Authentication được enable
3. Kiểm tra user có quyền truy cập database
4. Xem SQL Server logs trong SSMS

### Lỗi: "Cannot connect to SQL Server"

**Giải pháp:**
1. Kiểm tra SQL Server service đang chạy
2. Kiểm tra server name đúng chưa
3. Enable TCP/IP protocol
4. Mở port 1433 trong firewall
5. Disable VPN nếu có

### Lỗi: "Self-signed certificate"

**Giải pháp:**
Trong config thêm:
```javascript
options: {
  encrypt: true,
  trustServerCertificate: true
}
```

### Lỗi: Connection timeout

**Giải pháp:**
```javascript
const config = {
  // ... other configs
  connectionTimeout: 30000,
  requestTimeout: 30000
};
```

### Lỗi: "Database does not exist"

**Giải pháp:**
1. Tạo database trong SSMS:
```sql
CREATE DATABASE ChatAppDB;
```
2. Hoặc để backend tự tạo khi chạy lần đầu

## 📊 Kiểm Tra Kết Nối

### Query để test:

```sql
-- Kiểm tra version
SELECT @@VERSION;

-- Kiểm tra databases
SELECT name FROM sys.databases;

-- Kiểm tra users
SELECT name FROM sys.database_principals WHERE type = 'S';

-- Kiểm tra tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES;

-- Kiểm tra connections hiện tại
SELECT 
    session_id,
    login_name,
    host_name,
    program_name,
    login_time
FROM sys.dm_exec_sessions
WHERE is_user_process = 1;
```

## 📝 Tips & Best Practices

### Bảo mật
- Đừng dùng sa account trong production
- Tạo user riêng với quyền tối thiểu cần thiết
- Dùng strong passwords
- Enable SSL/TLS cho connections
- Regular backup database

### Performance
- Tạo indexes cho các columns hay query
- Monitor query performance
- Regular maintenance (rebuild indexes, update statistics)
- Set appropriate pool size

### Development
- Dùng Windows Authentication cho local dev
- Separate dev/prod databases
- Version control cho database schema
- Document database changes

## 🔗 Resources Hữu Ích

- **Docs chính thức**: https://docs.microsoft.com/sql/
- **mssql npm package**: https://www.npmjs.com/package/mssql
- **SQL Server tutorials**: https://www.sqlservertutorial.net/
- **Connection strings**: https://www.connectionstrings.com/sql-server/

## ❓ Câu Hỏi Thường Gặp

**Q: Nên dùng SQL Server Express hay Developer?**
A: Express cho production nhỏ, Developer cho development (có đầy đủ features)

**Q: Windows Auth hay SQL Auth?**
A: Windows Auth cho local dev, SQL Auth cho production/remote

**Q: Port mặc định là gì?**
A: 1433 cho SQL Server

**Q: Làm sao biết SQL Server đang chạy?**
A: Check services.msc hoặc SQL Server Configuration Manager

**Q: Backup database như thế nào?**
A: SSMS → Right-click database → Tasks → Back Up

---

**💡 Nếu gặp vấn đề, hãy:**
1. Check SQL Server error logs trong SSMS
2. Enable detailed logging trong Node.js
3. Test connection từ SSMS trước
4. Verify firewall và network settings
