const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, upload.single('profilePic'), updateUserProfile);

// Password recovery endpoints
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google Sign-In endpoint
router.post('/google', googleLogin);

module.exports = router;
