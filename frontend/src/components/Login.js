import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './Login.css';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: ''
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
      if (isRegister) {
        // Đăng ký
        const response = await authAPI.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName || formData.username
        });

        if (response.data.success) {
          const { user, token } = response.data.data;
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          onLogin(user, token);
        }
      } else {
        // Đăng nhập
        const response = await authAPI.login({
          username: formData.username,
          password: formData.password
        });

        if (response.data.success) {
          const { user, token } = response.data.data;
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          onLogin(user, token);
        }
      }
    } catch (err) {
      console.error('Lỗi:', err);
      setError(
        err.response?.data?.message || 
        (isRegister ? 'Đăng ký thất bại' : 'Đăng nhập thất bại')
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      displayName: ''
    });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🗨️ Bean Talk</h1>
        <p>{isRegister ? 'Tạo tài khoản mới' : 'Đăng nhập vào tài khoản'}</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            autoFocus
          />

          {isRegister && (
            <>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="displayName"
                placeholder="Tên hiển thị (tùy chọn)"
                value={formData.displayName}
                onChange={handleChange}
              />
            </>
          )}

          <input
            type="password"
            name="password"
            placeholder="Mật khẩu"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : (isRegister ? 'Đăng ký' : 'Đăng nhập')}
          </button>
        </form>

        <div className="toggle-mode">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <button type="button" onClick={toggleMode} className="link-button">
            {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
