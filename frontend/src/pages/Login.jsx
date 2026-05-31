import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

// Native JWT Decoding Helper
const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode Google ID Token:', e);
    return null;
  }
};

const Login = () => {
  const [email, setEmail] = useState('rathorepranjal18@gmail.com');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Google SSO states
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [googleProfile, setGoogleProfile] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [isNewSSOUser, setIsNewSSOUser] = useState(false);

  const { login, loginWithGoogle, user, error, setError } = useContext(AuthContext);
  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Handle Google SDK callback response (Real Google Sign-In)
  const handleCredentialResponse = async (response) => {
    setLocalError('');
    const idToken = response.credential;
    const decoded = decodeJwtPayload(idToken);

    if (!decoded) {
      setLocalError('Failed to parse Google account credentials');
      return;
    }

    const profile = {
      idToken,
      googleId: decoded.sub,
      email: decoded.email,
      username: decoded.name.replace(/\s+/g, '_').toLowerCase(),
      profilePic: decoded.picture
    };

    await checkE2EEAndPrompt(profile);
  };

  // Check E2EE state and launch PIN modals
  const checkE2EEAndPrompt = async (profile) => {
    setGoogleProfile(profile);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/google', {
        idToken: profile.idToken,
      });

      const dbUser = res.data;
      if (!dbUser.publicKey) {
        setIsNewSSOUser(true);
      } else {
        setIsNewSSOUser(false);
      }
      setShowPassphraseModal(true);
    } catch (err) {
      console.error(err);
      setLocalError('Failed to verify Google E2EE database parameters');
    }
  };

  // Initialize Native Google Identity button
  useEffect(() => {
    setError(null);
    if (user) {
      navigate('/chat');
      return;
    }

    const initGsi = () => {
      if (window.google && clientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });

          window.google.accounts.id.renderButton(
            document.getElementById('googleSignInDiv'),
            { theme: 'outline', size: 'large', width: 340, shape: 'pill' }
          );
        } catch (e) {
          console.error('Error initializing Google GSI SDK:', e);
        }
      }
    };

    const timer = setTimeout(initGsi, 800);
    return () => clearTimeout(timer);
  }, [user, navigate, setError, clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      // Handled by context
    }
  };

  const handlePassphraseSubmit = async (e) => {
    e.preventDefault();
    if (passphrase.length < 6) {
      alert('Passphrase PIN must be at least 6 digits long.');
      return;
    }

    try {
      await loginWithGoogle(googleProfile, passphrase);
      setShowPassphraseModal(false);
      setPassphrase('');
      navigate('/chat');
    } catch (err) {
      setLocalError(err.message || 'SSO Encryption verification failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        <h1 className="auth-title">ChatSphere</h1>
        <p className="auth-subtitle">Connect instantly with a premium chat experience</p>

        {(localError || error) && (
          <div style={{
            background: 'rgba(255, 61, 0, 0.15)',
            border: '1px solid var(--error-red)',
            borderRadius: '12px',
            color: '#ff8a65',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email or Username</label>
            <input
              type="text"
              id="email"
              className="glass-input"
              placeholder="Enter your email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.78rem' }} className="auth-link">
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              id="password"
              className="glass-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="glass-button" style={{ marginTop: '10px' }}>
            Sign In
          </button>
        </form>

        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }}></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
          <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }}></div>
        </div>

        {/* Real Native Google Sign-In Div */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div id="googleSignInDiv" style={{ minHeight: '40px' }}></div>
          {!clientId && (
            <p style={{ fontSize: '0.75rem', color: 'var(--error-red)', textAlign: 'center', fontWeight: '500' }}>
              ⚠️ Google Sign-In requires VITE_GOOGLE_CLIENT_ID configured in frontend/.env
            </p>
          )}
        </div>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">
            Create one
          </Link>
        </p>
      </div>

      {/* --- E2EE PASSPHRASE ENTRY MODAL --- */}
      {showPassphraseModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3>E2EE Chat Encryption</h3>
            
            {isNewSSOUser ? (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-gray)', margin: '15px 0', lineHeight: '1.4' }}>
                  🔑 <b>Passphrase Setup:</b> Choose a 6-digit PIN to secure your End-to-End Encrypted chat session. You must enter this PIN when logging in on other devices.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-gray)', margin: '15px 0', lineHeight: '1.4' }}>
                  🔑 <b>Enter Passphrase PIN:</b> Enter your 6-digit Security PIN to decrypt your E2EE private key and unlock your chat history.
                </p>
              </>
            )}

            <form onSubmit={handlePassphraseSubmit} className="auth-form" style={{ marginTop: '10px' }}>
              <div className="form-group">
                <input
                  type="password"
                  className="glass-input"
                  placeholder="Enter 6-digit passphrase PIN"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  maxLength={15}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPassphraseModal(false);
                    setPassphrase('');
                    setGoogleProfile(null);
                  }}
                  className="glass-button secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-button"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Verify E2EE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
