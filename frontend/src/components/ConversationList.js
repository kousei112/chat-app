import React from 'react';
import './ConversationList.css';

function ConversationList({ conversations, selectedConversation, onSelectConversation, currentUserId }) {
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / 60000);
    
    if (diffInMins < 1) return 'Vừa xong';
    if (diffInMins < 60) return `${diffInMins} phút`;
    if (diffInMins < 1440) return `${Math.floor(diffInMins / 60)} giờ`;
    if (diffInMins < 10080) return `${Math.floor(diffInMins / 1440)} ngày`;
    
    return date.toLocaleDateString('vi-VN');
  };

  const truncateMessage = (text, maxLength = 40) => {
    if (!text) return 'Không có tin nhắn';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h3>💬 Tin nhắn</h3>
      </div>

      <div className="conversation-items">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>Chưa có cuộc trò chuyện nào</p>
            <small>Bắt đầu chat với ai đó!</small>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.conversation_id}
              className={`conversation-item ${
                selectedConversation?.conversation_id === conv.conversation_id ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv)}
            >
              <div className="conv-avatar">
                <div className="avatar-circle">
                  {conv.other_full_name 
                    ? conv.other_full_name.charAt(0).toUpperCase()
                    : conv.other_username.charAt(0).toUpperCase()}
                </div>
                {conv.other_is_online && <span className="online-badge"></span>}
              </div>

              <div className="conv-content">
                <div className="conv-header-row">
                  <span className="conv-name">
                    {conv.other_full_name || conv.other_display_name || conv.other_username}
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
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationList;