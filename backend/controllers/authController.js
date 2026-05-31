const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'chatsphere_jwt_secret_token_key_987654321_abcdef', {
    expiresIn: '30d',
  });
};

// Mail Delivery service
const sendResetEmail = async (email, pin) => {
  // Enforce SMTP settings
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: 'SMTP server settings not configured in backend/.env. Please define SMTP_HOST, SMTP_USER, and SMTP_PASS to send OTP emails.' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"ChatSphere Admin" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'ChatSphere - Security OTP Password Reset PIN',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background-color: #0b0c10; color: #fff;">
        <h2 style="color: #66fcf1; text-align: center; margin-bottom: 20px; font-weight: bold;">ChatSphere Account OTP PIN</h2>
        <p style="color: #c5c6c7; font-size: 0.95rem; line-height: 1.5;">Hello,</p>
        <p style="color: #c5c6c7; font-size: 0.95rem; line-height: 1.5;">You requested to reset your account password. Please use the following 6-digit verification PIN to authorize E2EE keypair rebuild and confirm your identity:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 2.2rem; font-weight: bold; letter-spacing: 5px; color: #00f2fe; background-color: rgba(79, 172, 254, 0.15); border: 1px solid rgba(79, 172, 254, 0.3); padding: 12px 24px; border-radius: 8px; display: inline-block; box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);">${pin}</span>
        </div>
        <p style="color: #8a96ab; font-size: 0.85rem; line-height: 1.5;">This PIN is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border-top: 1px dashed rgba(255,255,255,0.08); margin-top: 30px; margin-bottom: 20px;">
        <p style="font-size: 0.78rem; color: #45a29e; text-align: center;">ChatSphere — End-to-End Encrypted Instant Messaging</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[REAL SMTP EMAIL DELIVERED TO ${email}]`);
    return { success: true, isEthereal: false };
  } catch (err) {
    console.error('Mail delivery failure:', err.message);
    return { success: false, error: err.message };
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { username, email, password, publicKey, encryptedPrivateKey, keySalt } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please add all fields' });
  }

  try {
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with that username or email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      profilePic: '',
      bio: "Hello there! I am using ChatSphere.",
      status: 'online',
      customStatus: 'Available',
      publicKey: publicKey || '',
      encryptedPrivateKey: encryptedPrivateKey || '',
      keySalt: keySalt || '',
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
        status: user.status,
        customStatus: user.customStatus,
        publicKey: user.publicKey,
        encryptedPrivateKey: user.encryptedPrivateKey,
        keySalt: user.keySalt,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email }
      ]
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      user.status = 'online';
      await user.save();

      res.json({
        _id: user.id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
        status: user.status,
        customStatus: user.customStatus,
        publicKey: user.publicKey,
        encryptedPrivateKey: user.encryptedPrivateKey,
        keySalt: user.keySalt,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      user.username = req.body.username || user.username;
      user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
      user.status = req.body.status || user.status;
      user.customStatus = req.body.customStatus || user.customStatus;
      
      if (req.body.profilePic !== undefined) {
        user.profilePic = req.body.profilePic;
      }

      if (req.file) {
        const host = req.get('host');
        const protocol = req.protocol;
        user.profilePic = `${protocol}://${host}/uploads/${req.file.filename}`;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic,
        bio: updatedUser.bio,
        status: updatedUser.status,
        customStatus: updatedUser.customStatus,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request Password Reset PIN
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'No user registered with that email' });
    }

    // Generate random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.resetPasswordToken = pin;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    // Trigger email delivery
    const mailResult = await sendResetEmail(user.email, pin);

    if (mailResult.success) {
      if (mailResult.isEthereal) {
        return res.json({
          message: `Verification OTP sent via sandbox Ethereal mail. Check the preview link logged in your backend terminal console: ${mailResult.previewUrl}`,
          previewUrl: mailResult.previewUrl
        });
      }
      return res.json({ message: 'Verification OTP sent to your email address.' });
    } else {
      // Fallback if SMTP fails completely
      return res.status(500).json({ message: 'Failed to send OTP to email: ' + (mailResult.error || 'SMTP check failure') });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset Password with E2EE updates
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  const { email, token, newPassword, publicKey, encryptedPrivateKey, keySalt } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Please provide email, reset PIN, and new password' });
  }

  try {
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset PIN' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    
    if (publicKey) user.publicKey = publicKey;
    if (encryptedPrivateKey) user.encryptedPrivateKey = encryptedPrivateKey;
    if (keySalt) user.keySalt = keySalt;

    user.resetPasswordToken = '';
    user.resetPasswordExpires = undefined;

    await user.save();
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Connect / Register with Google OAuth Account
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  const { idToken, publicKey, encryptedPrivateKey, keySalt } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Google ID Token is required' });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id-here.apps.googleusercontent.com';
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    const googleId = payload['sub'];
    const email = payload['email'];
    const username = (payload['name'] || email.split('@')[0]).replace(/\s+/g, '_').toLowerCase();
    const profilePic = payload['picture'] || '';

    if (!googleId || !email) {
      return res.status(400).json({ message: 'Invalid token payload received from Google' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      
      if (!user.profilePic && profilePic) {
        user.profilePic = profilePic;
      }

      if (publicKey && encryptedPrivateKey && keySalt) {
        user.publicKey = publicKey;
        user.encryptedPrivateKey = encryptedPrivateKey;
        user.keySalt = keySalt;
      }

      user.status = 'online';
      await user.save();
    } else {
      const placeholderPassword = Math.random().toString(36).substring(2, 10);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(placeholderPassword, salt);

      user = await User.create({
        username: username,
        email: email.toLowerCase(),
        password: hashedPassword,
        profilePic: profilePic,
        googleId,
        bio: 'Hello! I logged in via Google.',
        status: 'online',
        customStatus: 'Available',
        publicKey: publicKey || '',
        encryptedPrivateKey: encryptedPrivateKey || '',
        keySalt: keySalt || '',
      });
    }

    res.json({
      _id: user.id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      status: user.status,
      customStatus: user.customStatus,
      publicKey: user.publicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      keySalt: user.keySalt,
      token: generateToken(user.id),
    });
  } catch (error) {
    console.error('Google token verification error:', error.message);
    res.status(401).json({ message: 'Google authentication failed: ' + error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  googleLogin,
};
