import React, { useState } from 'react';
import { userAPI } from '../services/api';
import './CompleteProfile.css';

function CompleteProfile({ user, onComplete }) {
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: ''
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
      // Validate age
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13) {
        setError('Bạn phải từ 13 tuổi trở lên');
        setLoading(false);
        return;
      }

      const response = await userAPI.completeProfile({
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender
      });

      if (response.data.success) {
        const updatedUser = {
          ...user,
          fullName: response.data.data.full_name,
          dateOfBirth: response.data.data.date_of_birth,
          gender: response.data.data.gender,
          profileCompleted: true
        };
        
        // Cập nhật localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        onComplete(updatedUser);
      }
    } catch (err) {
      console.error('Lỗi:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.errors?.[0]?.msg ||
        'Có lỗi xảy ra khi cập nhật thông tin'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-profile-container">
      <div className="complete-profile-box">
        <div className="profile-header">
          <h1>👤 Hoàn Thành Thông Tin</h1>
          <p>Xin chào <strong>{user.username}</strong>!</p>
          <p>Vui lòng cung cấp thêm thông tin để hoàn tất đăng ký</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Họ và tên <span className="required">*</span></label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="Nguyễn Văn A"
              value={formData.fullName}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dateOfBirth">Ngày sinh <span className="required">*</span></label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              required
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="gender">Giới tính <span className="required">*</span></label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="">-- Chọn giới tính --</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <button type="submit" disabled={loading || !formData.fullName || !formData.dateOfBirth || !formData.gender}>
            {loading ? 'Đang xử lý...' : 'Hoàn tất'}
          </button>
        </form>

        <div className="profile-note">
          <p>💡 Thông tin này sẽ giúp chúng tôi cung cấp trải nghiệm tốt hơn cho bạn</p>
        </div>
      </div>
    </div>
  );
}

export default CompleteProfile;
