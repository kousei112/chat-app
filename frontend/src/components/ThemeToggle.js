import React from 'react';
import { useTheme } from '../services/ThemeContext';
import './ThemeToggle.css';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      className="theme-toggle-btn" 
      onClick={toggleTheme}
      title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

export default ThemeToggle;