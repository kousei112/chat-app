import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';
import UserProfile from './UserProfile';
import './ChatRoom.css';

function ChatRoom({ socket, user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Nhận lịch sử tin nhắn
    socket.on('message-history', (history) => {
      setMessages(history);
    });

    // Nhận tin nhắn mới
    socket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Cập nhật danh sách người dùng online
    socket.on('users-update', (users) => {
      setOnlineUsers(users);
    });

    // Thông báo người dùng join
    socket.on('user-joined', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        type: 'system',
        text: `${data.displayName || data.username} đã tham gia chat`,
        timestamp: data.timestamp
      }]);
    });

    // Thông báo người dùng rời
    socket.on('user-left', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        type: 'system',
        text: `${data.username} đã rời khỏi chat`,
        timestamp: data.timestamp
      }]);
    });

    // Hiển thị người dùng đang gõ
    socket.on('user-typing', (typingUsername) => {
      setTypingUser(typingUsername);
    });

    socket.on('user-stop-typing', () => {
      setTypingUser(null);
    });

    // Xử lý lỗi
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(error.message);
    });

    return () => {
      socket.off('message-history');
      socket.off('receive-message');
      socket.off('users-update');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('error');
    };
  }, [socket]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      socket.emit('send-message', { text: inputMessage });
      setInputMessage('');
      socket.emit('stop-typing');
    }
  };

  const handleTyping = () => {
    socket.emit('typing');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing');
    }, 1000);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout(user.userId);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      // Vẫn logout ở client
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h3>👥 Online ({onlineUsers.length})</h3>
        </div>
        <div className="users-list">
          {onlineUsers.map((onlineUser, index) => (
            <div key={index} className="user-item">
              <span className="user-status"></span>
              <div className="user-info">
                <div className="user-display-name">
                  {onlineUser.display_name || onlineUser.username}
                </div>
                <div className="user-username">@{onlineUser.username}</div>
              </div>
              {onlineUser.user_id === user.userId && <span className="you-badge">Bạn</span>}
            </div>
          ))}
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Đăng xuất
        </button>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <h2>💬 Phòng Chat Chung</h2>
          <div className="header-actions">
            <button className="profile-btn" onClick={() => setShowProfile(true)}>
              👤 Tài khoản
            </button>
            <span className="current-user">
              Xin chào, {currentUser.displayName || currentUser.username}!
            </span>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${
                msg.type === 'system' 
                  ? 'system-message' 
                  : msg.userId === user.userId 
                    ? 'own-message' 
                    : 'other-message'
              }`}
            >
              {msg.type !== 'system' && (
                <div className="message-header">
                  <span className="message-username">
                    {msg.displayName || msg.username}
                  </span>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <div className="message-content">
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {typingUser && (
          <div className="typing-indicator">
            {typingUser} đang gõ<span className="dots">...</span>
          </div>
        )}

        <form className="message-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Nhập tin nhắn..."
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
            autoFocus
          />
          <button type="submit" disabled={!inputMessage.trim()}>
            📤 Gửi
          </button>
        </form>
      </div>

      {showProfile && (
        <UserProfile 
          user={currentUser}
          onUpdate={handleProfileUpdate}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}

export default ChatRoom;
