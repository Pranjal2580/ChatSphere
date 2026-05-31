import React, { useState, useEffect } from 'react';

const FALLBACK_GIFS = [
  { id: '1', title: 'Happy Dance', url: 'https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif' },
  { id: '2', title: 'Laughing Out Loud', url: 'https://media.giphy.com/media/26n6Gx9wBS50qvtI4/giphy.gif' },
  { id: '3', title: 'Thumbs Up', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: '4', title: 'Heart Eyes', url: 'https://media.giphy.com/media/l41JWb1m4tGC3dcgo/giphy.gif' },
  { id: '5', title: 'Shocked Face', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: '6', title: 'Cat Wave', url: 'https://media.giphy.com/media/V83VJYS5V3o5O/giphy.gif' },
  { id: '7', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: '8', title: 'Excited Yay', url: 'https://media.giphy.com/media/2RGo8wQN4XPhK/giphy.gif' },
];

const GifPicker = ({ onSelectGif, onClose }) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (searchQuery = '') => {
    setLoading(true);
    const apiKey = 'dc6zaTOxFJmzC'; // Public beta key
    let url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12`;
    
    if (searchQuery) {
      url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchQuery)}&limit=12`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('API failure');
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const formattedGifs = data.data.map((gif) => ({
          id: gif.id,
          title: gif.title,
          url: gif.images.fixed_height.url,
        }));
        setGifs(formattedGifs);
      } else {
        setGifs(FALLBACK_GIFS);
      }
    } catch (err) {
      console.warn('Giphy API failed, using curated GIFs list');
      setGifs(FALLBACK_GIFS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs();
  }, []);

  const handleSearchTrigger = () => {
    fetchGifs(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchGifs(query);
    }
  };

  return (
    <div className="glass-panel" style={{
      width: '320px',
      maxHeight: '400px',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--glass-shadow)',
      border: '1px solid var(--border-glass)',
      animation: 'fadeIn 0.2s ease',
      zIndex: 100
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 15px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>GIF search</h4>
        <button type="button" onClick={onClose} style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-gray)',
          cursor: 'pointer',
          fontSize: '1rem'
        }}>✕</button>
      </div>

      {/* Search Input Box using Div instead of Form to prevent nested forms HTML error */}
      <div style={{ padding: '10px', display: 'flex', gap: '5px' }}>
        <input
          type="text"
          placeholder="Search GIFs..."
          className="glass-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
        />
        <button
          type="button"
          onClick={handleSearchTrigger}
          className="glass-button"
          style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          Go
        </button>
      </div>

      {/* GIFs Grid */}
      <div style={{
        flexGrow: 1,
        overflowY: 'auto',
        padding: '10px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px'
      }}>
        {loading ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', color: 'var(--text-gray)' }}>
            Loading GIFs...
          </div>
        ) : (
          gifs.map((gif) => (
            <div
              key={gif.id}
              onClick={() => onSelectGif(gif.url)}
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                height: '100px',
                border: '1px solid transparent',
                transition: 'var(--transition)'
              }}
              className="gif-item-hover"
            >
              <img
                src={gif.url}
                alt={gif.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          ))
        )}
      </div>

      <style>{`
        .gif-item-hover:hover {
          transform: scale(1.05);
          border-color: var(--accent-cyan) !important;
        }
      `}</style>
    </div>
  );
};

export default GifPicker;
