import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:3002/api',
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// API methods
export const createMeme = async (selfieFile, description, videoId) => {
  const formData = new FormData();
  formData.append('selfie', selfieFile);
  formData.append('description', description);
  if (videoId) {
    formData.append('video_id', videoId);
  }

  const response = await api.post('/memes/create', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};

export const getContentStats = async () => {
  const response = await api.get('/ingest/content-stats');
  return response.data;
};

export default api;