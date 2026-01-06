import React, { useState } from 'react';
import { conversationAPI } from '../services/api';
import Avatar from './Avatar';
import './SearchMessages.css';

function SearchMessages({ conversation, onClose, onSelectMessage }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!keyword.trim() || keyword.trim().length < 2) {
      alert('Vui lòng nhập ít nhất 2 ký tự');
      return;
    }

    try {
      setSearching(true);
      const response = await conversationAPI.searchMessages(
        conversation.conversation_id,
        keyword.trim()
      );

      if (response.data.success) {
        setResults(response.data.data.results);
        setSearched(true);
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm:', error);
      alert('Không thể tìm kiếm tin nhắn');
    } finally {
      setSearching(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const highlightKeyword = (text) => {
    if (!keyword.trim()) return text;
    
    const regex = new RegExp(`(${keyword.trim()})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h3>🔍 Tìm kiếm tin nhắn</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="search-modal-content">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={searching}>
              {searching ? '⏳' : '🔍'}
            </button>
          </form>

          <div className="search-results">
            {!searched && (
              <div className="search-empty">
                <p>Nhập từ khóa và nhấn Enter để tìm kiếm</p>
              </div>
            )}

            {searched && results.length === 0 && (
              <div className="search-empty">
                <p>❌ Không tìm thấy kết quả nào</p>
                <small>Thử từ khóa khác</small>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="search-count">
                  Tìm thấy {results.length} kết quả
                </div>
                <div className="search-list">
                  {results.map((msg) => (
                    <div
                      key={msg.message_id}
                      className="search-result-item"
                      onClick={() => {
                        onSelectMessage && onSelectMessage(msg.message_id);
                        onClose();
                      }}
                    >
                      <Avatar
                        user={{
                          avatar_url: msg.sender_avatar_url,
                          full_name: msg.sender_full_name,
                          display_name: msg.sender_display_name,
                          username: msg.sender_username
                        }}
                        size="medium"
                      />
                      <div className="search-result-content">
                        <div className="search-result-sender">
                          {msg.sender_full_name || msg.sender_display_name || msg.sender_username}
                        </div>
                        <div className="search-result-text">
                          {highlightKeyword(msg.message_text)}
                        </div>
                        <div className="search-result-time">
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchMessages;