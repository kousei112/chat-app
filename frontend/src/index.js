import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { ThemeProvider } from './services/ThemeContext';
import './theme.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);