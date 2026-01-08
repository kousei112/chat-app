import React, { useState, useEffect, useRef } from 'react';
import { conversationAPI, uploadAPI, reactionAPI } from '../services/api';
import EmojiPicker from './EmojiPicker';
import ReactionPicker from './ReactionPicker';
import Avatar from './Avatar';
import SearchMessages from './SearchMessages';
import MediaGallery from './MediaGallery';
import './PrivateChatWindow.css';

function PrivateChatWindow({ socket, conversation, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
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
    socket.on('message-reaction-update', handleReactionUpdate);
    socket.on('message-recalled', handleMessageRecalled);

    return () => {
      socket.off('receive-private-message', handleReceiveMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleStopTyping);
      socket.off('message-reaction-update', handleReactionUpdate);
      socket.off('message-recalled', handleMessageRecalled);
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

  const handleReactionUpdate = (data) => {
    if (data.conversationId === conversation.conversation_id) {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.message_id === data.messageId 
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    }
  };

  const handleMessageRecalled = (data) => {
    if (data.conversationId === conversation.conversation_id) {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.message_id === data.messageId
            ? { ...msg, is_recalled: true, recalled_at: data.recalledAt }
            : msg
        )
      );
    }
  };

  const handleRecallMessage = async (messageId) => {
    if (!window.confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) {
      return;
    }

    try {
      const response = await conversationAPI.recallMessage(
        conversation.conversation_id,
        messageId
      );

      if (response.data.success) {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.message_id === messageId
              ? { ...msg, is_recalled: true, recalled_at: new Date() }
              : msg
          )
        );

        socket.emit('message-recalled', {
          conversationId: conversation.conversation_id,
          messageId,
          recalledAt: new Date()
        });
      }
    } catch (error) {
      console.error('Lỗi thu hồi tin nhắn:', error);
      alert('Không thể thu hồi tin nhắn');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const response = await reactionAPI.addReaction(messageId, emoji);
      
      if (response.data.success) {
        const updatedReactions = response.data.data.reactions;
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.message_id === messageId 
              ? { ...msg, reactions: updatedReactions }
              : msg
          )
        );
        
        socket.emit('message-reaction', {
          conversationId: conversation.conversation_id,
          messageId,
          reactions: updatedReactions
        });
      }
    } catch (error) {
      console.error('Lỗi thả reaction:', error);
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
    // Xử lý timestamp theo múi giờ Việt Nam (UTC+7)
    // Do backend trả về UTC, ta cần cộng thêm offset
    const utcDate = new Date(timestamp);
    const vnDate = new Date(utcDate.getTime() - 14 * 60 * 60 * 1000);
    return vnDate.toLocaleTimeString('vi-VN', { 
      timeZone: 'Asia/Ho_Chi_Minh',
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

  const renderReactions = (msg) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;

    return (
      <div className="message-reactions">
        {msg.reactions.map((reaction, idx) => {
          const isReactedByMe = reaction.userIds.includes(currentUser.userId);
          return (
            <button
              key={idx}
              className={`reaction-item ${isReactedByMe ? 'reacted-by-me' : ''}`}
              onClick={() => handleReaction(msg.message_id, reaction.emoji)}
              title={`${reaction.count} người`}
            >
              <span className="reaction-emoji">{reaction.emoji}</span>
              <span className="reaction-count">{reaction.count}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderMessage = (msg) => {
    const isSent = msg.sender_id === currentUser.userId;
    const isGroupChat = conversation.conversation_type === 'group';
    const senderName = msg.sender_full_name || msg.sender_display_name || msg.sender_username;

    const renderSenderInfo = () => {
      if (!isGroupChat || isSent) return null;
      
      return (
        <div className="message-sender-info">
          <Avatar 
            user={{
              avatar_url: msg.sender_avatar_url,
              full_name: msg.sender_full_name,
              display_name: msg.sender_display_name,
              username: msg.sender_username
            }}
            size="small"
            className="message-avatar"
          />
          <div className="sender-name">{senderName}</div>
        </div>
      );
    };

    const renderMessageActions = () => {
      if (!isSent || msg.is_recalled) return null;

      return (
        <div className="message-actions-inline">
          <button
            className="message-action-btn-inline recall-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleRecallMessage(msg.message_id);
            }}
            title="Thu hồi tin nhắn"
          >
            ↩️
          </button>
        </div>
      );
    };

    // TIN NHẮN ĐÃ THU HỒI
    if (msg.is_recalled) {
      return (
        <div key={msg.message_id} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
          <div className={`message-bubble ${isSent ? 'sent' : 'received'} recalled`}>
            {renderSenderInfo()}
            <div className="message-recalled-text">
              <span className="recalled-icon">↩️</span>
              Tin nhắn đã bị thu hồi.
            </div>
            <div className="message-meta">
              <span className="message-time">{formatTime(msg.recalled_at || msg.created_at)}</span>
            </div>
          </div>
        </div>
      );
    }

    // TIN NHẮN HÌNH ẢNH
    if (msg.message_type === 'image' && msg.file_url) {
      return (
        <div key={msg.message_id} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
          <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
            {renderSenderInfo()}
            {renderMessageActions()}
            
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
            
            <button 
              className="add-reaction-btn"
              onClick={() => setShowReactionPicker(msg.message_id)}
            >
              😊+
            </button>
            
            {showReactionPicker === msg.message_id && (
              <ReactionPicker
                onSelect={(emoji) => handleReaction(msg.message_id, emoji)}
                onClose={() => setShowReactionPicker(null)}
                position={isSent ? 'top' : 'bottom'}
              />
            )}
          </div>
          {renderReactions(msg)}
        </div>
      );
    }

    // TIN NHẮN FILE
    if (msg.message_type === 'file' && msg.file_url) {
      return (
        <div key={msg.message_id} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
          <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
            {renderSenderInfo()}
            {renderMessageActions()}
            
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
            
            <button 
              className="add-reaction-btn"
              onClick={() => setShowReactionPicker(msg.message_id)}
            >
              😊+
            </button>
            
            {showReactionPicker === msg.message_id && (
              <ReactionPicker
                onSelect={(emoji) => handleReaction(msg.message_id, emoji)}
                onClose={() => setShowReactionPicker(null)}
                position={isSent ? 'top' : 'bottom'}
              />
            )}
          </div>
          {renderReactions(msg)}
        </div>
      );
    }

    // TIN NHẮN TEXT
    return (
      <div key={msg.message_id} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
        <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
          {renderSenderInfo()}
          {renderMessageActions()}
          
          <div className="message-content">{msg.message_text}</div>
          <div className="message-meta">
            <span className="message-time">{formatTime(msg.created_at)}</span>
            {isSent && msg.is_read && <span className="read-indicator">✓✓</span>}
          </div>
          
          <button 
            className="add-reaction-btn"
            onClick={() => setShowReactionPicker(msg.message_id)}
          >
            😊+
          </button>
          
          {showReactionPicker === msg.message_id && (
            <ReactionPicker
              onSelect={(emoji) => handleReaction(msg.message_id, emoji)}
              onClose={() => setShowReactionPicker(null)}
              position={isSent ? 'top' : 'bottom'}
            />
          )}
        </div>
        {renderReactions(msg)}
      </div>
    );
  };

  const getHeaderInfo = () => {
    if (!conversation) return null;

    if (conversation.conversation_type === 'group') {
      return {
        name: conversation.group_name || 'Nhóm chat',
        isGroup: true
      };
    } else {
      return {
        name: conversation.other_full_name || conversation.other_display_name || conversation.other_username || 'User',
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
          {headerInfo.isGroup ? (
            <Avatar
              user={{
                avatar_url: conversation.group_avatar_url,
                full_name: conversation.group_name
              }}
              size="large"
              className="group-avatar"
            />
          ) : (
            <Avatar
              user={{
                avatar_url: conversation.other_avatar_url,
                full_name: conversation.other_full_name,
                display_name: conversation.other_display_name,
                username: conversation.other_username
              }}
              size="large"
            />
          )}
          
          <div className="header-user-details">
            <div className="header-user-name">
              {headerInfo.name}
            </div>
            <div className="header-user-status">
              {headerInfo.isGroup ? (
                <>{conversation.member_count || 0} thành viên</>
              ) : (
                <>
                  <span className={`status-dot ${headerInfo.isOnline ? 'online' : ''}`}></span>
                  {headerInfo.status}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="header-action-btn"
            onClick={() => setShowSearch(true)}
            title="Tìm kiếm"
          >
            🔍
          </button>
          <button
            className="header-action-btn"
            onClick={() => setShowMedia(true)}
            title="Ảnh & File"
          >
            📁
          </button>
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

      {showSearch && (
        <SearchMessages
          conversation={conversation}
          onClose={() => setShowSearch(false)}
          onSelectMessage={(messageId) => {
            console.log('Selected message:', messageId);
          }}
        />
      )}

      {showMedia && (
        <MediaGallery
          conversation={conversation}
          onClose={() => setShowMedia(false)}
        />
      )}
    </div>
  );
}

export default PrivateChatWindow;