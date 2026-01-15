import React, { useState, useEffect } from 'react';
import { conversationAPI, groupAPI } from '../services/api';
import { authAPI } from '../services/api';
import ConversationList from './ConversationList';
import PrivateChatWindow from './PrivateChatWindow';
import UserList from './UserList';
import UserProfile from './UserProfile';
import CreateGroupModal from './CreateGroupModal';
import ThemeToggle from './ThemeToggle';
import NotificationManager from './NotificationManager';
import './MessagingApp.css';

function MessagingApp({ socket, user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  // ===== 🔒 LỚP 2: JAVASCRIPT SCROLL LOCK =====
  useEffect(() => {
    // Save current scroll position
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    // Lock html scroll
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';

    // Disable scrollIntoView globally
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function() {
      // Block scrollIntoView completely
      console.log('scrollIntoView blocked');
    };

    // Prevent scroll restoration using window.history API
    let originalScrollRestoration;
    if ('scrollRestoration' in window.history) {
      originalScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
    }

    // Prevent window scroll events
    const preventScroll = (e) => {
      if (e.target === document || e.target === document.documentElement || e.target === document.body) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('scroll', preventScroll, { passive: false });
    document.addEventListener('scroll', preventScroll, { passive: false });

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      
      Element.prototype.scrollIntoView = originalScrollIntoView;
      
      if ('scrollRestoration' in window.history && originalScrollRestoration) {
        window.history.scrollRestoration = originalScrollRestoration;
      }

      window.removeEventListener('scroll', preventScroll);
      document.removeEventListener('scroll', preventScroll);
      
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

  useEffect(() => {
    loadConversations();

    // ===== SOCKET EVENT LISTENERS =====
    socket.on('receive-private-message', handleNewMessage);
    socket.on('new-message-notification', handleNotification);
    socket.on('new-group-notification', handleNewGroupNotification);

    return () => {
      socket.off('receive-private-message', handleNewMessage);
      socket.off('new-message-notification', handleNotification);
      socket.off('new-group-notification', handleNewGroupNotification);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

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
    // Reload conversations khi có tin nhắn mới
    loadConversations();
  };

  const handleNotification = (data) => {
    console.log('New message from:', data.senderName);
    loadConversations();
  };

  const handleNewGroupNotification = (data) => {
    console.log('📢 Received new group notification:', data);
    
    // Show alert để user biết
    if (data.groupName) {
      console.log(`✅ Bạn đã được thêm vào nhóm "${data.groupName}"`);
    }
    
    // Reload conversations NGAY LẬP TỨC
    loadConversations();
  };

  const handleSelectConversation = (conversation) => {
    // ===== 🔒 Force lock window scroll =====
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    setSelectedConversation(conversation);
  };

  const handleSelectUser = (newConversation) => {
    // ===== 🔒 Force lock window scroll =====
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    setSelectedConversation(newConversation);
    loadConversations();
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await groupAPI.createGroup(groupData);
      if (response.data.success) {
        const newGroup = response.data.data;
        
        // Reload conversations
        await loadConversations();
        
        // Auto-select group vừa tạo
        setSelectedConversation({
          conversation_id: newGroup.conversation_id,
          conversation_type: 'group',
          group_name: newGroup.group_name,
          member_count: newGroup.member_count
        });
        
        // Return newGroup để CreateGroupModal có thể emit socket event
        return newGroup;
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

  const handleNotificationClick = (data) => {
    const conversation = conversations.find(
      c => c.conversation_id === data.conversationId
    );
    
    if (conversation) {
      // ===== 🔒 Force lock window scroll =====
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      setSelectedConversation(conversation);
    } else {
      loadConversations();
    }
  };

  return (
    <div className="messaging-app">
      {/* ===== SIDEBAR WITH FIXED STRUCTURE ===== */}
      <div className="app-sidebar">
        {/* HEADER - Fixed at top */}
        <div className="sidebar-header">
          <h2>💬 Chat</h2>
          <div className="header-actions">
            <ThemeToggle />
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

        {/* CONVERSATION LIST - Scrollable middle area */}
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          currentUserId={currentUser.userId}
        />

        {/* FOOTER - Fixed at bottom */}
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
              <div className="user-status-small">● Online</div>
            </div>
          </div>
          <button className="logout-btn-small" onClick={handleLogout} title="Đăng xuất">
            🚪
          </button>
        </div>
      </div>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className="app-main">
        <PrivateChatWindow
          socket={socket}
          conversation={selectedConversation}
          currentUser={currentUser}
        />
      </div>

      {/* ===== MODALS ===== */}
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
          socket={socket}
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {/* NOTIFICATION MANAGER */}
      <NotificationManager
        socket={socket}
        currentUser={currentUser}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
}

export default MessagingApp;