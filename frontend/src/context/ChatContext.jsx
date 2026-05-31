import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';
import { SocketContext } from './SocketContext';
import { encryptMessage, decryptMessage } from '../services/cryptoService';

export const ChatContext = createContext();

const API_MESSAGES_URL = 'http://localhost:5000/api/messages';
const API_USERS_URL = 'http://localhost:5000/api/users';
const API_GROUPS_URL = 'http://localhost:5000/api/groups';

export const ChatProvider = ({ children }) => {
  const { user, privateKey } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [notifications, setNotifications] = useState([]);

  const activeChatRef = useRef(activeChat);
  const privateKeyRef = useRef(privateKey);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Helper function to decrypt a single message
  const decryptSingleMessage = async (msg, privKey, myId) => {
    if (msg.isEncrypted && !msg.isDecrypted && !msg.isDeleted && privKey) {
      const myKeyEntry = msg.encryptedKeys?.find(
        (k) => (k.userId?._id || k.userId) === myId
      );
      if (myKeyEntry) {
        try {
          const decryptedText = await decryptMessage(
            msg.message,
            msg.encryptionIv,
            myKeyEntry.key,
            privKey
          );
          return { ...msg, message: decryptedText, isDecrypted: true };
        } catch (err) {
          return { ...msg, message: '[Failed to decrypt E2EE message]', isDecrypted: true };
        }
      }
    }
    return msg;
  };

  // Helper to decrypt a batch of messages
  const decryptMessagesList = async (msgList, privKey, myId) => {
    if (!privKey || !msgList || msgList.length === 0) return msgList;
    return Promise.all(msgList.map((m) => decryptSingleMessage(m, privKey, myId)));
  };

  const fetchChats = async () => {
    if (!user) return;
    try {
      const [usersRes, groupsRes] = await Promise.all([
        axios.get(API_USERS_URL),
        axios.get(API_GROUPS_URL)
      ]);
      setUsers(usersRes.data);
      setGroups(groupsRes.data);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [user]);

  useEffect(() => {
    if (socket && groups.length > 0) {
      groups.forEach((g) => {
        socket.emit('joinGroup', g._id);
      });
    }
  }, [socket, groups]);

  const selectChat = async (chat) => {
    setActiveChat(chat);
    setMessages([]);

    if (!chat) return;

    try {
      let res;
      if (chat.groupName) {
        res = await axios.get(`${API_MESSAGES_URL}/group/${chat._id}`);
        setMessages(res.data);
      } else {
        res = await axios.get(`${API_MESSAGES_URL}/${chat._id}`);
        
        // Decrypt fetched messages before putting them in state
        const decryptedList = await decryptMessagesList(res.data, privateKey, user._id);
        setMessages(decryptedList);

        setNotifications((prev) => prev.filter((n) => n.senderId._id !== chat._id));

        const unreadMessageIds = res.data
          .filter((m) => m.senderId._id === chat._id && m.status !== 'seen')
          .map((m) => m._id);

        if (unreadMessageIds.length > 0 && socket) {
          socket.emit('messageSeen', {
            senderId: chat._id,
            receiverId: user._id,
            messageIds: unreadMessageIds,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const sendNewMessage = async (messageText, imageFile, audioBlob, replyToId, isForwarded = false, videoFile = null) => {
    if (!activeChat) return;

    try {
      const formData = new FormData();
      
      let finalMsgText = messageText || '';
      let isMsgEncrypted = false;
      let encIv = '';
      let encKeysString = '';

      // If DM, perform E2EE locally before sending
      if (!activeChat.groupName) {
        if (activeChat.publicKey && user.publicKey) {
          try {
            const senderPubKey = JSON.parse(user.publicKey);
            const recipientPubKey = JSON.parse(activeChat.publicKey);
            
            const textToEncrypt = messageText || (imageFile ? '[Image Shared]' : audioBlob ? '[Voice message]' : videoFile ? '[Video Shared]' : '');
            
            const encResult = await encryptMessage(textToEncrypt, senderPubKey, recipientPubKey);
            
            finalMsgText = encResult.ciphertext;
            isMsgEncrypted = true;
            encIv = encResult.iv;
            
            const keysArray = [
              { userId: user._id, key: encResult.encryptedKeySender },
              { userId: activeChat._id, key: encResult.encryptedKeyRecipient }
            ];
            encKeysString = JSON.stringify(keysArray);
          } catch (cryptoErr) {
            console.error('Encryption failed, sending plain message fallback:', cryptoErr);
          }
        }
      }

      formData.append('message', finalMsgText);
      if (replyToId) {
        formData.append('replyTo', replyToId);
      }

      if (activeChat.groupName) {
        formData.append('groupId', activeChat._id);
      } else {
        formData.append('receiverId', activeChat._id);
        formData.append('isEncrypted', isMsgEncrypted);
        if (isMsgEncrypted) {
          formData.append('encryptionIv', encIv);
          formData.append('encryptedKeys', encKeysString);
        }
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (audioBlob) {
        const audioFile = new File([audioBlob], 'voice-message.mp3', { type: 'audio/mp3' });
        formData.append('audio', audioFile);
      }

      if (videoFile) {
        formData.append('video', videoFile);
      }

      if (isForwarded) {
        formData.append('isForwarded', true);
      }

      const response = await axios.post(API_MESSAGES_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      let newMsg = response.data;
      
      // Decrypt locally before saving
      newMsg = await decryptSingleMessage(newMsg, privateKey, user._id);

      setMessages((prev) => [...prev, newMsg]);

      if (socket) {
        socket.emit('sendMessage', newMsg);
      }

      return newMsg;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  const editOldMessage = async (messageId, newText) => {
    try {
      // In E2EE mode, let's keep edits clean: if it was encrypted, encrypt the edit as well!
      let finalEdit = newText;
      let isMsgEncrypted = false;
      let encIv = '';
      let encKeysString = '';

      if (!activeChat.groupName && activeChat.publicKey && user.publicKey) {
        const senderPubKey = JSON.parse(user.publicKey);
        const recipientPubKey = JSON.parse(activeChat.publicKey);
        const encResult = await encryptMessage(newText, senderPubKey, recipientPubKey);
        
        finalEdit = encResult.ciphertext;
        isMsgEncrypted = true;
        encIv = encResult.iv;
        
        const keysArray = [
          { userId: user._id, key: encResult.encryptedKeySender },
          { userId: activeChat._id, key: encResult.encryptedKeyRecipient }
        ];
        encKeysString = JSON.stringify(keysArray);
      }

      const response = await axios.put(`${API_MESSAGES_URL}/${messageId}`, {
        message: finalEdit,
        isEncrypted: isMsgEncrypted,
        encryptionIv: encIv,
        encryptedKeys: encKeysString,
      });

      let updatedMsg = response.data;
      updatedMsg = await decryptSingleMessage(updatedMsg, privateKey, user._id);

      setMessages((prev) => prev.map((m) => (m._id === messageId ? updatedMsg : m)));

      if (socket) {
        socket.emit('sendMessage', {
          ...updatedMsg,
          _isEditNotification: true
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to edit message');
      console.error(err);
    }
  };

  const deleteOldMessage = async (messageId, deleteType) => {
    try {
      const response = await axios.delete(`${API_MESSAGES_URL}/${messageId}`, { data: { type: deleteType } });
      
      if (deleteType === 'me') {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      } else {
        const updatedMsg = response.data;
        setMessages((prev) => prev.map((m) => (m._id === messageId ? updatedMsg : m)));
        
        if (socket) {
          socket.emit('sendMessage', {
            ...updatedMsg,
            _isDeleteNotification: true
          });
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete message');
      console.error(err);
    }
  };

  const reactToOldMessage = async (messageId, emoji) => {
    try {
      const response = await axios.post(`${API_MESSAGES_URL}/${messageId}/react`, { emoji });
      let updatedMsg = response.data;
      updatedMsg = await decryptSingleMessage(updatedMsg, privateKey, user._id);

      setMessages((prev) => prev.map((m) => (m._id === messageId ? updatedMsg : m)));

      if (socket) {
        socket.emit('sendMessage', {
          ...updatedMsg,
          _isReactionNotification: true
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createNewGroup = async (groupName, members, groupImage) => {
    try {
      const formData = new FormData();
      formData.append('groupName', groupName);
      formData.append('members', JSON.stringify(members));
      if (groupImage) {
        formData.append('groupImage', groupImage);
      }

      const response = await axios.post(API_GROUPS_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newGroup = response.data;
      setGroups((prev) => [newGroup, ...prev]);

      if (socket) {
        socket.emit('joinGroup', newGroup._id);
      }

      return newGroup;
    } catch (err) {
      console.error('Error creating group:', err);
      throw err;
    }
  };

  // Real-time socket events listener
  useEffect(() => {
    if (!socket) return;

    socket.on('receiveMessage', async (message) => {
      const active = activeChatRef.current;
      const privKey = privateKeyRef.current;

      // Decrypt incoming message
      let decryptedMsg = await decryptSingleMessage(message, privKey, user._id);

      if (decryptedMsg._isEditNotification || decryptedMsg._isDeleteNotification || decryptedMsg._isReactionNotification) {
        const isCurrentChat = active && (
          (decryptedMsg.groupId && active.groupName && active._id === decryptedMsg.groupId) ||
          (!decryptedMsg.groupId && !active.groupName && (active._id === decryptedMsg.senderId._id || active._id === decryptedMsg.receiverId))
        );

        if (isCurrentChat) {
          setMessages((prev) => prev.map((m) => (m._id === decryptedMsg._id ? decryptedMsg : m)));
        }
        return;
      }

      const isFromActiveChat = active && (
        (decryptedMsg.groupId && active.groupName && active._id === decryptedMsg.groupId) ||
        (!decryptedMsg.groupId && !active.groupName && decryptedMsg.senderId._id === active._id)
      );

      if (isFromActiveChat) {
        setMessages((prev) => [...prev, decryptedMsg]);

        if (!decryptedMsg.groupId) {
          socket.emit('messageSeen', {
            senderId: decryptedMsg.senderId._id,
            receiverId: user._id,
            messageIds: [decryptedMsg._id],
          });
        }
      } else {
        if (!decryptedMsg.groupId) {
          setNotifications((prev) => [...prev, decryptedMsg]);
        }

        if (Notification.permission === 'granted') {
          const title = decryptedMsg.groupId ? 'New Group Message' : `Message from ${decryptedMsg.senderId.username}`;
          const options = {
            body: decryptedMsg.message || 'Sent an attachment',
            icon: decryptedMsg.senderId.profilePic || '/default-avatar.png',
          };
          new Notification(title, options);
        }
      }
    });

    socket.on('typing', ({ senderId, receiverId, groupId, isTyping }) => {
      const chatId = groupId || senderId;
      
      setTypingUsers((prev) => {
        const chatTypers = { ...(prev[chatId] || {}) };
        
        if (isTyping) {
          const typingUser = users.find((u) => u._id === senderId);
          chatTypers[senderId] = typingUser ? typingUser.username : 'Someone';
        } else {
          delete chatTypers[senderId];
        }

        return {
          ...prev,
          [chatId]: chatTypers,
        };
      });
    });

    socket.on('messagesMarkedSeen', ({ receiverId, messageIds }) => {
      const active = activeChatRef.current;
      if (active && active._id === receiverId) {
        setMessages((prev) =>
          prev.map((m) => (messageIds.includes(m._id) ? { ...m, status: 'seen' } : m))
        );
      }
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('typing');
      socket.off('messagesMarkedSeen');
    };
  }, [socket, users, user]);

  return (
    <ChatContext.Provider
      value={{
        users,
        groups,
        activeChat,
        messages,
        typingUsers,
        notifications,
        selectChat,
        sendNewMessage,
        editOldMessage,
        deleteOldMessage,
        reactToOldMessage,
        createNewGroup,
        fetchChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
