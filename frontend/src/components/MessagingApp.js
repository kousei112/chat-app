import React, { useState, useEffect } from 'react';
import { conversationAPI } from '../services/api';
import { authAPI } from '../services/api';
import ConversationList from './ConversationList';
import PrivateChatWindow from './PrivateChatWindow';
import UserList from './UserList';
import UserProfile from './UserProfile';
import './MessagingApp.css';

function MessagingApp({ socket, user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    loadConversations();

    // Socket listeners
    socket.on('receive-private-message', handleNewMessage);
    socket.on('new-message-notification', handleNotification);

    return () => {
      socket.off('receive-private-message', handleNewMessage);
      socket.off('new-message-notification', handleNotification);
    };
  }, []);

  const loadConversations = async () => {
    try {
      const response = await conversationAPI.getConversations();
      if (response.data.success) {
        setConversations(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi load conversations:', error);
    }
  };

  const handleNewMessage = (message) => {
    // Reload conversations để cập nhật last message
    loadConversations();
  };

  const handleNotification = (data) => {
    // Show notification nếu cần
    console.log('New message from:', data.senderName);
    loadConversations();
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSelectUser = (newConversation) => {
    setSelectedConversation(newConversation);
    loadConversations();
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout(user.userId);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
    }
  };

  return (
    <div className="messaging-app">
      <div className="app-sidebar">
        <div className="sidebar-header">
          <h2>💬 Chat</h2>
          <div className="header-actions">
            <button 
              className="icon-btn profile-icon" 
              onClick={() => setShowProfile(true)}
              title="Tài khoản"
            >
              👤
            </button>
            <button 
              className="icon-btn new-chat-btn" 
              onClick={() => setShowUserList(true)}
              title="Chat mới"
            >
              ➕
            </button>
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          currentUserId={currentUser.userId}
        />

        <div className="sidebar-footer">
          <div className="current-user-info">
            <div className="user-avatar-small">
              {currentUser.fullName
                ? currentUser.fullName.charAt(0).toUpperCase()
                : currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name-small">
                {currentUser.displayName || currentUser.username}
              </div>
              <div className="user-status-small">Online</div>
            </div>
          </div>
          <button className="logout-btn-small" onClick={handleLogout} title="Đăng xuất">
            🚪
          </button>
        </div>
      </div>

      <div className="app-main">
        <PrivateChatWindow
          socket={socket}
          conversation={selectedConversation}
          currentUser={currentUser}
        />
      </div>

      {showUserList && (
        <UserList
          onSelectUser={handleSelectUser}
          onClose={() => setShowUserList(false)}
        />
      )}

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

export default MessagingApp;