import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallModal from '../components/CallModal';

const ChatPage = () => {
  const { user, loading } = useContext(AuthContext);
  const { fetchChats } = useContext(ChatContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading ChatSphere...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <Sidebar />

      {/* Messaging Panel */}
      <ChatWindow />

      {/* Video/Audio Calling Panel */}
      <CallModal />
    </div>
  );
};

export default ChatPage;
