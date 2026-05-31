const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getGroupMessages,
  editMessage,
  deleteMessage,
  reactToMessage,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Accept image, audio, or video fields (up to 1 each)
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

router.post('/', protect, uploadFields, sendMessage);
router.get('/:receiverId', protect, getMessages);
router.get('/group/:groupId', protect, getGroupMessages);
router.put('/:messageId', protect, editMessage);
router.delete('/:messageId', protect, deleteMessage);
router.post('/:messageId/react', protect, reactToMessage);

module.exports = router;
