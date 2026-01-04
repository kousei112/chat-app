import React, { useState, useEffect } from 'react';
import { userAPI, conversationAPI } from '../services/api';
import './UserList.css';

function UserList({ onSelectUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAllUsers(search);
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user) => {
    try {
      setCreating(true);
      const response = await conversationAPI.getOrCreateConversation(user.user_id);
      
      if (response.data.success) {
        onSelectUser({
          conversation_id: response.data.data.conversation_id,
          other_user_id: user.user_id,
          other_username: user.username,
          other_display_name: user.display_name,
          other_full_name: user.full_name,
          other_avatar_url: user.avatar_url,
          other_is_online: user.is_online
        });
        onClose();
      }
    } catch (error) {
      console.error('Lỗi tạo conversation:', error);
      alert('Không thể tạo cuộc trò chuyện');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="user-list-overlay" onClick={onClose}>
      <div className="user-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-list-header">
          <h2>👥 Chọn người để nhắn tin</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="users-list">
          {loading ? (
            <div className="loading-state">Đang tải...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              {search ? 'Không tìm thấy người dùng' : 'Chưa có người dùng nào'}
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.user_id}
                className="user-item"
                onClick={() => !creating && handleSelectUser(user)}
              >
                <div className="user-avatar">
                  <div className="avatar-circle">
                    {user.full_name
                      ? user.full_name.charAt(0).toUpperCase()
                      : user.username.charAt(0).toUpperCase()}
                  </div>
                  {user.is_online && <span className="online-indicator"></span>}
                </div>

                <div className="user-info">
                  <div className="user-name">
                    {user.full_name || user.display_name || user.username}
                  </div>
                  <div className="user-username">@{user.username}</div>
                </div>

                {user.is_online && <span className="online-text">Online</span>}
              </div>
            ))
          )}
        </div>

        {creating && (
          <div className="creating-overlay">
            <div className="loading-spinner"></div>
            <p>Đang tạo cuộc trò chuyện...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserList;