import React, { useState } from 'react';
import { userAPI } from '../services/api';
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
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
          displayName: response.data.data.display_name
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
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="user-profile-overlay" onClick={onClose}>
      <div className="user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>👤 Thông Tin Tài Khoản</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!isEditing ? (
          <div className="profile-view">
            <div className="profile-avatar">
              <div className="avatar-circle">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="profile-info">
              <div className="info-row">
                <label>Username:</label>
                <span>@{user.username}</span>
              </div>

              <div className="info-row">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>

              <div className="info-row">
                <label>Tên hiển thị:</label>
                <span>{user.displayName || user.username}</span>
              </div>

              <div className="info-row">
                <label>Họ và tên:</label>
                <span>{user.fullName || 'Chưa cập nhật'}</span>
              </div>

              <div className="info-row">
                <label>Ngày sinh:</label>
                <span>
                  {user.dateOfBirth ? (
                    <>
                      {formatDate(user.dateOfBirth)}
                      <span className="age-badge">{calculateAge(user.dateOfBirth)} tuổi</span>
                    </>
                  ) : 'Chưa cập nhật'}
                </span>
              </div>

              <div className="info-row">
                <label>Giới tính:</label>
                <span>{user.gender || 'Chưa cập nhật'}</span>
              </div>
            </div>

            <button className="edit-btn" onClick={() => setIsEditing(true)}>
              ✏️ Chỉnh sửa thông tin
            </button>
          </div>
        ) : (
          <form className="profile-edit" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="displayName">Tên hiển thị</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Họ và tên</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="dateOfBirth">Ngày sinh</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">Giới tính</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">-- Chọn giới tính --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={() => setIsEditing(false)}>
                Hủy
              </button>
              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default UserProfile;
