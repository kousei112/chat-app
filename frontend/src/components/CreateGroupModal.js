import React, { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import './CreateGroupModal.css';

function CreateGroupModal({ socket, onClose, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAllUsers();
      if (response.data.success) {
        setAllUsers(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = allUsers.filter(user =>
    search === '' ||
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMember = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedMembers.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    try {
      setCreating(true);
      
      // ===== AWAIT onCreate để nhận result =====
      const result = await onCreate({
        groupName: groupName.trim(),
        memberIds: selectedMembers,
        description: description.trim()
      });
      
      // ===== Emit socket event =====
      if (socket && result && result.conversation_id) {
        socket.emit('group-created', {
          conversationId: result.conversation_id,
          memberIds: selectedMembers,
          groupName: groupName.trim()
        });
        
        console.log('Emitted group-created event:', {
          conversationId: result.conversation_id,
          memberIds: selectedMembers
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Lỗi tạo group:', error);
      alert('Không thể tạo nhóm: ' + (error.response?.data?.message || error.message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👥 Tạo nhóm mới</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Tên nhóm *</label>
            <input
              type="text"
              placeholder="Nhập tên nhóm..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Mô tả (tùy chọn)</label>
            <textarea
              placeholder="Mô tả về nhóm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Thành viên ({selectedMembers.length} đã chọn)</label>
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="members-list">
            {loading ? (
              <div className="loading-state">Đang tải...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                {search ? 'Không tìm thấy người dùng' : 'Không có người dùng nào'}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={`member-item ${selectedMembers.includes(user.user_id) ? 'selected' : ''}`}
                  onClick={() => toggleMember(user.user_id)}
                >
                  <div className="member-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(user.user_id)}
                      onChange={() => {}}
                    />
                  </div>
                  <div className="member-avatar">
                    {user.full_name
                      ? user.full_name.charAt(0).toUpperCase()
                      : user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-info">
                    <div className="member-name">
                      {user.full_name || user.display_name || user.username}
                    </div>
                    <div className="member-username">@{user.username}</div>
                  </div>
                  {user.is_online && <span className="online-badge">●</span>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={creating}>
            Hủy
          </button>
          <button 
            className="create-btn" 
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedMembers.length === 0}
          >
            {creating ? 'Đang tạo...' : `Tạo nhóm (${selectedMembers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupModal;