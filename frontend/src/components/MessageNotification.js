import React, { useEffect } from 'react';
import Avatar from './Avatar';
import './MessageNotification.css';

function MessageNotification({ notification, onClose, onClick }) {
  useEffect(() => {
    // Auto close after 5 seconds
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const handleClick = () => {
    onClick(notification);
    onClose(notification.id);
  };

  return (
    <div 
      className="message-notification" 
      onClick={handleClick}
      style={{ '--index': notification.index }}
    >
      <div className="notification-content">
        <Avatar
          user={{
            avatar_url: notification.senderAvatar,
            full_name: notification.senderName,
            username: notification.senderName
          }}
          size="medium"
        />
        
        <div className="notification-text">
          <div className="notification-sender">
            {notification.senderName}
          </div>
          <div className="notification-message">
            {notification.messagePreview}
          </div>
        </div>
      </div>

      <button 
        className="notification-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(notification.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default MessageNotification;