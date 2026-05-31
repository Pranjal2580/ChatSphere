const express = require('express');
const router = express.Router();
const {
  createGroup,
  addMembers,
  removeMember,
  getUserGroups,
} = require('../controllers/groupController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', protect, upload.single('groupImage'), createGroup);
router.get('/', protect, getUserGroups);
router.post('/:groupId/add-member', protect, addMembers);
router.post('/:groupId/remove-member', protect, removeMember);

module.exports = router;
