import { useState, useEffect } from 'react';

function VideoResults({ filteredVideos, ingestionResult, likedVideos = [], onLikedVideosChange }) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    setCurrentVideoIndex(0);
  }, [filteredVideos]);

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

  if (!filteredVideos && !ingestionResult) {
    return (
      <div className="empty-results">
        <p>Run analysis to see results here</p>
      </div>
    );
  }

  return (
    <div className="video-results">
      {ingestionResult && (
        <div className="analysis-results compact">
          <h4>Ingestion Complete</h4>
          <p className="success">
            {ingestionResult.analysis?.totalVideosStored || 0} videos stored
          </p>
        </div>
      )}

      {filteredVideos && filteredVideos.filteredVideos?.length > 0 && (
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
      )}
    </div>
  );
}

export default VideoResults;