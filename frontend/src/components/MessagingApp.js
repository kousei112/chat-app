import React, { useState, useEffect } from 'react';
import { conversationAPI, groupAPI } from '../services/api';
import { authAPI } from '../services/api';
import ConversationList from './ConversationList';
import PrivateChatWindow from './PrivateChatWindow';
import UserList from './UserList';
import UserProfile from './UserProfile';
import CreateGroupModal from './CreateGroupModal';
import './MessagingApp.css';

function MessagingApp({ socket, user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    loadConversations();

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
    loadConversations();
  };

  const handleNotification = (data) => {
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

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await groupAPI.createGroup(groupData);
      if (response.data.success) {
        loadConversations();
        // Auto-select group vừa tạo
        const newGroup = response.data.data;
        setSelectedConversation({
          conversation_id: newGroup.conversation_id,
          conversation_type: 'group',
          group_name: newGroup.group_name,
          member_count: newGroup.member_count
        });
      }
    } catch (error) {
      throw error;
    }
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
            <button 
              className="icon-btn new-group-btn" 
              onClick={() => setShowCreateGroup(true)}
              title="Tạo nhóm"
            >
              👥
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

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}

export default MessagingApp;