const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: "Hello there! I am using ChatSphere.",
    },
    status: {
      type: String,
      default: 'online', // 'online', 'offline'
    },
    customStatus: {
      type: String,
      default: 'Available', // Custom text status e.g. 'Busy', 'At work'
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // End-to-End Encryption fields
    publicKey: {
      type: String, // Stringified JWK
      default: '',
    },
    encryptedPrivateKey: {
      type: String, // Base64 ciphertext + IV wrapper
      default: '',
    },
    keySalt: {
      type: String, // PBKDF2 Salt
      default: '',
    },
    // User Blocking list
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Password reset fields
    resetPasswordToken: {
      type: String,
      default: '',
    },
    resetPasswordExpires: {
      type: Date,
    },
    // Google Sign-In field
    googleId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
