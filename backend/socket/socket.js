const User = require('../models/User');
const Message = require('../models/Message');

// Active users map: userId -> socketId
const activeUsers = new Map();

const socketHandler = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    
    if (!userId || userId === 'undefined') {
      console.log('Client connected without userId');
      return;
    }

    console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    
    // Store user connection
    activeUsers.set(userId, socket.id);
    
    // Join personal room for multi-tab support
    socket.join(userId);

    // Update status to online in database
    try {
      await User.findByIdAndUpdate(userId, { status: 'online' });
      // Broadcast online users
      io.emit('getOnlineUsers', Array.from(activeUsers.keys()));
    } catch (err) {
      console.error('Error updating user online status:', err.message);
    }

    // Join rooms for all groups the user is member of
    socket.on('joinGroup', (groupId) => {
      socket.join(groupId);
      console.log(`User ${userId} joined room group: ${groupId}`);
    });

    socket.on('leaveGroup', (groupId) => {
      socket.leave(groupId);
      console.log(`User ${userId} left room group: ${groupId}`);
    });

    // 1-to-1 typing indicator
    socket.on('typing', ({ senderId, receiverId, groupId }) => {
      if (receiverId) {
        socket.to(receiverId).emit('typing', { senderId, receiverId, isTyping: true });
      } else if (groupId) {
        socket.to(groupId).emit('typing', { senderId, groupId, isTyping: true });
      }
    });

    // Stop typing indicator
    socket.on('stopTyping', ({ senderId, receiverId, groupId }) => {
      if (receiverId) {
        socket.to(receiverId).emit('typing', { senderId, receiverId, isTyping: false });
      } else if (groupId) {
        socket.to(groupId).emit('typing', { senderId, groupId, isTyping: false });
      }
    });

    // Real-time message events relay
    socket.on('sendMessage', (message) => {
      const { receiverId, groupId } = message;
      
      if (receiverId) {
        // Send to receiver room
        socket.to(receiverId).emit('receiveMessage', message);
      } else if (groupId) {
        // Send to group room
        socket.to(groupId).emit('receiveMessage', message);
      }
    });

    // Read Receipt: messageSeen
    socket.on('messageSeen', async ({ senderId, receiverId, messageIds }) => {
      try {
        if (messageIds && messageIds.length > 0) {
          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { status: 'seen' } }
          );
          
          // Notify the sender that messages were seen
          socket.to(senderId).emit('messagesMarkedSeen', { receiverId, messageIds });
        }
      } catch (err) {
        console.error('Error updating message status to seen:', err.message);
      }
    });

    // --- WebRTC Calling Signaling ---
    socket.on('call-user', ({ userToCall, signalData, from, name, callType }) => {
      console.log(`Calling user ${userToCall} from ${from} (${name})`);
      socket.to(userToCall).emit('incoming-call', {
        signal: signalData,
        from,
        name,
        callType,
      });
    });

    socket.on('answer-call', ({ to, signal }) => {
      console.log(`Answering call to ${to}`);
      socket.to(to).emit('call-accepted', { signal });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', { candidate });
    });

    socket.on('call-rejected', ({ to }) => {
      console.log(`Call rejected to ${to}`);
      socket.to(to).emit('call-rejected');
    });

    socket.on('end-call', ({ to }) => {
      console.log(`Ending call to ${to}`);
      socket.to(to).emit('end-call');
    });

    // Disconnect event
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      activeUsers.delete(userId);
      
      try {
        // Update user status and lastSeen
        await User.findByIdAndUpdate(userId, {
          status: 'offline',
          lastSeen: Date.now(),
        });
        
        // Broadcast updated online users
        io.emit('getOnlineUsers', Array.from(activeUsers.keys()));
      } catch (err) {
        console.error('Error updating user offline status:', err.message);
      }
    });
  });
};

module.exports = { socketHandler, activeUsers };
