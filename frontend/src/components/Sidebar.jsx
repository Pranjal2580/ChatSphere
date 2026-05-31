import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { SocketContext } from '../context/SocketContext';
import axios from 'axios';

const Sidebar = () => {
  const { user, logout, updateProfile, blockUser, unblockUser } = useContext(AuthContext);
  const {
    users,
    groups,
    activeChat,
    typingUsers,
    notifications,
    selectChat,
    createNewGroup,
  } = useContext(ChatContext);
  const { onlineUsers } = useContext(SocketContext);

  const [activeTab, setActiveTab] = useState('dms'); // 'dms' or 'groups'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Profile Edit fields
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editStatus, setEditStatus] = useState(user?.customStatus || 'Available');
  const [editProfileFile, setEditProfileFile] = useState(null);

  // Group Create fields
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]); // List of user IDs
  const [groupImageFile, setGroupImageFile] = useState(null);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/users/search?q=${query}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('username', editUsername);
      formData.append('bio', editBio);
      formData.append('customStatus', editStatus);
      if (editProfileFile) {
        formData.append('profilePic', editProfileFile);
      }
      await updateProfile(formData);
      setShowProfileModal(false);
      setEditProfileFile(null);
    } catch (err) {
      alert(err.message || 'Profile update failed');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      alert('Group name is required');
      return;
    }
    if (groupMembers.length === 0) {
      alert('Select at least one member');
      return;
    }

    try {
      const newGroup = await createNewGroup(groupName, groupMembers, groupImageFile);
      selectChat(newGroup);
      setShowGroupModal(false);
      setGroupName('');
      setGroupMembers([]);
      setGroupImageFile(null);
    } catch (err) {
      alert('Failed to create group');
    }
  };

  const toggleGroupMember = (userId) => {
    setGroupMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const startSearchChat = (targetUser) => {
    selectChat(targetUser);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  return (
    <div className="glass-panel" style={{
      width: '350px',
      height: '100%',
      borderRight: '1px solid var(--border-glass)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* Sidebar Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={user?.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=fallback'}
            alt="avatar"
            style={{
              width: '45px',
              height: '45px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--accent-cyan)'
            }}
          />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{user?.username}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
              💬 {user?.customStatus || 'Available'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setEditUsername(user?.username || '');
              setEditBio(user?.bio || '');
              setEditStatus(user?.customStatus || 'Available');
              setShowProfileModal(true);
            }}
            title="Edit Profile"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            ⚙️
          </button>
          <button
            onClick={logout}
            title="Log Out"
            style={{
              background: 'rgba(255,61,0,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            🚪
          </button>
        </div>
      </div>

      {/* User Search Input */}
      <div style={{ padding: '15px' }}>
        <input
          type="text"
          className="glass-input"
          placeholder="Search users to chat..."
          value={searchQuery}
          onChange={handleSearch}
          style={{ fontSize: '0.85rem', padding: '10px 14px' }}
        />

        {/* Search Results Dropdown Overlay */}
        {isSearching && (
          <div className="glass-panel" style={{
            position: 'absolute',
            left: '15px',
            right: '15px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 10,
            marginTop: '5px',
            borderRadius: '12px',
            padding: '10px'
          }}>
            {searchResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                No users found
              </p>
            ) : (
              searchResults.map((su) => (
                <div
                  key={su._id}
                  onClick={() => startSearchChat(su)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  className="search-item-hover"
                >
                  <img
                    src={su.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + su.username}
                    alt="pic"
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                  <div>
                    <h4 style={{ fontSize: '0.85rem' }}>{su.username}</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-gray)' }}>{su.customStatus || 'Available'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chat Tabs */}
      <div style={{
        display: 'flex',
        padding: '0 15px 10px 15px',
        borderBottom: '1px solid var(--border-glass)',
        gap: '10px'
      }}>
        <button
          onClick={() => setActiveTab('dms')}
          className={`glass-button secondary ${activeTab === 'dms' ? 'active-tab' : ''}`}
          style={{
            flex: 1,
            padding: '8px',
            fontSize: '0.85rem',
            borderRadius: '10px',
            background: activeTab === 'dms' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'dms' ? '#000' : '#fff'
          }}
        >
          Direct Messages
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`glass-button secondary ${activeTab === 'groups' ? 'active-tab' : ''}`}
          style={{
            flex: 1,
            padding: '8px',
            fontSize: '0.85rem',
            borderRadius: '10px',
            background: activeTab === 'groups' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'groups' ? '#000' : '#fff'
          }}
        >
          Groups
        </button>
        <button
          onClick={() => setShowGroupModal(true)}
          title="Create Group"
          className="glass-button"
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '0.9rem'
          }}
        >
          ＋
        </button>
      </div>

      {/* Main List */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
        {activeTab === 'dms' ? (
          // Direct Messages List
          users.map((u) => {
            const isOnline = onlineUsers.includes(u._id);
            const isSelected = activeChat && activeChat._id === u._id;
            const chatTyperMap = typingUsers[u._id] || {};
            const isTyping = Object.keys(chatTyperMap).length > 0;
            const isBlocked = user.blockedUsers?.includes(u._id);

            const chatNotifs = notifications.filter((n) => n.senderId._id === u._id);

            return (
              <div
                key={u._id}
                onClick={() => selectChat(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  position: 'relative',
                  backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-glass)' : '1px solid transparent',
                  transition: 'var(--transition)'
                }}
                className="chat-item-hover"
              >
                {/* Avatar */}
                <div style={{ position: 'relative' }}>
                  <img
                    src={u.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}
                    alt="pic"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      opacity: isBlocked ? 0.5 : 1
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: isBlocked ? 'var(--error-red)' : isOnline ? 'var(--success-green)' : 'var(--text-muted)',
                    border: '2px solid #000'
                  }}></span>
                </div>

                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 500, color: isSelected ? 'var(--accent-cyan)' : '#fff' }}>
                      {u.username} {isBlocked && <span style={{ color: 'var(--error-red)', fontSize: '0.75rem' }}>(Blocked)</span>}
                    </h4>
                  </div>
                  {isTyping ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
                      typing...
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-gray)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {u.customStatus ? `💬 ${u.customStatus}` : u.bio}
                    </p>
                  )}
                </div>

                {/* Block / Unblock Button trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isBlocked) {
                      unblockUser(u._id);
                    } else {
                      if (confirm(`Are you sure you want to block ${u.username}?`)) {
                        blockUser(u._id);
                      }
                    }
                  }}
                  title={isBlocked ? "Unblock Contact" : "Block Contact"}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    opacity: 0.3,
                    transition: 'var(--transition)'
                  }}
                  className="block-trigger-hover"
                >
                  {isBlocked ? '🔓' : '🚫'}
                </button>

                {chatNotifs.length > 0 && (
                  <span className="badge" style={{ position: 'absolute', right: '12px' }}>
                    {chatNotifs.length}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          // Groups List
          groups.map((g) => {
            const isSelected = activeChat && activeChat._id === g._id;
            const chatTyperMap = typingUsers[g._id] || {};
            const typers = Object.values(chatTyperMap);
            const isTyping = typers.length > 0;

            return (
              <div
                key={g._id}
                onClick={() => selectChat(g)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-glass)' : '1px solid transparent',
                  transition: 'var(--transition)'
                }}
                className="chat-item-hover"
              >
                <img
                  src={g.groupImage || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + g.groupName}
                  alt="group-pic"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />

                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 500, color: isSelected ? 'var(--accent-cyan)' : '#fff' }}>
                    {g.groupName}
                  </h4>
                  {isTyping ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
                      {typers.join(', ')} typing...
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                      {g.members.length} members
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- PROFILE MODAL --- */}
      {showProfileModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>Edit Profile</h2>
              <button onClick={() => setShowProfileModal(false)} className="close-btn">✕</button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="auth-form">
              <div className="form-group">
                <label>Profile Picture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditProfileFile(e.target.files[0])}
                  style={{ color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  className="glass-input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Custom Status</label>
                <select
                  className="glass-input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ background: '#0a0b0d', color: '#fff' }}
                >
                  <option value="Available">🟢 Available</option>
                  <option value="Busy">🔴 Busy</option>
                  <option value="In a meeting">💼 In a meeting</option>
                  <option value="At school">🎓 At school</option>
                  <option value="Sleeping">💤 Sleeping</option>
                </select>
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  className="glass-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                />
              </div>

              <button type="submit" className="glass-button" style={{ marginTop: '10px' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- GROUP CREATION MODAL --- */}
      {showGroupModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>Create New Group</h2>
              <button onClick={() => setShowGroupModal(false)} className="close-btn">✕</button>
            </div>

            <form onSubmit={handleCreateGroup} className="auth-form">
              <div className="form-group">
                <label>Group Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGroupImageFile(e.target.files[0])}
                  style={{ color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Project Avengers"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Members</label>
                <div style={{
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.2)'
                }}>
                  {users.map((u) => (
                    <label key={u._id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={groupMembers.includes(u._id)}
                        onChange={() => toggleGroupMember(u._id)}
                        style={{ accentColor: 'var(--accent-cyan)' }}
                      />
                      <img
                        src={u.profilePic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}
                        alt="pic"
                        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      />
                      <span>{u.username}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="glass-button" style={{ marginTop: '10px' }}>
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .chat-item-hover:hover {
          background-color: rgba(255,255,255,0.02) !important;
        }
        .chat-item-hover:hover .block-trigger-hover {
          opacity: 0.8 !important;
        }
        .search-item-hover:hover {
          background-color: rgba(255,255,255,0.05) !important;
        }
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          zIndex: 100;
        }
        .modal-content {
          width: 90%;
          max-width: 400px;
          padding: 30px;
          border-radius: 20px;
          animation: scaleUp 0.3s ease;
        }
        .close-btn {
          background: none;
          border: none;
          color: var(--text-gray);
          font-size: 1.2rem;
          cursor: pointer;
          transition: var(--transition);
        }
        .close-btn:hover {
          color: #fff;
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
