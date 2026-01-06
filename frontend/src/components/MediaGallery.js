import React, { useState, useEffect } from 'react';
import { conversationAPI } from '../services/api';
import './MediaGallery.css';

function MediaGallery({ conversation, onClose }) {
  const [activeTab, setActiveTab] = useState('image');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadMedia(activeTab);
  }, [activeTab]);

  const loadMedia = async (type) => {
    try {
      setLoading(true);
      const response = await conversationAPI.getMedia(conversation.conversation_id, type);
      
      if (response.data.success) {
        setMedia(response.data.data.media);
      }
    } catch (error) {
      console.error('Lỗi load media:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  return (
    <>
      <div className="media-modal-overlay" onClick={onClose}>
        <div className="media-modal" onClick={(e) => e.stopPropagation()}>
          <div className="media-modal-header">
            <h3>📁 Ảnh & File</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="media-tabs">
            <button
              className={`media-tab ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => setActiveTab('image')}
            >
              🖼️ Ảnh
            </button>
            <button
              className={`media-tab ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              📎 File
            </button>
            <button
              className={`media-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              📂 Tất cả
            </button>
          </div>

          <div className="media-modal-content">
            {loading && (
              <div className="media-loading">
                <div className="spinner"></div>
                <p>Đang tải...</p>
              </div>
            )}

            {!loading && media.length === 0 && (
              <div className="media-empty">
                <p>📭 Chưa có {activeTab === 'image' ? 'ảnh' : activeTab === 'file' ? 'file' : 'media'} nào</p>
              </div>
            )}

            {!loading && media.length > 0 && (
              <>
                {activeTab === 'image' && (
                  <div className="media-grid">
                    {media.map((item) => (
                      <div
                        key={item.message_id}
                        className="media-grid-item"
                        onClick={() => handleImageClick(item.file_url)}
                      >
                        <img
                          src={`http://localhost:5000${item.file_url}`}
                          alt={item.file_name}
                        />
                        <div className="media-overlay">
                          <div className="media-date">{formatTime(item.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'file' && (
                  <div className="file-list">
                    {media.map((item) => (
                      <div key={item.message_id} className="file-list-item">
                        <div className="file-icon">📄</div>
                        <div className="file-details">
                          <div className="file-name">{item.file_name}</div>
                          <div className="file-meta">
                            {formatFileSize(item.file_size)} • {formatTime(item.created_at)}
                          </div>
                        </div>
                        <a
                          href={`http://localhost:5000${item.file_url}`}
                          download={item.file_name}
                          className="file-download-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⬇️
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'all' && (
                  <div className="mixed-media-list">
                    {media.map((item) => (
                      <div key={item.message_id} className="mixed-media-item">
                        {item.message_type === 'image' ? (
                          <div
                            className="mixed-media-image"
                            onClick={() => handleImageClick(item.file_url)}
                          >
                            <img
                              src={`http://localhost:5000${item.file_url}`}
                              alt={item.file_name}
                            />
                            <div className="media-date">{formatTime(item.created_at)}</div>
                          </div>
                        ) : (
                          <div className="mixed-media-file">
                            <div className="file-icon">📄</div>
                            <div className="file-details">
                              <div className="file-name">{item.file_name}</div>
                              <div className="file-meta">
                                {formatFileSize(item.file_size)} • {formatTime(item.created_at)}
                              </div>
                            </div>
                            <a
                              href={`http://localhost:5000${item.file_url}`}
                              download={item.file_name}
                              className="file-download-btn"
                            >
                              ⬇️
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={closeImageViewer}>
          <div className="image-viewer">
            <button className="image-viewer-close" onClick={closeImageViewer}>
              ✕
            </button>
            <img
              src={`http://localhost:5000${selectedImage}`}
              alt="Full size"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default MediaGallery;