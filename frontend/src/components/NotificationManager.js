import React, { useState, useEffect, useCallback } from 'react';
import MessageNotification from './MessageNotification';

function NotificationManager({ socket, currentUser, onNotificationClick }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Lắng nghe tin nhắn mới
    socket.on('receive-private-message', handleNewMessage);
    socket.on('new-message-notification', handleNewNotification);

    return () => {
      socket.off('receive-private-message', handleNewMessage);
      socket.off('new-message-notification', handleNewNotification);
    };
  }, [socket, currentUser]);

  const handleNewMessage = useCallback((message) => {
    // Chỉ hiển thị notification nếu KHÔNG phải tin nhắn của mình
    if (message.sender_id === currentUser.userId) return;

    // Không hiển thị nếu đang mở conversation đó
    // (Optional - có thể bỏ nếu muốn hiển thị luôn)
    const currentPath = window.location.pathname;
    if (currentPath.includes(`/conversation/${message.conversation_id}`)) return;

    addNotification({
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      senderName: message.sender_full_name || message.sender_display_name || message.sender_username || 'Someone',
      senderAvatar: message.sender_avatar_url,
      messagePreview: getMessagePreview(message),
      timestamp: new Date()
    });
  }, [currentUser]);

  const handleNewNotification = useCallback((data) => {
    // Alternative handler nếu backend gửi notification riêng
    if (data.receiverId !== currentUser.userId) return;

    addNotification({
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      messagePreview: data.messagePreview,
      timestamp: new Date()
    });
  }, [currentUser]);

  const getMessagePreview = (message) => {
    if (message.message_type === 'image') {
      return '📷 Đã gửi một ảnh';
    } else if (message.message_type === 'file') {
      return `📎 Đã gửi file: ${message.file_name}`;
    } else {
      return message.message_text || 'Tin nhắn mới';
    }
  };

  const addNotification = (notificationData) => {
    const notification = {
      id: Date.now() + Math.random(),
      ...notificationData
    };

    setNotifications(prev => {
      // Giới hạn 5 notifications cùng lúc
      const updated = [notification, ...prev].slice(0, 5);
      return updated;
    });

    // Play notification sound
    playNotificationSound();

    // Request browser notification permission nếu chưa có
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification
    showBrowserNotification(notificationData);
  };

  const playNotificationSound = () => {
    try {
      // Tạo audio element và play
      const audio = new Audio('/notification.mp3'); // Cần thêm file sound
      audio.volume = 0.3;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.log('Notification sound error:', error);
    }
  };

  const showBrowserNotification = (data) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(data.senderName, {
          body: data.messagePreview,
          icon: data.senderAvatar ? `http://localhost:5000${data.senderAvatar}` : '/logo192.png',
          badge: '/logo192.png',
          tag: `message-${data.conversationId}`,
          requireInteraction: false,
          silent: false
        });

        notification.onclick = () => {
          window.focus();
          onNotificationClick && onNotificationClick({
            conversationId: data.conversationId
          });
          notification.close();
        };
      } catch (error) {
        console.log('Browser notification error:', error);
      }
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notification) => {
    if (onNotificationClick) {
      onNotificationClick({
        conversationId: notification.conversationId
      });
    }
  };

  return (
    <div className="notification-container">
      {notifications.map((notification, index) => (
        <MessageNotification
          key={notification.id}
          notification={{ ...notification, index }}
          onClose={removeNotification}
          onClick={handleNotificationClick}
        />
      ))}
    </div>
  );
}

export default NotificationManager;