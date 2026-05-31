import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Parse email from URL query params if available
  const queryParams = new URLSearchParams(location.search);
  const initialEmail = queryParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { resetUserPassword, user, error, setError } = useContext(AuthContext);

  useEffect(() => {
    setError(null);
    if (user) {
      navigate('/chat');
    }
  }, [user, navigate, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email || !pin || !newPassword || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setLocalError('Password must be at least 6 characters long');
      return;
    }

    try {
      const res = await resetUserPassword(email, pin, newPassword);
      setSuccessMsg(res.message || 'Password reset successful!');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      // Handled by context
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel" style={{ maxWidth: '440px' }}>
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Verify your identity and pick a new password</p>

        {/* Security Warning Alert */}
        <div style={{
          background: 'rgba(255, 61, 0, 0.12)',
          border: '1px dashed var(--error-red)',
          borderRadius: '12px',
          color: '#ffab91',
          padding: '12px 16px',
          fontSize: '0.82rem',
          textAlign: 'left',
          lineHeight: '1.4',
          marginBottom: '20px'
        }}>
          ⚠️ <b>E2EE Security Warning:</b> Resetting your password will regenerate your asymmetric encryption keys. Previous encrypted messages will become unreadable on new sessions.
        </div>

        {localError && (
          <div style={{
            background: 'rgba(255, 61, 0, 0.15)',
            border: '1px solid var(--error-red)',
            borderRadius: '12px',
            color: '#ff8a65',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {localError}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(255, 61, 0, 0.15)',
            border: '1px solid var(--error-red)',
            borderRadius: '12px',
            color: '#ff8a65',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(0, 230, 118, 0.15)',
            border: '1px solid var(--success-green)',
            borderRadius: '12px',
            color: '#a9fbc6',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="glass-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">6-Digit PIN</label>
            <input
              type="text"
              id="pin"
              className="glass-input"
              placeholder="Enter PIN from console logs"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              className="glass-input"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              className="glass-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="glass-button" style={{ marginTop: '10px' }}>
            Confirm Password Reset
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: '20px' }}>
          Back to{' '}
          <Link to="/login" className="auth-link">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
