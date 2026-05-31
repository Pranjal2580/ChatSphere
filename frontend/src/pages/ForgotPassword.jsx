import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('rathorepranjal18@gmail.com');
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { sendForgotPasswordPin, user, error, setError } = useContext(AuthContext);
  const navigate = useNavigate();

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

    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }

    try {
      const res = await sendForgotPasswordPin(email);
      setSuccessMsg(res.message || 'Reset PIN sent! Check your terminal console logs.');
      // Auto redirect to reset screen after 3 seconds
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 3000);
    } catch (err) {
      // Handled by context
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel" style={{ maxWidth: '400px' }}>
        <h1 className="auth-title">Reset PIN</h1>
        <p className="auth-subtitle">Get a PIN to securely reset your password</p>

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
              placeholder="enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="glass-button" style={{ marginTop: '10px' }}>
            Request Reset PIN
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

export default ForgotPassword;
