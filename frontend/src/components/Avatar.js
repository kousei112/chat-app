import React from 'react';
import './Avatar.css';

function Avatar({ user, size = 'medium', className = '' }) {
  const avatarUrl = user?.avatar_url || user?.avatarUrl || user?.sender_avatar_url || user?.other_avatar_url;
  const name = user?.full_name || user?.fullName || user?.display_name || user?.displayName || user?.username || user?.sender_full_name || user?.other_full_name || 'U';

  const sizeClass = {
    small: 'avatar-small',      // 32px
    medium: 'avatar-medium',    // 40px
    large: 'avatar-large',      // 50px
    xlarge: 'avatar-xlarge'     // 100px
  }[size] || 'avatar-medium';

  const initial = name.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <div className={`avatar-container ${sizeClass} ${className}`}>
        <img 
          src={`http://localhost:5000${avatarUrl}`}
          alt={name}
          className="avatar-image"
          onError={(e) => {
            // Fallback nếu ảnh lỗi
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="avatar-fallback" style={{ display: 'none' }}>
          {initial}
        </div>
      </div>
    );
  }

  // Không có avatar -> Hiển thị chữ cái
  return (
    <div className={`avatar-container avatar-placeholder ${sizeClass} ${className}`}>
      {initial}
    </div>
  );
}

export default Avatar;