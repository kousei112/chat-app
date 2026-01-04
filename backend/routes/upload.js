const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { authMiddleware } = require('../middleware/auth');
const path = require('path');

// Upload file
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileName = req.file.originalname;

    // Xác định loại message
    let messageType = 'file';
    if (fileType.startsWith('image/')) {
      messageType = 'image';
    } else if (fileType.startsWith('video/')) {
      messageType = 'video';
    } else if (fileType.startsWith('audio/')) {
      messageType = 'audio';
    }

    res.json({
      success: true,
      data: {
        fileUrl,
        fileName,
        fileSize,
        fileType,
        messageType
      }
    });

  } catch (error) {
    console.error('Lỗi upload file:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi upload file'
    });
  }
});

// Upload nhiều file (tùy chọn)
router.post('/upload-multiple', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có file được upload'
      });
    }

    const files = req.files.map(file => ({
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      messageType: file.mimetype.startsWith('image/') ? 'image' : 'file'
    }));

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Lỗi upload files:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi upload files'
    });
  }
});

module.exports = router;