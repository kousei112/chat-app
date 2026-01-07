import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Thêm token vào header nếu có
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: (userId) => api.post('/auth/logout', { userId })
};

// Message APIs
export const messageAPI = {
  getHistory: (roomId, limit = 50, offset = 0) => 
    api.get(`/messages/history/${roomId}?limit=${limit}&offset=${offset}`),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
  searchMessages: (keyword, roomId = 1) => 
    api.get(`/messages/search?keyword=${keyword}&roomId=${roomId}`)
};

// User APIs
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  completeProfile: (profileData) => api.post('/users/complete-profile', profileData),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
  getAllUsers: () => api.get('/users/all'),
  uploadAvatar: (avatarUrl) => api.post('/users/upload-avatar', { avatarUrl }),
  updateTheme: (theme) => api.post('/users/update-theme', { theme })
};

// Conversation APIs
export const conversationAPI = {
  getConversations: () => api.get('/conversations'),
  getOrCreateConversation: (otherUserId) => api.post('/conversations/get-or-create', { otherUserId }),
  getMessages: (conversationId, limit = 50, offset = 0) => 
    api.get(`/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`),
  markAsRead: (conversationId) => api.post(`/conversations/${conversationId}/mark-read`),
  deleteConversation: (conversationId) => api.delete(`/conversations/${conversationId}`),
  searchMessages: (conversationId, keyword) => 
    api.get(`/conversations/${conversationId}/search?keyword=${encodeURIComponent(keyword)}`),
  getMedia: (conversationId, type = 'all') => 
    api.get(`/conversations/${conversationId}/media?type=${type}`),
  recallMessage: (conversationId, messageId) =>
    api.post(`/conversations/${conversationId}/messages/${messageId}/recall`)
};

// Upload APIs
export const uploadAPI = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

// Group APIs
export const groupAPI = {
  createGroup: (data) => api.post('/groups/create', data),
  getGroupInfo: (conversationId) => api.get(`/groups/${conversationId}`),
  addMembers: (conversationId, memberIds) => 
    api.post(`/groups/${conversationId}/add-members`, { memberIds }),
  removeMember: (conversationId, memberId) => 
    api.post(`/groups/${conversationId}/remove-member`, { memberId }),
  leaveGroup: (conversationId) => api.post(`/groups/${conversationId}/leave`),
  updateGroupName: (conversationId, groupName) => 
    api.put(`/groups/${conversationId}/name`, { groupName }),
  promoteToAdmin: (conversationId, memberId) => 
    api.post(`/groups/${conversationId}/promote`, { memberId }),
  uploadGroupAvatar: (conversationId, avatarUrl) => 
    api.post(`/groups/${conversationId}/upload-avatar`, { avatarUrl })
};

// Reaction APIs
export const reactionAPI = {
  addReaction: (messageId, emoji) => 
    api.post(`/reactions/${messageId}/react`, { emoji }),
  removeReaction: (messageId, emoji) => 
    api.delete(`/reactions/${messageId}/react`, { data: { emoji } }),
  getReactions: (messageId) => 
    api.get(`/reactions/${messageId}/reactions`)
};

export default api;