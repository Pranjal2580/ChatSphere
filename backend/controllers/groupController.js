const Group = require('../models/Group');

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
const createGroup = async (req, res) => {
  let { groupName, members } = req.body;

  if (!groupName) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  try {
    // Parse members if passed as string (e.g. from FormData)
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [];
      }
    }

    if (!Array.isArray(members)) {
      members = [];
    }

    // Add admin to members list if not already there
    if (!members.includes(req.user.id)) {
      members.push(req.user.id);
    }

    let groupImageUrl = '';
    if (req.file) {
      const host = req.get('host');
      const protocol = req.protocol;
      groupImageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }

    const newGroup = await Group.create({
      groupName,
      groupImage: groupImageUrl,
      members,
      admin: req.user.id,
    });

    const group = await Group.findById(newGroup._id)
      .populate('members', 'username email profilePic bio status')
      .populate('admin', 'username profilePic');

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add members to a group
// @route   POST /api/groups/:groupId/add-member
// @access  Private
const addMembers = async (req, res) => {
  const { groupId } = req.params;
  const { memberIds } = req.body; // Array of member user IDs

  if (!memberIds || !Array.isArray(memberIds)) {
    return res.status(400).json({ message: 'Member IDs array is required' });
  }

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only admin can add members
    if (group.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add members (Admin only)' });
    }

    // Add unique member IDs
    memberIds.forEach((id) => {
      if (!group.members.includes(id)) {
        group.members.push(id);
      }
    });

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'username email profilePic bio status')
      .populate('admin', 'username profilePic');

    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a member from a group
// @route   POST /api/groups/:groupId/remove-member
// @access  Private
const removeMember = async (req, res) => {
  const { groupId } = req.params;
  const { memberId } = req.body;

  if (!memberId) {
    return res.status(400).json({ message: 'Member ID is required' });
  }

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only admin can remove members, or a user can remove themselves (leave group)
    const isSelfLeaving = memberId === req.user.id;
    const isAdmin = group.admin.toString() === req.user.id;

    if (!isAdmin && !isSelfLeaving) {
      return res.status(403).json({ message: 'Not authorized to remove members (Admin only)' });
    }

    // Admin cannot leave if they are the only member, unless they delete the group. Or let's just allow leaving.
    group.members = group.members.filter((m) => m.toString() !== memberId);

    // If admin is leaving and there are members, assign a new admin
    if (isSelfLeaving && isAdmin && group.members.length > 0) {
      group.admin = group.members[0];
    }

    await group.save();

    // If group is empty, delete it
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.json({ message: 'Group deleted because all members left', groupId });
    }

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'username email profilePic bio status')
      .populate('admin', 'username profilePic');

    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all groups the current user is in
// @route   GET /api/groups
// @access  Private
const getUserGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate('members', 'username email profilePic bio status')
      .populate('admin', 'username profilePic')
      .sort({ updatedAt: -1 });

    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createGroup,
  addMembers,
  removeMember,
  getUserGroups,
};
