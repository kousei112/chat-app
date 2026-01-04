import React, { useState, useEffect, useRef } from 'react';
import { conversationAPI, uploadAPI } from '../services/api';
import EmojiPicker from './EmojiPicker';
import './PrivateChatWindow.css';

function PrivateChatWindow({ socket, conversation, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;

    loadMessages();
    conversationAPI.markAsRead(conversation.conversation_id).catch(console.error);

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

    let receiverId = null;
    if (conversation.conversation_type === 'private') {
      receiverId = conversation.other_user_id;
    }

    socket.emit('send-private-message', {
      conversationId: conversation.conversation_id,
      receiverId: receiverId,
      text: inputMessage.trim(),
      messageType: 'text'
    });

    setInputMessage('');
    
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

  const handleEmojiSelect = (emoji) => {
    setInputMessage(prev => prev + emoji);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File quá lớn! Kích thước tối đa là 10MB');
      return;
    }

    try {
      setUploading(true);

      const response = await uploadAPI.uploadFile(file);
      
      if (response.data.success) {
        const { fileUrl, fileName, fileSize, fileType, messageType } = response.data.data;

        let receiverId = null;
        if (conversation.conversation_type === 'private') {
          receiverId = conversation.other_user_id;
        }

        socket.emit('send-private-message', {
          conversationId: conversation.conversation_id,
          receiverId: receiverId,
          text: fileName,
          messageType,
          fileUrl,
          fileName,
          fileSize,
          fileType
        });
      }

    } catch (error) {
      console.error('Lỗi upload file:', error);
      alert('Không thể upload file: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderMessage = (msg) => {
    const isSent = msg.sender_id === currentUser.userId;
    const isGroupChat = conversation.conversation_type === 'group';
    const senderName = msg.sender_full_name || msg.sender_display_name || msg.sender_username;

    if (msg.message_type === 'image' && msg.file_url) {
      return (
        <div key={msg.message_id} className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
          {isGroupChat && !isSent && (
            <div className="sender-name">{senderName}</div>
          )}
          <div className="message-image">
            <img 
              src={`http://localhost:5000${msg.file_url}`} 
              alt={msg.file_name}
              onClick={() => window.open(`http://localhost:5000${msg.file_url}`, '_blank')}
            />
          </div>
          {msg.message_text && msg.message_text !== msg.file_name && (
            <div className="message-content">{msg.message_text}</div>
          )}
          <div className="message-meta">
            <span className="message-time">{formatTime(msg.created_at)}</span>
            {isSent && msg.is_read && <span className="read-indicator">✓✓</span>}
          </div>
        </div>
      );
    }

    if (msg.message_type === 'file' && msg.file_url) {
      return (
        <div key={msg.message_id} className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
          {isGroupChat && !isSent && (
            <div className="sender-name">{senderName}</div>
          )}
          <div className="message-file">
            <div className="file-icon">📎</div>
            <div className="file-info">
              <div className="file-name">{msg.file_name}</div>
              <div className="file-size">{formatFileSize(msg.file_size)}</div>
            </div>
            <a 
              href={`http://localhost:5000${msg.file_url}`} 
              download={msg.file_name}
              className="file-download"
              target="_blank"
              rel="noopener noreferrer"
            >
              ⬇️
            </a>
          </div>
          <div className="message-meta">
            <span className="message-time">{formatTime(msg.created_at)}</span>
            {isSent && msg.is_read && <span className="read-indicator">✓✓</span>}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.message_id} className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
        {isGroupChat && !isSent && (
          <div className="sender-name">{senderName}</div>
        )}
        <div className="message-content">{msg.message_text}</div>
        <div className="message-meta">
          <span className="message-time">{formatTime(msg.created_at)}</span>
          {isSent && msg.is_read && <span className="read-indicator">✓✓</span>}
        </div>
      </div>
    );
  };

  const getHeaderInfo = () => {
    if (!conversation) return null;

    if (conversation.conversation_type === 'group') {
      return {
        name: conversation.group_name || 'Nhóm chat',
        avatar: conversation.group_name ? conversation.group_name.charAt(0).toUpperCase() : '👥',
        status: `${conversation.member_count || 0} thành viên`,
        isOnline: false,
        isGroup: true
      };
    } else {
      return {
        name: conversation.other_full_name || conversation.other_display_name || conversation.other_username || 'User',
        avatar: (conversation.other_full_name || conversation.other_username || 'U').charAt(0).toUpperCase(),
        status: conversation.other_is_online ? 'Online' : 'Offline',
        isOnline: conversation.other_is_online,
        isGroup: false
      };
    }
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

  const headerInfo = getHeaderInfo();

  return (
    <div className="private-chat-window">
      <div className="chat-window-header">
        <div className="header-user-info">
          <div className={`header-avatar ${headerInfo.isGroup ? 'group-header-avatar' : ''}`}>
            {headerInfo.avatar}
          </div>
          <div className="header-user-details">
            <div className="header-user-name">
              {headerInfo.name}
            </div>
            <div className="header-user-status">
              {headerInfo.isGroup ? (
                <>{headerInfo.status}</>
              ) : (
                <>
                  <span className={`status-dot ${headerInfo.isOnline ? 'online' : ''}`}></span>
                  {headerInfo.status}
                </>
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
          messages.map(msg => renderMessage(msg))
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <div className="typing-indicator">
          {typingUser} đang gõ<span className="typing-dots">...</span>
        </div>
      )}

      {uploading && (
        <div className="uploading-indicator">
          <div className="spinner"></div>
          <span>Đang upload...</span>
        </div>
      )}

      <form className="message-input-area" onSubmit={handleSendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />
        
        <button
          type="button"
          className="action-btn file-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Đính kèm file"
        >
          📎
        </button>

        <button
          type="button"
          className="action-btn emoji-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Chọn emoji"
        >
          😊
        </button>

        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            handleTyping();
          }}
        />

        <button type="submit" disabled={!inputMessage.trim() || uploading}>
          📤
        </button>
      </form>

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}

export default PrivateChatWindow;