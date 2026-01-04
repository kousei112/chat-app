import React, { useState, useEffect, useRef } from 'react';
import { conversationAPI } from '../services/api';
import './PrivateChatWindow.css';

function PrivateChatWindow({ socket, conversation, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;

    // Load messages
    loadMessages();

    // Mark as read
    conversationAPI.markAsRead(conversation.conversation_id).catch(console.error);

    // Socket listeners
    socket.on('receive-private-message', handleReceiveMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleStopTyping);

    return () => {
      socket.off('receive-private-message', handleReceiveMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleStopTyping);
    };
  }, [conversation]);

  const loadMessages = async () => {
    try {
      const response = await conversationAPI.getMessages(conversation.conversation_id);
      if (response.data.success) {
        setMessages(response.data.data.messages);
      }
    } catch (error) {
      console.error('Lỗi load messages:', error);
    }
  };

  const handleReceiveMessage = (message) => {
    if (message.conversation_id === conversation.conversation_id) {
      setMessages(prev => [...prev, message]);
      
      // Mark as read if message is for current user
      if (message.receiver_id === currentUser.userId) {
        conversationAPI.markAsRead(conversation.conversation_id).catch(console.error);
      }
    }
  };

  const handleUserTyping = (data) => {
    if (data.conversationId === conversation.conversation_id && data.userId !== currentUser.userId) {
      setTypingUser(data.username);
    }
  };

  const handleStopTyping = (data) => {
    if (data.conversationId === conversation.conversation_id) {
      setTypingUser(null);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !conversation) return;

    socket.emit('send-private-message', {
      conversationId: conversation.conversation_id,
      receiverId: conversation.other_user_id,
      text: inputMessage.trim()
    });

    setInputMessage('');
    
    // Stop typing event
    if (conversation?.conversation_id) {
      socket.emit('stop-typing', { conversationId: conversation.conversation_id });
    }
  };

  const handleTyping = () => {
    if (!conversation?.conversation_id) return;
    
    socket.emit('typing', { 
      conversationId: conversation.conversation_id,
      userId: currentUser.userId,
      username: currentUser.displayName || currentUser.username
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (conversation?.conversation_id) {
        socket.emit('stop-typing', { conversationId: conversation.conversation_id });
      }
    }, 1000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!conversation) {
    return (
      <div className="no-conversation-selected">
        <div className="empty-state">
          <h2>💬</h2>
          <p>Chọn một cuộc trò chuyện để bắt đầu</p>
          <small>Hoặc nhấn nút ➕ để chat với ai đó</small>
        </div>
      </div>
    );
  }

  return (
    <div className="private-chat-window">
      <div className="chat-window-header">
        <div className="header-user-info">
          <div className="header-avatar">
            {conversation.other_full_name
              ? conversation.other_full_name.charAt(0).toUpperCase()
              : conversation.other_username.charAt(0).toUpperCase()}
          </div>
          <div className="header-user-details">
            <div className="header-user-name">
              {conversation.other_full_name || conversation.other_display_name || conversation.other_username}
            </div>
            <div className="header-user-status">
              {conversation.other_is_online ? (
                <><span className="status-dot online"></span> Online</>
              ) : (
                <><span className="status-dot"></span> Offline</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>Chưa có tin nhắn nào</p>
            <small>Bắt đầu cuộc trò chuyện!</small>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.message_id}
              className={`message-bubble ${
                msg.sender_id === currentUser.userId ? 'sent' : 'received'
              }`}
            >
              <div className="message-content">
                {msg.message_text}
              </div>
              <div className="message-meta">
                <span className="message-time">{formatTime(msg.created_at)}</span>
                {msg.sender_id === currentUser.userId && msg.is_read && (
                  <span className="read-indicator">✓✓</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <div className="typing-indicator">
          {typingUser} đang gõ<span className="typing-dots">...</span>
        </div>
      )}

      <form className="message-input-area" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            handleTyping();
          }}
        />
        <button type="submit" disabled={!inputMessage.trim()}>
          📤 Gửi
        </button>
      </form>
    </div>
  );
}

export default PrivateChatWindow;