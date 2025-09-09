import { useState, useEffect } from 'react';
import api from '../utils/api';

function ContextAnalyzer({ 
  showInputs = true, 
  showResults = true, 
  onFilteredVideos, 
  onIngestionResult,
  likedVideos = [],
  onLikedVideosChange,
  filteredVideos: externalFilteredVideos,
  ingestionResult: externalIngestionResult 
}) {
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [ingestionResult, setIngestionResult] = useState(externalIngestionResult || null);
  const [filteredVideos, setFilteredVideos] = useState(externalFilteredVideos || null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Update local state when external props change
  useEffect(() => {
    if (externalFilteredVideos) {
      setFilteredVideos(externalFilteredVideos);
      setCurrentVideoIndex(0);
    }
  }, [externalFilteredVideos]);

  useEffect(() => {
    if (externalIngestionResult) {
      setIngestionResult(externalIngestionResult);
    }
  }, [externalIngestionResult]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Ingest videos - analyze and store
  const handleIngestVideos = async () => {
    if (!photo || !description) {
      setError('Please provide both a photo and description for ingestion.');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setIngestionResult(null);

    try {
      const formData = new FormData();
      formData.append('selfie', photo);
      formData.append('description', description);
      formData.append('likedVideoIds', JSON.stringify(likedVideos.map(v => v.video_id || v.videoId)));


      if (email.trim()) {
        formData.append('email', email.trim());
      }
      
      const response = await api.post('/agent/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Ingestion response:', response.data);
      
      if (response.data.data) {
        setIngestionResult(response.data.data);
        if (onIngestionResult) {
          onIngestionResult(response.data.data);
        }
      }
    } catch (error) {
      console.error('Ingestion error:', error);
      setError('Failed to ingest videos. Please try again.');
    }

    setIsIngesting(false);
  };

  // Filter videos based on context
  const handleFilterVideos = async () => {
    if (!photo || !description) {
      setError('Please provide both a photo and description for filtering.');
      return;
    }

    setIsFiltering(true);
    setError(null);
    setFilteredVideos(null);
    setCurrentVideoIndex(0);

    try {
      const formData = new FormData();
      formData.append('selfie', photo);
      formData.append('description', description);
      
      if (email.trim()) {
        formData.append('email', email.trim());
      }

      const response = await api.post('/agent/filter', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Filtering response:', response.data);
      console.log('Filtered videos:', response.data.data?.filteredVideos);
      
      if (response.data.data) {
        setFilteredVideos(response.data.data);
        setCurrentVideoIndex(0);
        
        if (onFilteredVideos) {
          onFilteredVideos(response.data.data);
        }
        
        // Debug first video data
        if (response.data.data.filteredVideos?.length > 0) {
          console.log('First video:', response.data.data.filteredVideos[0]);
        }
      }
    } catch (error) {
      console.error('Filtering error:', error);
      setError('Failed to filter videos. Please try again.');
    }

    setIsFiltering(false);
  };

  // Navigation functions for filtered videos
  const nextVideo = () => {
    if (filteredVideos?.filteredVideos && currentVideoIndex < filteredVideos.filteredVideos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const prevVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!filteredVideos?.filteredVideos?.length) return;
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        prevVideo();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextVideo();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentVideoIndex, filteredVideos]);

  // Get current video
  const currentVideo = filteredVideos?.filteredVideos?.[currentVideoIndex];

  // Convert YouTube URL to embed URL
  const getEmbedUrl = (video) => {
    if (!video) return '';
    
    // Handle both video_id (from database) and videoId (from API)
    const videoId = video.video_id || video.videoId || video.url?.split('v=')[1]?.split('&')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  };

  // Handle liking a video
  const handleLikeVideo = (video) => {
    const videoId = video.video_id || video.videoId;
    if (!videoId) return;

    const isLiked = likedVideos.find(v => (v.video_id || v.videoId) === videoId);
    const newLiked = isLiked 
      ? likedVideos.filter(v => (v.video_id || v.videoId) !== videoId)
      : [...likedVideos, video];
    
    if (onLikedVideosChange) {
      onLikedVideosChange(newLiked);
    }
  };

  // Check if current video is liked
  const isVideoLiked = (video) => {
    if (!video) return false;
    const videoId = video.video_id || video.videoId;
    return likedVideos.some(v => (v.video_id || v.videoId) === videoId);
  };

  return (
    <div className="context-analyzer">
      {showInputs && (
        <>
          <div className="analyzer-inputs">
        <div className="input-group">
          <label htmlFor="photo-upload">Photo (Required):</label>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            onChange={handlePhotoChange}
            className="file-input"
          />
          <label htmlFor="photo-upload" className="file-label">
            {photo ? 'Change Photo' : 'Choose Photo'}
          </label>
          {previewUrl && (
            <div className="photo-preview">
              <img src={previewUrl} alt="Preview" className="preview-image" />
            </div>
          )}
        </div>

        <div className="input-group">
          <label htmlFor="description">Description (Required):</label>
          <textarea
            id="description"
            placeholder="Describe your current context or situation..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
          />
        </div>

        <div className="input-group">
          <label htmlFor="email">Email (Optional):</label>
          <input
            type="email"
            id="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

          <div className="analyzer-actions">
        <button 
          onClick={handleIngestVideos}
          disabled={isIngesting}
          className="ingest-button"
        >
          {isIngesting ? 'Ingesting Videos...' : '1. Ingest Videos'}
        </button>
        
        <button 
          onClick={handleFilterVideos}
          disabled={isFiltering}
          className="filter-button"
        >
          {isFiltering ? 'Filtering...' : '2. Get Filtered Videos'}
        </button>

          </div>


          {error && (
        <div className="error-message">
          {error}
        </div>
          )}
        </>
      )}

      {showResults && (
        <>
          {ingestionResult && (
        <div className="analysis-results">
          <h3>Ingestion Results:</h3>
          <div className="analysis-content">
            {ingestionResult.analysis?.tags && (
              <div className="analysis-section">
                <h4>Generated Tags:</h4>
                <div className="tags-list">
                  {ingestionResult.analysis.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {ingestionResult.analysis?.emotions && ingestionResult.analysis.emotions.length > 0 && (
              <div className="analysis-section">
                <h4>Detected Emotions:</h4>
                <ul>
                  {ingestionResult.analysis.emotions.map((emotion, index) => (
                    <li key={index}>
                      {emotion.Type}: {(emotion.Confidence || 0).toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ingestionResult.analysis?.totalVideosStored !== undefined && (
              <div className="analysis-section">
                <h4>Videos Stored:</h4>
                <p className="success">
                  Successfully stored {ingestionResult.analysis.totalVideosStored} videos in database
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {filteredVideos && (
        <div className="analysis-results">
          <h3>Filtered Videos ({filteredVideos.totalVideos || 0}):</h3>
          <div className="analysis-content">
            {filteredVideos.filteredVideos && filteredVideos.filteredVideos.length > 0 ? (
              <div className="video-carousel">
                {/* Current Video Display */}
                <div className="video-container">
                  <iframe
                    src={getEmbedUrl(currentVideo)}
                    className="video-iframe"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={currentVideo?.title || 'Video'}
                  />
                </div>

                {/* Video Info */}
                <div className="video-info">
                  <div className="video-header">
                    <h3>{currentVideo?.title}</h3>
                    <button 
                      onClick={() => handleLikeVideo(currentVideo)}
                      className={`heart-button ${isVideoLiked(currentVideo) ? 'liked' : ''}`}
                      title={isVideoLiked(currentVideo) ? 'Unlike video' : 'Like video'}
                    >
                      ❤️
                    </button>
                  </div>
                  <div className="video-meta">
                    <span className="channel">{currentVideo?.channel_title || currentVideo?.channelTitle}</span>
                    {(currentVideo?.similarity || currentVideo?.similarity_score) && (
                      <span className="similarity">
                        Match: {((currentVideo.similarity || currentVideo.similarity_score) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="video-description">{currentVideo?.description}</p>
                </div>

                {/* Navigation Controls */}
                <div className="carousel-controls">
                  <button 
                    onClick={prevVideo} 
                    disabled={currentVideoIndex === 0}
                    className="nav-button"
                  >
                    ↑ Previous
                  </button>
                  
                  <span className="video-counter">
                    {currentVideoIndex + 1} / {filteredVideos.filteredVideos.length}
                  </span>
                  
                  <button 
                    onClick={nextVideo} 
                    disabled={currentVideoIndex === filteredVideos.filteredVideos.length - 1}
                    className="nav-button"
                  >
                    ↓ Next
                  </button>
                </div>

                <div className="keyboard-hint">
                  Use ↑↓ arrow keys to navigate
                </div>
              </div>
            ) : (
              <p>No videos found matching your context. Try ingesting videos first.</p>
            )}
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}

export default ContextAnalyzer;