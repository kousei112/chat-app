import React, { createContext, useState, useEffect, useContext } from 'react';
import { userAPI } from './api';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Lấy theme từ localStorage hoặc mặc định là 'light'
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    // Apply theme class vào body
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    // Save to backend
    try {
      await userAPI.updateTheme(newTheme);
    } catch (error) {
      console.error('Lỗi update theme:', error);
    }
  };

  const setThemeValue = (newTheme) => {
    if (['light', 'dark'].includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeValue }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;