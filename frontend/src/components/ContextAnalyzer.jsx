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
  ingestionResult: externalIngestionResult,
  onSelfieChange,
  onDescriptionChange,
  selfieFile: externalSelfieFile,
  description: externalDescription,
  lastFilterHash: externalFilterHash,
  onFilterHashChange,
  lastIngestionHash: externalIngestionHash,
  onIngestionHashChange,
  onStatsRefresh
}) {
  const [photo, setPhoto] = useState(externalSelfieFile || null);
  const [description, setDescription] = useState(externalDescription || '');
  const [email, setEmail] = useState('');
  const [ingestionResult, setIngestionResult] = useState(externalIngestionResult || null);
  const [filteredVideos, setFilteredVideos] = useState(externalFilteredVideos || null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(externalSelfieFile ? URL.createObjectURL(externalSelfieFile) : null);
  const [lastIngestionHash, setLastIngestionHash] = useState(externalIngestionHash || null);
  const [lastFilterHash, setLastFilterHash] = useState(externalFilterHash || null);
  const [usingCachedIngestion, setUsingCachedIngestion] = useState(false);
  const [usingCachedFilter, setUsingCachedFilter] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

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

  useEffect(() => {
    if (externalFilterHash !== undefined && externalFilterHash !== lastFilterHash) {
      setLastFilterHash(externalFilterHash);
    }
  }, [externalFilterHash]);

  useEffect(() => {
    if (externalIngestionHash !== undefined && externalIngestionHash !== lastIngestionHash) {
      setLastIngestionHash(externalIngestionHash);
    }
  }, [externalIngestionHash]);

  useEffect(() => {
    if (externalSelfieFile && externalSelfieFile !== photo) {
      setPhoto(externalSelfieFile);
      setPreviewUrl(URL.createObjectURL(externalSelfieFile));
    }
  }, [externalSelfieFile]);

  useEffect(() => {
    if (externalDescription !== undefined && externalDescription !== description) {
      setDescription(externalDescription);
    }
  }, [externalDescription]);

  const createRequestHash = (photoFile, desc, emailVal) => {
    return `${photoFile?.name || ''}_${photoFile?.size || ''}_${desc}_${emailVal || ''}`;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
      if (onSelfieChange) {
        onSelfieChange(file);
      }
    }
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setDescription(value);
    if (onDescriptionChange) {
      onDescriptionChange(value);
    }
  };

  const handleIngestVideos = async () => {
    if (!photo || !description) {
      setError('Please provide both a photo and description for ingestion.');
      return;
    }


    const currentHash = createRequestHash(photo, description, email);
    if (currentHash === lastIngestionHash && ingestionResult) {
      console.log('Using cached ingestion results');
      setUsingCachedIngestion(true);
      setTimeout(() => setUsingCachedIngestion(false), 2000);
      return;
    }

    setIsIngesting(true);
    setError(null);
    setUsingCachedIngestion(false);

    try {
      const formData = new FormData();
      formData.append('selfie', photo);
      formData.append('description', description);

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
        setLastIngestionHash(currentHash);
        if (onIngestionHashChange) {
          onIngestionHashChange(currentHash);
        }
        if (onIngestionResult) {
          onIngestionResult(response.data.data);
        }
        if (onStatsRefresh) {
          onStatsRefresh();
        }
      }
    } catch (error) {
      console.error('Ingestion error:', error);
      setError('Failed to ingest videos. Please try again.');
    }

    setIsIngesting(false);
  };

  const handleFilterVideos = async () => {
    if (!photo || !description) {
      setError('Please provide both a photo and description for filtering.');
      return;
    }


    const currentHash = createRequestHash(photo, description, email);
    if (currentHash === lastFilterHash && filteredVideos) {
      console.log('Using cached filter results');
      setUsingCachedFilter(true);
      setTimeout(() => setUsingCachedFilter(false), 2000);
      if (onFilteredVideos) {
        onFilteredVideos(filteredVideos);
      }
      return;
    }

    setIsFiltering(true);
    setError(null);
    setUsingCachedFilter(false);
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
        setLastFilterHash(currentHash);
        if (onFilterHashChange) {
          onFilterHashChange(currentHash);
        }
        setCurrentVideoIndex(0);
        
        if (onFilteredVideos) {
          onFilteredVideos(response.data.data);
        }
        
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

  const currentVideo = filteredVideos?.filteredVideos?.[currentVideoIndex];

  const getEmbedUrl = (video) => {
    if (!video) return '';
    
    const videoId = video.video_id || video.videoId || video.url?.split('v=')[1]?.split('&')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  };

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
        <div className={`input-group photo-upload-group ${photo ? 'has-photo' : ''}`}>
          <label><i className="fas fa-portrait"></i> Upload Selfie</label>
          <div className={`photo-upload-simple ${photo ? 'has-photo' : ''}`}>
            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              onChange={handlePhotoChange}
              className="file-input"
              style={{ display: 'none' }}
            />
            {previewUrl ? (
              <div className="photo-preview-simple">
                <label htmlFor="photo-upload" className="preview-image-label" title="Click to change photo">
                  <img src={previewUrl} alt="Preview" className="preview-image" />
                </label>
              </div>
            ) : (
              <label htmlFor="photo-upload" className="upload-button-simple">
                <i className="fas fa-upload"></i>
                <span>Choose Photo</span>
              </label>
            )}
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="description"><i className="fas fa-pen-to-square"></i> Describe Your Current Mood</label>
          <textarea
            id="description"
            placeholder="Tell us how you're feeling today... What's your current vibe? What kind of energy do you need?"
            value={description}
            onChange={handleDescriptionChange}
            rows="5"
          />
        </div>

      </div>

          <div className="analyzer-actions">
        <button 
          onClick={handleIngestVideos}
          disabled={isIngesting}
          className="ingest-button"
        >
          {isIngesting ? (
            <><i className="fas fa-circle-notch fa-spin"></i> Ingesting...</>
          ) : (
            <><i className="fas fa-server"></i> Ingest Videos</>
          )}
          {usingCachedIngestion && <i className="fas fa-check" style={{ marginLeft: '8px' }}></i>}
        </button>
        
        <button 
          onClick={handleFilterVideos}
          disabled={isFiltering}
          className="filter-button"
        >
          {isFiltering ? (
            <><i className="fas fa-circle-notch fa-spin"></i> Filtering...</>
          ) : (
            <><i className="fas fa-sliders"></i> Filter Videos</>
          )}
          {usingCachedFilter && <i className="fas fa-check" style={{ marginLeft: '8px' }}></i>}
        </button>

          </div>

          {ingestionResult && (
            <div className="analysis-results compact" style={{ marginTop: '16px' }}>
              <h4 style={{ color: '#28a745', marginBottom: '8px' }}>✅ Ingestion Complete</h4>
              <p className="success">
                Successfully stored {ingestionResult.analysis?.totalVideosStored || 0} videos in database
              </p>
            </div>
          )}

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