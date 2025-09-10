import { useState } from 'react';

function MemeDisplay({ generatedMeme, isGenerating, memeError }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!generatedMeme && !isGenerating && !memeError) {
    return (
      <div className="meme-placeholder">
        <div className="meme-placeholder-content">
          <span className="meme-placeholder-emoji">😂</span>
          <p>Generate a meme from a video to see it here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="meme-display">
      {isGenerating && (
        <div className="meme-loading">
          <div className="loading-spinner"><i className="fas fa-magic fa-spin"></i></div>
          <p>Creating your personalized meme...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      {memeError && (
        <div className="meme-display-error">
          <span className="error-emoji">❌</span>
          <p>{memeError}</p>
        </div>
      )}

      {generatedMeme && !isGenerating && (
        <div className="meme-result">
          <div className="meme-image-container">
            {!imageLoaded && (
              <div className="image-loading">
                <div className="loading-spinner"><i className="fas fa-circle-notch fa-spin"></i></div>
                <p>Loading meme...</p>
              </div>
            )}
            <img 
              src={generatedMeme.createdMeme.imageUrl} 
              alt="Your Generated Meme" 
              className={`generated-meme-image ${imageLoaded ? 'loaded' : 'loading'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </div>
          <div className="meme-actions">
            <a 
              href={generatedMeme.createdMeme.pageUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="meme-link-button"
            >
              <span>🔗</span> View on Imgflip
            </a>
            <button 
              onClick={() => navigator.clipboard?.writeText(generatedMeme.createdMeme.imageUrl)}
              className="copy-button"
              title="Copy image URL"
            >
              <span>📋</span> Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemeDisplay;