import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { SocketContext } from '../context/SocketContext';
import VoiceRecorder from './VoiceRecorder';
import GifPicker from './GifPicker';
import EmojiPicker from 'emoji-picker-react';

const ChatWindow = () => {
  const { user } = useContext(AuthContext);
  const {
    activeChat,
    messages,
    typingUsers,
    users,
    groups,
    selectChat,
    sendNewMessage,
    editOldMessage,
    deleteOldMessage,
    reactToOldMessage,
  } = useContext(ChatContext);
  
  const { onlineUsers, initiateCall, socket } = useContext(SocketContext);

  const [messageText, setMessageText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Message Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Forwarding state
  const [forwardingMessage, setForwardingMessage] = useState(null);

  // Message Editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  // Active message hover menu ID
  const [activeMenuId, setActiveMenuId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing socket events
  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    
    if (activeChat && socket) {
      const emitData = activeChat.groupName
        ? { senderId: user._id, groupId: activeChat._id }
        : { senderId: user._id, receiverId: activeChat._id };
        
      socket.emit('typing', emitData);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', emitData);
      }, 2000);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessageText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim() && !imageFile && !videoFile) return;

    try {
      if (socket && activeChat) {
        const emitData = activeChat.groupName
          ? { senderId: user._id, groupId: activeChat._id }
          : { senderId: user._id, receiverId: activeChat._id };
        socket.emit('stopTyping', emitData);
      }

      await sendNewMessage(
        messageText,
        imageFile,
        null,
        replyingTo ? replyingTo._id : null,
        false,
        videoFile
      );

      setMessageText('');
      setImageFile(null);
      setImagePreview(null);
      setVideoFile(null);
      setVideoPreview(null);
      setReplyingTo(null);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to send message';
      alert(errorMsg);
    }
  };

  const handleSendVoice = async (audioBlob) => {
    try {
      await sendNewMessage('', null, audioBlob, replyingTo ? replyingTo._id : null);
      setIsRecording(false);
      setReplyingTo(null);
    } catch (err) {
      alert('Failed to send voice note');
    }
  };

  const startEditing = (msg) => {
    const timeElapsed = Date.now() - new Date(msg.createdAt).getTime();
    if (timeElapsed > 5 * 60 * 1000) {
      alert('You can only edit messages within 5 minutes.');
      return;
    }
    setEditingMessageId(msg._id);
    setEditText(msg.message);
    setActiveMenuId(null);
  };

  const saveEdit = async (msgId) => {
    if (!editText.trim()) return;
    await editOldMessage(msgId, editText);
    setEditingMessageId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const handleForwardSelect = async (target) => {
    if (!forwardingMessage) return;
    try {
      await selectChat(target);
      await sendNewMessage(forwardingMessage.message, null, null, null, true);
      setForwardingMessage(null);
    } catch (err) {
      alert('Failed to forward message');
    }
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!activeChat) {
    return (
      <div style={{
        flexGrow: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.1)',
        color: 'var(--text-gray)'
      }}>
        <span style={{ fontSize: '4rem', marginBottom: '20px' }}>💬</span>
        <h2>Welcome to ChatSphere</h2>
        <p style={{ marginTop: '10px', fontSize: '0.95rem' }}>
          Select a contact or group from the sidebar to start talking.
        </p>
      </div>
    );
  }

  const isChatOnline = !activeChat.groupName && onlineUsers.includes(activeChat._id);
  const activeChatTypers = typingUsers[activeChat._id] || {};
  const typingList = Object.values(activeChatTypers);

  const isTargetBlocked = !activeChat.groupName && user.blockedUsers?.includes(activeChat._id);

  const filteredMessages = messages.filter((m) => {
    if (!searchKeyword) return true;
    return m.message?.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  return (
    <div style={{
      flexGrow: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      background: 'rgba(10, 11, 15, 0.3)'
    }}>
      {/* 1. Chat Header */}
      <div style={{
        padding: '15px 25px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-card)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={activeChat.profilePic || activeChat.groupImage || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + (activeChat.username || activeChat.groupName)}
            alt="chat-avatar"
            style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                {activeChat.username || activeChat.groupName}
              </h3>
              {!activeChat.groupName && (
                <span title="End-to-End Encrypted" style={{ fontSize: '0.8rem', cursor: 'help' }}>🔒 E2EE</span>
              )}
            </div>
            {activeChat.groupName ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                {activeChat.members?.length} members
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: isChatOnline ? 'var(--success-green)' : 'var(--text-muted)' }}>
                {isChatOnline ? '● Online' : 'Offline'}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setSearchKeyword('');
            }}
            title="Search Messages"
            className="glass-button secondary"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: showSearch ? '1px solid var(--accent-cyan)' : ''
            }}
          >
            🔍
          </button>

          {!activeChat.groupName && !isTargetBlocked && (
            <>
              <button
                onClick={() => initiateCall(activeChat._id, activeChat.username, 'audio')}
                title="Voice Call"
                className="glass-button secondary"
                style={{ padding: '8px 12px', borderRadius: '10px' }}
              >
                📞
              </button>
              <button
                onClick={() => initiateCall(activeChat._id, activeChat.username, 'video')}
                title="Video Call"
                className="glass-button secondary"
                style={{ padding: '8px 12px', borderRadius: '10px' }}
              >
                📹
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message Search Sub-bar */}
      {showSearch && (
        <div style={{
          padding: '10px 25px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          gap: '10px'
        }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Search words in this chat..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchKeyword('');
            }}
            className="glass-button secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      )}

      {/* 2. Messages Frame */}
      <div style={{
        flexGrow: 1,
        overflowY: 'auto',
        padding: '25px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
      }}>
        {filteredMessages.length === 0 && searchKeyword ? (
          <p style={{ textAlign: 'center', color: 'var(--text-gray)', marginTop: '20px' }}>
            No messages matching "{searchKeyword}"
          </p>
        ) : (
          filteredMessages.map((msg) => {
            const isMine = msg.senderId._id === user._id || msg.senderId === user._id;
            const showAvatar = activeChat.groupName && !isMine;
            const displayMenu = activeMenuId === msg._id;

            return (
              <div
                key={msg._id}
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: '10px',
                  position: 'relative'
                }}
                onMouseEnter={() => !msg.isDeleted && setActiveMenuId(msg._id)}
                onMouseLeave={() => setActiveMenuId(null)}
              >
                {showAvatar && (
                  <img
                    src={msg.senderId.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + msg.senderId.username}
                    alt="sender-avatar"
                    style={{ width: '30px', height: '30px', borderRadius: '50%' }}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '65%' }}>
                  {showAvatar && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '3px', fontWeight: 500 }}>
                      {msg.senderId.username}
                    </span>
                  )}

                  {/* Reply Citation Card */}
                  {msg.replyTo && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderLeft: '3px solid var(--accent-cyan)',
                      padding: '6px 12px',
                      borderRadius: '8px 8px 0 0',
                      fontSize: '0.8rem',
                      color: 'var(--text-gray)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      marginBottom: '-5px',
                      cursor: 'pointer'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
                        @{msg.replyTo.senderId?.username || 'User'}
                      </span>
                      <span>{msg.replyTo.message || 'Attachment'}</span>
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className="glass-panel"
                    style={{
                      padding: '10px 16px',
                      borderRadius: msg.replyTo
                        ? '0 16px 16px 16px'
                        : isMine
                        ? '16px 16px 0 16px'
                        : '16px 16px 16px 0',
                      background: isMine ? 'rgba(79, 172, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isMine ? '1px solid rgba(79, 172, 254, 0.25)' : '1px solid var(--border-glass)',
                      position: 'relative'
                    }}
                  >
                    {msg.isForwarded && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--accent-blue)',
                        fontStyle: 'italic',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <span>↪</span>
                        <span>Forwarded</span>
                      </div>
                    )}

                    {/* Inline GIF/Image Upload */}
                    {msg.image && (
                      <div style={{ marginBottom: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                        {msg.image.startsWith('http') && msg.image.includes('giphy.com') ? (
                          // Render GIF directly without download link if Giphy
                          <img src={msg.image} alt="gif" style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }} />
                        ) : (
                          <>
                            <img src={msg.image} alt="shared" style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }} />
                            <a href={msg.image} download target="_blank" rel="noreferrer" style={{
                              display: 'block',
                              fontSize: '0.75rem',
                              color: 'var(--accent-cyan)',
                              marginTop: '5px',
                              textDecoration: 'none'
                            }}>
                              📥 Download Image
                            </a>
                          </>
                        )}
                      </div>
                    )}

                    {/* Inline Video player */}
                    {msg.video && (
                      <div style={{ marginBottom: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                        <video controls src={msg.video} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', display: 'block' }} />
                      </div>
                    )}

                    {/* Inline Voice Note Player */}
                    {msg.audio && (
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <audio controls src={msg.audio} style={{
                          height: '32px',
                          borderRadius: '16px',
                          outline: 'none',
                          maxWidth: '220px'
                        }} />
                      </div>
                    )}

                    {/* Editing Text Box */}
                    {editingMessageId === msg._id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          className="glass-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ fontSize: '0.9rem', minHeight: '60px', padding: '6px' }}
                        />
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button onClick={cancelEdit} className="glass-button secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                            Cancel
                          </button>
                          <button onClick={() => saveEdit(msg._id)} className="glass-button" style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Regular Text Message
                      // Hide text if message is just a Giphy link
                      !(msg.message?.startsWith('http') && msg.message?.includes('giphy.com')) && (
                        <p style={{
                          fontSize: '0.92rem',
                          lineHeight: '1.4',
                          wordBreak: 'break-word',
                          color: msg.isDeleted ? 'var(--text-muted)' : 'var(--text-white)',
                          fontStyle: msg.isDeleted ? 'italic' : 'normal'
                        }}>
                          {msg.message}
                        </p>
                      )
                    )}

                    {/* Reaction Badges */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginTop: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {msg.reactions.reduce((acc, current) => {
                          const existing = acc.find((item) => item.emoji === current.emoji);
                          if (existing) {
                            existing.count += 1;
                          } else {
                            acc.push({ emoji: current.emoji, count: 1 });
                          }
                          return acc;
                        }, []).map((r, i) => (
                          <div
                            key={i}
                            onClick={() => reactToOldMessage(msg._id, r.emoji)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message Time and Status Ticks */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '5px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)'
                    }}>
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {msg.isEdited && <span>(edited)</span>}
                      {isMine && !activeChat.groupName && (
                        <span style={{
                          color: msg.status === 'seen' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>
                          {msg.status === 'seen' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover actions menu */}
                {displayMenu && !editingMessageId && (
                  <div style={{
                    position: 'absolute',
                    top: '5px',
                    [isMine ? 'left' : 'right']: '35%',
                    background: 'rgba(20, 24, 33, 0.95)',
                    border: '1px solid var(--border-glass)',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    zIndex: 4,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ display: 'flex', gap: '5px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '8px' }}>
                      {['❤️', '👍', '😂', '😍'].map((emo) => (
                        <span
                          key={emo}
                          onClick={() => { reactToOldMessage(msg._id, emo); setActiveMenuId(null); }}
                          style={{ cursor: 'pointer', transition: 'var(--transition)' }}
                          className="emoji-badge-hover"
                        >
                          {emo}
                        </span>
                      ))}
                    </div>

                    <span onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} style={{ cursor: 'pointer', fontSize: '0.8rem' }} title="Reply">
                      ↩️ Reply
                    </span>

                    <span onClick={() => { setForwardingMessage(msg); setActiveMenuId(null); }} style={{ cursor: 'pointer', fontSize: '0.8rem' }} title="Forward Message">
                      ↪️ Forward
                    </span>

                    {isMine && (
                      <>
                        <span onClick={() => startEditing(msg)} style={{ cursor: 'pointer', fontSize: '0.8rem' }} title="Edit">
                          ✏️ Edit
                        </span>
                        <span onClick={() => { deleteOldMessage(msg._id, 'everyone'); setActiveMenuId(null); }} style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--error-red)' }} title="Delete for Everyone">
                          🗑️ Delete
                        </span>
                      </>
                    )}

                    <span onClick={() => { deleteOldMessage(msg._id, 'me'); setActiveMenuId(null); }} style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-gray)' }} title="Delete for Me">
                      ❌ Delete For Me
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Live Typing Indicator Banner */}
      {typingList.length > 0 && (
        <div style={{
          padding: '5px 25px',
          fontSize: '0.8rem',
          color: 'var(--accent-cyan)',
          fontStyle: 'italic',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* 4. Chat Input Footer panel */}
      <div style={{
        padding: '15px 25px',
        borderTop: '1px solid var(--border-glass)',
        background: 'var(--bg-card)',
        backdropFilter: 'blur(10px)',
        position: 'relative'
      }}>
        {isTargetBlocked ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--error-red)',
            padding: '10px',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            🚫 You have blocked this contact. Unblock them in the sidebar to send messages.
          </div>
        ) : (
          <>
            {/* Reply Citation Header */}
            {replyingTo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.2)',
                padding: '8px 15px',
                borderRadius: '12px',
                marginBottom: '10px',
                fontSize: '0.8rem'
              }}>
                <span>Replying to: <b>@{replyingTo.senderId?.username || 'User'}</b>: {replyingTo.message}</span>
                <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
              </div>
            )}

            {/* Image Attachment Preview */}
            {imagePreview && (
              <div style={{
                display: 'inline-block',
                position: 'relative',
                background: 'rgba(0,0,0,0.2)',
                padding: '8px',
                borderRadius: '12px',
                marginBottom: '10px'
              }}>
                <img src={imagePreview} alt="preview" style={{ maxHeight: '80px', borderRadius: '8px' }} />
                <button
                  onClick={clearImage}
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: 'var(--error-red)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.65rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Video Attachment Preview */}
            {videoPreview && (
              <div style={{
                display: 'inline-block',
                position: 'relative',
                background: 'rgba(0,0,0,0.2)',
                padding: '8px',
                borderRadius: '12px',
                marginBottom: '10px'
              }}>
                <video src={videoPreview} style={{ maxHeight: '80px', borderRadius: '8px' }} muted />
                <button
                  onClick={clearVideo}
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: 'var(--error-red)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.65rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {isRecording ? (
              <VoiceRecorder onSendAudio={handleSendVoice} onCancel={() => setIsRecording(false)} />
            ) : (
              <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ cursor: 'pointer', fontSize: '1.2rem' }} title="Attach Image">
                  📎
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Video upload input */}
                <label style={{ cursor: 'pointer', fontSize: '1.2rem' }} title="Attach Video">
                  📹
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setIsRecording(true)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                  title="Record Voice Note"
                >
                  🎙️
                </button>

                {/* GIF trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setShowGifPicker(!showGifPicker);
                    setShowEmojiPicker(false);
                  }}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                  title="Search GIFs"
                >
                  🎬
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      setShowGifPicker(false);
                    }}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                    title="Select Emoji"
                  >
                    😀
                  </button>
                  {showEmojiPicker && (
                    <div style={{ position: 'absolute', bottom: '45px', left: 0, zIndex: 100 }}>
                      <EmojiPicker theme="dark" onEmojiClick={handleEmojiClick} />
                    </div>
                  )}
                </div>

                {showGifPicker && (
                  <div style={{ position: 'absolute', bottom: '45px', left: '80px', zIndex: 100 }}>
                    <GifPicker
                      onSelectGif={async (gifUrl) => {
                        // Send the GIF URL
                        await sendNewMessage(gifUrl, null, null, replyingTo ? replyingTo._id : null);
                        setShowGifPicker(false);
                      }}
                      onClose={() => setShowGifPicker(false)}
                    />
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  className="glass-input"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={handleInputChange}
                />

                <button type="submit" className="glass-button" style={{ padding: '12px' }}>
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* --- FORWARDING MODAL --- */}
      {forwardingMessage && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Forward Message</h3>
              <button onClick={() => setForwardingMessage(null)} className="close-btn">✕</button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '15px' }}>
              Select a chat to forward:
            </p>

            <div style={{
              maxHeight: '250px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {users.map((u) => (
                <div
                  key={u._id}
                  onClick={() => handleForwardSelect(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                  className="search-item-hover"
                >
                  <img
                    src={u.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}
                    alt="pic"
                    style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                  />
                  <span style={{ fontSize: '0.85rem' }}>{u.username}</span>
                </div>
              ))}

              {groups.map((g) => (
                <div
                  key={g._id}
                  onClick={() => handleForwardSelect(g)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                  className="search-item-hover"
                >
                  <img
                    src={g.groupImage || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + g.groupName}
                    alt="pic"
                    style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                  />
                  <span style={{ fontSize: '0.85rem' }}>{g.groupName} (Group)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .emoji-badge-hover:hover {
          transform: scale(1.3);
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
