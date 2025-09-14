import { useState, useEffect } from 'react';
import { createMeme } from '../utils/api';

function VideoResults({ filteredVideos, ingestionResult, likedVideos = [], onLikedVideosChange, selfieFile, description, onMemeGenerated, onMemeError, onMemeGenerating }) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [generatingMeme, setGeneratingMeme] = useState(false);

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

  const handleGenerateMeme = async (video) => {
    if (!selfieFile || !description) {
      if (onMemeError) onMemeError('Selfie and description are required to generate memes');
      return;
    }

    setGeneratingMeme(true);
    if (onMemeGenerating) onMemeGenerating(true);
    if (onMemeError) onMemeError(null);
    if (onMemeGenerated) onMemeGenerated(null);

    try {
      const videoId = video.video_id || video.videoId;
      const result = await createMeme(selfieFile, description, videoId);
      
      if (onMemeGenerated) onMemeGenerated(result.data);
    } catch (error) {
      if (onMemeError) onMemeError(error.response?.data?.message || 'Failed to generate meme');
    } finally {
      setGeneratingMeme(false);
      if (onMemeGenerating) onMemeGenerating(false);
    }
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

          <div className="video-actions-below">
            <button 
              onClick={() => handleLikeVideo(currentVideo)}
              className={`like-button-new ${isVideoLiked(currentVideo) ? 'liked' : ''}`}
              title={isVideoLiked(currentVideo) ? 'Unlike video' : 'Like video'}
            >
              <i className="fas fa-heart"></i> {isVideoLiked(currentVideo) ? 'Liked' : 'Like'}
            </button>
            <button 
              onClick={() => handleGenerateMeme(currentVideo)}
              className="meme-button-new"
              disabled={generatingMeme}
              title="Generate meme based on this video"
            >
              <i className={generatingMeme ? 'fas fa-circle-notch fa-spin' : 'fas fa-magic'}></i> 
              {generatingMeme ? 'Generating...' : 'Generate Meme'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default VideoResults;