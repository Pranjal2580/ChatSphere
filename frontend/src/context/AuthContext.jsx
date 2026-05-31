import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import {
  generateAsymmetricKeys,
  deriveMasterKey,
  encryptPrivateKey,
  decryptPrivateKey,
  arrayBufferToBase64,
} from '../services/cryptoService';

export const AuthContext = createContext();

const API_URL = 'http://localhost:5000/api/auth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);

  // Set default authorization header if token exists
  useEffect(() => {
    const storedUser = localStorage.getItem('chatSphereUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${parsedUser.token}`;
        
        const cachedJwk = sessionStorage.getItem('decryptedPrivateKey');
        if (cachedJwk) {
          const jwk = JSON.parse(cachedJwk);
          window.crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSA-OAEP', hash: { name: 'SHA-256' } },
            true,
            ['decrypt']
          ).then((privKey) => {
            setPrivateKey(privKey);
          }).catch(err => {
            console.error('Failed to import cached private key', err);
          });
        }
      } catch (err) {
        localStorage.removeItem('chatSphereUser');
      }
    }
    setLoading(false);
  }, []);

  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const keyPair = await generateAsymmetricKeys();
      const pubJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const publicKeyJwkString = JSON.stringify(pubJwk);

      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = arrayBufferToBase64(saltBytes);
      const masterKey = await deriveMasterKey(password, saltBase64);

      const { encryptedPrivateKey, iv } = await encryptPrivateKey(keyPair.privateKey, masterKey);
      const privateKeyPayload = JSON.stringify({ ciphertext: encryptedPrivateKey, iv });

      const response = await axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
        publicKey: publicKeyJwkString,
        encryptedPrivateKey: privateKeyPayload,
        keySalt: saltBase64,
      });

      const userData = response.data;
      setUser(userData);
      localStorage.setItem('chatSphereUser', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

      setPrivateKey(keyPair.privateKey);
      const privJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
      sessionStorage.setItem('decryptedPrivateKey', JSON.stringify(privJwk));

      return userData;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Registration failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('chatSphereUser', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

      if (userData.encryptedPrivateKey && userData.keySalt) {
        try {
          const { ciphertext, iv } = JSON.parse(userData.encryptedPrivateKey);
          const masterKey = await deriveMasterKey(password, userData.keySalt);
          const privKey = await decryptPrivateKey(ciphertext, masterKey, iv);
          
          setPrivateKey(privKey);
          
          const privJwk = await window.crypto.subtle.exportKey('jwk', privKey);
          sessionStorage.setItem('decryptedPrivateKey', JSON.stringify(privJwk));
        } catch (decErr) {
          console.error('Error decrypting private key on login:', decErr);
        }
      }

      return userData;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setPrivateKey(null);
    localStorage.removeItem('chatSphereUser');
    sessionStorage.removeItem('decryptedPrivateKey');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateProfile = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };
      
      const response = await axios.put(`${API_URL}/profile`, formData, config);
      const updatedUser = { ...user, ...response.data };
      setUser(updatedUser);
      localStorage.setItem('chatSphereUser', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Profile update failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async (targetUserId) => {
    try {
      await axios.post('http://localhost:5000/api/users/block', { targetUserId });
      const updatedUser = {
        ...user,
        blockedUsers: [...(user.blockedUsers || []), targetUserId]
      };
      setUser(updatedUser);
      localStorage.setItem('chatSphereUser', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  const unblockUser = async (targetUserId) => {
    try {
      await axios.post('http://localhost:5000/api/users/unblock', { targetUserId });
      const updatedUser = {
        ...user,
        blockedUsers: (user.blockedUsers || []).filter((id) => id !== targetUserId)
      };
      setUser(updatedUser);
      localStorage.setItem('chatSphereUser', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  };

  // Request Reset PIN
  const sendForgotPasswordPin = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/forgot-password`, { email });
      return response.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to request reset PIN';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Reset Password with client-side E2EE Key Regeneration
  const resetUserPassword = async (email, token, newPassword) => {
    setLoading(true);
    setError(null);
    try {
      // Regenerate new RSA Key Pair
      const keyPair = await generateAsymmetricKeys();
      const pubJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const publicKeyJwkString = JSON.stringify(pubJwk);

      const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = arrayBufferToBase64(saltBytes);
      const masterKey = await deriveMasterKey(newPassword, saltBase64);

      const { encryptedPrivateKey, iv } = await encryptPrivateKey(keyPair.privateKey, masterKey);
      const privateKeyPayload = JSON.stringify({ ciphertext: encryptedPrivateKey, iv });

      const response = await axios.post(`${API_URL}/reset-password`, {
        email,
        token,
        newPassword,
        publicKey: publicKeyJwkString,
        encryptedPrivateKey: privateKeyPayload,
        keySalt: saltBase64,
      });

      return response.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Password reset failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Google SSO Login Flow
  const loginWithGoogle = async (googleProfile, chatPassphrase) => {
    setLoading(true);
    setError(null);
    try {
      // First check key state on backend by requesting SSO login payload
      const ssoCheckRes = await axios.post(`${API_URL}/google`, {
        idToken: googleProfile.idToken,
      });
      
      const checkUser = ssoCheckRes.data;

      // If user does not have E2EE keys setup yet, generate them now using the passphrase
      if (!checkUser.publicKey && chatPassphrase) {
        const keyPair = await generateAsymmetricKeys();
        const pubJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const publicKeyJwkString = JSON.stringify(pubJwk);

        const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = arrayBufferToBase64(saltBytes);
        const masterKey = await deriveMasterKey(chatPassphrase, saltBase64);

        const { encryptedPrivateKey, iv } = await encryptPrivateKey(keyPair.privateKey, masterKey);
        const privateKeyPayload = JSON.stringify({ ciphertext: encryptedPrivateKey, iv });

        // Update the backend with E2EE keys
        const response = await axios.post(`${API_URL}/google`, {
          idToken: googleProfile.idToken,
          publicKey: publicKeyJwkString,
          encryptedPrivateKey: privateKeyPayload,
          keySalt: saltBase64,
        });

        const userData = response.data;
        setUser(userData);
        localStorage.setItem('chatSphereUser', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

        setPrivateKey(keyPair.privateKey);
        const privJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
        sessionStorage.setItem('decryptedPrivateKey', JSON.stringify(privJwk));

        return userData;
      } else {
        // If keys exist, decrypt them using the provided passphrase
        const userData = ssoCheckRes.data;
        setUser(userData);
        localStorage.setItem('chatSphereUser', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

        if (userData.encryptedPrivateKey && userData.keySalt && chatPassphrase) {
          const { ciphertext, iv } = JSON.parse(userData.encryptedPrivateKey);
          const masterKey = await deriveMasterKey(chatPassphrase, userData.keySalt);
          const privKey = await decryptPrivateKey(ciphertext, masterKey, iv);
          
          setPrivateKey(privKey);
          
          const privJwk = await window.crypto.subtle.exportKey('jwk', privKey);
          sessionStorage.setItem('decryptedPrivateKey', JSON.stringify(privJwk));
        }

        return userData;
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Google Sign-In failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        privateKey,
        loading,
        error,
        register,
        login,
        logout,
        updateProfile,
        blockUser,
        unblockUser,
        sendForgotPasswordPin,
        resetUserPassword,
        loginWithGoogle,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
