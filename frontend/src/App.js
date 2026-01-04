import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Login from './components/Login';
import CompleteProfile from './components/CompleteProfile';
import MessagingApp from './components/MessagingApp';
import './App.css';

const SOCKET_URL = 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    // Kiểm tra token và user từ localStorage khi app khởi động
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsLoggedIn(true);

        // Kiểm tra profile đã hoàn thành chưa
        if (!userData.profileCompleted) {
          setNeedsProfileCompletion(true);
        } else {
          // Tạo socket connection nếu profile đã hoàn thành
          const newSocket = io(SOCKET_URL);
          setSocket(newSocket);

          newSocket.on('connect', () => {
            newSocket.emit('join', {
              userId: userData.userId,
              username: userData.username,
              displayName: userData.displayName,
              token: token
            });
          });
        }
      } catch (error) {
        console.error('Lỗi khi khôi phục session:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    setIsLoggedIn(true);

    // Kiểm tra xem cần hoàn thành profile không
    if (!userData.profileCompleted) {
      setNeedsProfileCompletion(true);
    } else {
      // Tạo socket connection nếu profile đã hoàn thành
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);

      newSocket.on('connect', () => {
        newSocket.emit('join', {
          userId: userData.userId,
          username: userData.username,
          displayName: userData.displayName,
          token: token
        });
      });
    }
  };

  const handleProfileComplete = (updatedUser) => {
    setUser(updatedUser);
    setNeedsProfileCompletion(false);

    // Tạo socket connection sau khi hoàn thành profile
    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', {
        userId: updatedUser.userId,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        token: token
      });
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setNeedsProfileCompletion(false);
    
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="App">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  if (needsProfileCompletion) {
    return (
      <div className="App">
        <CompleteProfile user={user} onComplete={handleProfileComplete} />
      </div>
    );
  }

  if (!socket) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Đang kết nối...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <MessagingApp 
        socket={socket} 
        user={user}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;