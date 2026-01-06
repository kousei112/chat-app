import React from 'react';
import './ReactionPicker.css';

function ReactionPicker({ onSelect, onClose, position }) {
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

  return (
    <>
      <div className="reaction-picker-overlay" onClick={onClose} />
      <div 
        className={`reaction-picker ${position === 'top' ? 'picker-top' : 'picker-bottom'}`}
      >
        {reactions.map((emoji, index) => (
          <button
            key={index}
            className="reaction-btn"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

export default ReactionPicker;