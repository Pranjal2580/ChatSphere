const User = require('../models/User');

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
          ],
        },
        { _id: { $ne: req.user.id } }, // Exclude current user
      ],
    }).select('-password'); // We keep publicKey here!

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users for initial contact list
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Block a user
// @route   POST /api/users/block
// @access  Private
const blockUser = async (req, res) => {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  try {
    const user = await User.findById(req.user.id);
    
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      await user.save();
    }

    res.json({ message: 'User blocked successfully', targetUserId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Unblock a user
// @route   POST /api/users/unblock
// @access  Private
const unblockUser = async (req, res) => {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  try {
    const user = await User.findById(req.user.id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
    await user.save();

    res.json({ message: 'User unblocked successfully', targetUserId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  searchUsers,
  getAllUsers,
  blockUser,
  unblockUser,
};
