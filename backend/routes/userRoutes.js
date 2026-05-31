const express = require('express');
const router = express.Router();
const { searchUsers, getAllUsers, blockUser, unblockUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchUsers);
router.get('/', protect, getAllUsers);
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);

module.exports = router;
