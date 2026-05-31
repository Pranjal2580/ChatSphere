const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');

// @desc    Send a message (1-1 or Group)
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { receiverId, groupId, message, replyTo, isEncrypted, encryptionIv, encryptedKeys, isForwarded } = req.body;
  
  if (!receiverId && !groupId) {
    return res.status(400).json({ message: 'Receiver ID or Group ID is required' });
  }

  try {
    let imageUrl = '';
    let audioUrl = '';
    let videoUrl = '';

    // Check if files were uploaded
    if (req.files) {
      const host = req.get('host');
      const protocol = req.protocol;

      if (req.files.image && req.files.image[0]) {
        imageUrl = `${protocol}://${host}/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.audio && req.files.audio[0]) {
        audioUrl = `${protocol}://${host}/uploads/${req.files.audio[0].filename}`;
      }
      if (req.files.video && req.files.video[0]) {
        videoUrl = `${protocol}://${host}/uploads/${req.files.video[0].filename}`;
      }
    }

    // Double check if there is content
    if (!message && !imageUrl && !audioUrl && !videoUrl) {
      return res.status(400).json({ message: 'Cannot send empty message' });
    }

    const messageData = {
      senderId: req.user.id,
      message: message || '',
      image: imageUrl,
      audio: audioUrl,
      video: videoUrl,
      replyTo: replyTo || null,
      status: 'sent',
      isForwarded: isForwarded === 'true' || isForwarded === true,
    };

    // If DM, enforce E2EE parameters and check Block status
    if (receiverId) {
      // 1. Check if receiver blocked sender
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      if (receiver.blockedUsers.includes(req.user.id)) {
        return res.status(403).json({ message: 'You are blocked by this user' });
      }

      // 2. Add E2EE properties if provided
      messageData.receiverId = receiverId;
      messageData.isEncrypted = isEncrypted === 'true' || isEncrypted === true;
      if (messageData.isEncrypted) {
        messageData.encryptionIv = encryptionIv || '';
        if (typeof encryptedKeys === 'string') {
          try {
            messageData.encryptedKeys = JSON.parse(encryptedKeys);
          } catch (e) {
            messageData.encryptedKeys = [];
          }
        } else {
          messageData.encryptedKeys = encryptedKeys || [];
        }
      }
    } else {
      // Group message
      messageData.groupId = groupId;
      messageData.isEncrypted = false;
      
      const group = await Group.findById(groupId);
      if (!group || !group.members.includes(req.user.id)) {
        return res.status(403).json({ message: 'Not authorized to send messages to this group' });
      }
    }

    let newMessage = await Message.create(messageData);
    
    newMessage = await Message.findById(newMessage._id)
      .populate('senderId', 'username profilePic')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'username' }
      });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get 1-1 chat messages
// @route   GET /api/messages/:receiverId
// @access  Private
const getMessages = async (req, res) => {
  const { receiverId } = req.params;

  try {
    const messages = await Message.find({
      $and: [
        {
          $or: [
            { senderId: req.user.id, receiverId: receiverId },
            { senderId: receiverId, receiverId: req.user.id },
          ],
        },
        { deletedFor: { $ne: req.user.id } },
      ],
    })
    .populate('senderId', 'username profilePic')
    .populate({
      path: 'replyTo',
      populate: { path: 'senderId', select: 'username' }
    })
    .sort({ createdAt: 1 });

    // Mark messages sent by the receiver as seen
    await Message.updateMany(
      { senderId: receiverId, receiverId: req.user.id, status: { $ne: 'seen' } },
      { $set: { status: 'seen' } }
    );

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get group chat messages
// @route   GET /api/messages/group/:groupId
// @access  Private
const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to view this group messages' });
    }

    const messages = await Message.find({
      groupId: groupId,
      deletedFor: { $ne: req.user.id },
    })
    .populate('senderId', 'username profilePic')
    .populate({
      path: 'replyTo',
      populate: { path: 'senderId', select: 'username' }
    })
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Edit a message (within 5 minutes)
// @route   PUT /api/messages/:messageId
// @access  Private
const editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message text is required' });
  }

  try {
    const msg = await Message.findById(messageId);

    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (msg.senderId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to edit this message' });
    }

    const timeElapsed = Date.now() - new Date(msg.createdAt).getTime();
    if (timeElapsed > 5 * 60 * 1000) {
      return res.status(400).json({ message: 'Time limit to edit message has expired (5 minutes)' });
    }

    msg.message = message;
    msg.isEdited = true;
    await msg.save();

    const updatedMsg = await Message.findById(messageId)
      .populate('senderId', 'username profilePic')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'username' }
      });

    res.json(updatedMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const { type } = req.body;

  if (!type || (type !== 'me' && type !== 'everyone')) {
    return res.status(400).json({ message: 'Delete type is required (me or everyone)' });
  }

  try {
    const msg = await Message.findById(messageId);

    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (type === 'me') {
      if (!msg.deletedFor.includes(req.user.id)) {
        msg.deletedFor.push(req.user.id);
        await msg.save();
      }
      return res.json({ success: true, message: 'Message deleted for you' });
    }

    if (type === 'everyone') {
      if (msg.senderId.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to delete this message for everyone' });
      }

      msg.isDeleted = true;
      msg.message = 'This message was deleted';
      msg.image = '';
      msg.audio = '';
      msg.video = '';
      await msg.save();

      const updatedMsg = await Message.findById(messageId)
        .populate('senderId', 'username profilePic')
        .populate({
          path: 'replyTo',
          populate: { path: 'senderId', select: 'username' }
        });

      return res.json(updatedMsg);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    React to a message
// @route   POST /api/messages/:messageId/react
// @access  Private
const reactToMessage = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji) {
    return res.status(400).json({ message: 'Emoji is required' });
  }

  try {
    const msg = await Message.findById(messageId);

    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const reactionIndex = msg.reactions.findIndex(
      (r) => r.userId.toString() === req.user.id
    );

    if (reactionIndex > -1) {
      if (msg.reactions[reactionIndex].emoji === emoji) {
        msg.reactions.splice(reactionIndex, 1);
      } else {
        msg.reactions[reactionIndex].emoji = emoji;
      }
    } else {
      msg.reactions.push({ userId: req.user.id, emoji });
    }

    await msg.save();

    const updatedMsg = await Message.findById(messageId)
      .populate('senderId', 'username profilePic')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'username' }
      });

    res.json(updatedMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  getGroupMessages,
  editMessage,
  deleteMessage,
  reactToMessage,
};
