import React, { useRef, useEffect } from 'react';
import './ConversationList.css';

function ConversationList({ conversations, selectedConversation, onSelectConversation, currentUserId }) {
  
  // ✅ Ref để maintain scroll position
  const conversationItemsRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // ✅ Save scroll position mỗi khi có thay đổi
  const handleScroll = () => {
    if (conversationItemsRef.current) {
      scrollPositionRef.current = conversationItemsRef.current.scrollTop;
    }
  };

  // ✅ Restore scroll position sau khi render
  useEffect(() => {
    if (conversationItemsRef.current && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        if (conversationItemsRef.current) {
          conversationItemsRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  });

  // ===== FIX TIMEZONE: Convert UTC to Vietnam Time =====
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    // Parse timestamp as UTC
    const utcDate = new Date(timestamp);
    
    // Convert to Vietnam timezone (UTC+7)
    const vnDate = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
    
    // Get current time in Vietnam
    const now = new Date();
    const nowVN = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    
    const diffInMs = nowVN - vnDate;
    const diffInMins = Math.floor(diffInMs / 60000);
    
    // Less than 1 minute
    if (diffInMins < 1) return 'Vừa xong';
    
    // Less than 60 minutes
    if (diffInMins < 60) return `${diffInMins} phút`;
    
    // Less than 24 hours
    if (diffInMins < 1440) {
      const hours = Math.floor(diffInMins / 60);
      return `${hours} giờ`;
    }
    
    // Less than 7 days
    if (diffInMins < 10080) {
      const days = Math.floor(diffInMins / 1440);
      return `${days} ngày`;
    }
    
    // More than 7 days - show date
    return vnDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const truncateMessage = (text, maxLength = 40) => {
    if (!text) return 'Không có tin nhắn';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleSelectConversation = (conv, event) => {
    // ✅ Prevent default scroll behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Save current scroll position
    if (conversationItemsRef.current) {
      scrollPositionRef.current = conversationItemsRef.current.scrollTop;
    }

    // Call parent handler
    onSelectConversation(conv);
  };

  return (
    <div className="conversation-list">
      <div 
        className="conversation-items" 
        ref={conversationItemsRef}
        onScroll={handleScroll}
      >
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>Chưa có cuộc trò chuyện nào</p>
            <small>Bắt đầu chat với ai đó!</small>
          </div>
        ) : (
          conversations.map((conv) => {
            const displayName = conv.conversation_type === 'group' 
              ? conv.group_name
              : (conv.other_full_name || conv.other_display_name || conv.other_username);

            const avatarLetter = conv.conversation_type === 'group'
              ? (conv.group_name ? conv.group_name.charAt(0).toUpperCase() : '👥')
              : (conv.other_full_name 
                  ? conv.other_full_name.charAt(0).toUpperCase()
                  : conv.other_username.charAt(0).toUpperCase());

            return (
              <div
                key={conv.conversation_id}
                className={`conversation-item ${
                  selectedConversation?.conversation_id === conv.conversation_id ? 'active' : ''
                }`}
                onClick={(e) => handleSelectConversation(conv, e)}
              >
                <div className="conv-avatar">
                  <div className={`avatar-circle ${conv.conversation_type === 'group' ? 'group-avatar' : ''}`}>
                    {avatarLetter}
                  </div>
                  {conv.conversation_type === 'private' && conv.other_is_online && (
                    <span className="online-badge"></span>
                  )}
                </div>

                <div className="conv-content">
                  <div className="conv-header-row">
                    <span className="conv-name">
                      {displayName}
                      {conv.conversation_type === 'group' && (
                        <span className="member-count"> ({conv.member_count})</span>
                      )}
                    </span>
                    <span className="conv-time">{formatTime(conv.last_message_time)}</span>
                  </div>
                  
                  <div className="conv-last-message">
                    {conv.last_sender_id === currentUserId && <span className="you-label">Bạn: </span>}
                    <span className={conv.unread_count > 0 ? 'unread-message' : ''}>
                      {truncateMessage(conv.last_message)}
                    </span>
                  </div>
                </div>

                {conv.unread_count > 0 && (
                  <div className="unread-badge">{conv.unread_count}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationList;