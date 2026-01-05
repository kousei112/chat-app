import React, { useState, useRef } from 'react';
import { userAPI, uploadAPI } from '../services/api';
import './UserProfile.css';

function UserProfile({ user, onUpdate, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
    gender: user.gender || '',
    displayName: user.displayName || user.username
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra loại file
    if (!file.type.startsWith('image/')) {
      alert('Chỉ chấp nhận file ảnh!');
      return;
    }

    // Kiểm tra kích thước (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh quá lớn! Kích thước tối đa là 2MB');
      return;
    }

    try {
      setUploadingAvatar(true);

      // Upload file
      const uploadResponse = await uploadAPI.uploadFile(file);
      
      if (uploadResponse.data.success) {
        const fileUrl = uploadResponse.data.data.fileUrl;

        // Cập nhật avatar vào database
        const response = await userAPI.uploadAvatar(fileUrl);
        
        if (response.data.success) {
          setAvatarUrl(fileUrl);
          
          // Cập nhật localStorage và parent component
          const updatedUser = {
            ...user,
            avatarUrl: fileUrl
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          onUpdate(updatedUser);
          
          alert('Cập nhật avatar thành công!');
        }
      }

    } catch (error) {
      console.error('Lỗi upload avatar:', error);
      alert('Không thể upload avatar: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await userAPI.updateProfile(formData);

      if (response.data.success) {
        const updatedUser = {
          ...user,
          fullName: response.data.data.full_name,
          dateOfBirth: response.data.data.date_of_birth,
          gender: response.data.data.gender,
          displayName: response.data.data.display_name,
          avatarUrl: avatarUrl // Giữ avatar hiện tại
        };
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        onUpdate(updatedUser);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Lỗi:', err);
      setError(
        err.response?.data?.message || 
        'Có lỗi xảy ra khi cập nhật thông tin'
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>👤 Tài khoản</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="profile-modal-content">
          {/* Avatar Section */}
          <div className="profile-avatar-section">
            <div className="profile-avatar-container">
              {avatarUrl ? (
                <img 
                  src={`http://localhost:5000${avatarUrl}`} 
                  alt="Avatar" 
                  className="profile-avatar-img"
                />
              ) : (
                <div className="profile-avatar-placeholder">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                </div>
              )}
              {uploadingAvatar && (
                <div className="avatar-uploading-overlay">
                  <div className="spinner-small"></div>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button 
              className="change-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? 'Đang upload...' : '📷 Đổi ảnh đại diện'}
            </button>
          </div>

          {error && <div className="profile-error">{error}</div>}

          {!isEditing ? (
            <div className="profile-view-mode">
              <div className="profile-field">
                <label>Tên đăng nhập</label>
                <div className="profile-value">@{user.username}</div>
              </div>

              <div className="profile-field">
                <label>Email</label>
                <div className="profile-value">{user.email}</div>
              </div>

              <div className="profile-field">
                <label>Tên hiển thị</label>
                <div className="profile-value">{user.displayName || user.username}</div>
              </div>

              {user.fullName && (
                <div className="profile-field">
                  <label>Họ và tên</label>
                  <div className="profile-value">{user.fullName}</div>
                </div>
              )}

              {user.dateOfBirth && (
                <div className="profile-field">
                  <label>Ngày sinh</label>
                  <div className="profile-value">
                    {formatDate(user.dateOfBirth)}
                    {calculateAge(user.dateOfBirth) && (
                      <span className="age-badge">{calculateAge(user.dateOfBirth)} tuổi</span>
                    )}
                  </div>
                </div>
              )}

              {user.gender && (
                <div className="profile-field">
                  <label>Giới tính</label>
                  <div className="profile-value">{user.gender}</div>
                </div>
              )}

              <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>
                ✏️ Chỉnh sửa thông tin
              </button>
            </div>
          ) : (
            <form className="profile-edit-mode" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên hiển thị</label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Tên hiển thị"
                />
              </div>

              <div className="form-group">
                <label>Họ và tên</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Họ và tên đầy đủ"
                />
              </div>

              <div className="form-group">
                <label>Ngày sinh</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Giới tính</label>
                <select 
                  name="gender" 
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div className="profile-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="save-btn"
                  disabled={loading}
                >
                  {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfile;