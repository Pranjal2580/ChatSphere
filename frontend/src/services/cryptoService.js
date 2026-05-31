// Helper to convert ArrayBuffer to Base64
export const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to convert Base64 to ArrayBuffer
export const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate RSA-OAEP 2048 Asymmetric Key Pair
export const generateAsymmetricKeys = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: { name: 'SHA-256' },
    },
    true, // Extractable
    ['encrypt', 'decrypt']
  );
  return keyPair;
};

// Derive AES Master Key from password + salt via PBKDF2
export const deriveMasterKey = async (password, saltBase64) => {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = base64ToArrayBuffer(saltBase64);

  const masterKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false, // Non-extractable
    ['encrypt', 'decrypt']
  );

  return masterKey;
};

// Encrypt RSA Private Key using AES Master Key
export const encryptPrivateKey = async (privateKey, masterKey) => {
  const exportedPrivateKeyJwk = await window.crypto.subtle.exportKey('jwk', privateKey);
  const jwkString = JSON.stringify(exportedPrivateKeyJwk);
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    masterKey,
    enc.encode(jwkString)
  );

  return {
    encryptedPrivateKey: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv),
  };
};

// Decrypt RSA Private Key using AES Master Key
export const decryptPrivateKey = async (encryptedPrivateKeyBase64, masterKey, ivBase64) => {
  const encryptedData = base64ToArrayBuffer(encryptedPrivateKeyBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    masterKey,
    encryptedData
  );

  const dec = new TextDecoder();
  const jwkString = dec.decode(decryptedData);
  const jwk = JSON.parse(jwkString);

  const privateKey = await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: { name: 'SHA-256' },
    },
    true,
    ['decrypt']
  );

  return privateKey;
};

// Encrypt message hybrid scheme: AES-GCM for text + RSA-OAEP for AES key
export const encryptMessage = async (plaintext, senderPubKeyJwk, recipientPubKeyJwk) => {
  const enc = new TextEncoder();

  // 1. Generate ephemeral AES message key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable to encrypt with RSA
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt text with AES key
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    enc.encode(plaintext)
  );
  const ciphertext = arrayBufferToBase64(ciphertextBuffer);
  const ivBase64 = arrayBufferToBase64(iv);

  // 3. Export AES key as raw bytes to encrypt with RSA
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Import RSA public keys
  const importRsaPubKey = async (jwk) => {
    return window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSA-OAEP',
        hash: { name: 'SHA-256' },
      },
      true,
      ['encrypt']
    );
  };

  const senderRsaKey = await importRsaPubKey(senderPubKeyJwk);
  const recipientRsaKey = await importRsaPubKey(recipientPubKeyJwk);

  // 5. Encrypt AES key using RSA keys
  const encryptedKeyForSenderBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderRsaKey,
    exportedAesKey
  );
  const encryptedKeyForRecipientBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientRsaKey,
    exportedAesKey
  );

  return {
    ciphertext,
    iv: ivBase64,
    encryptedKeySender: arrayBufferToBase64(encryptedKeyForSenderBuffer),
    encryptedKeyRecipient: arrayBufferToBase64(encryptedKeyForRecipientBuffer),
  };
};

// Decrypt message: Decrypt AES key with RSA private key + Decrypt text with AES-GCM
export const decryptMessage = async (ciphertextBase64, ivBase64, encryptedAesKeyBase64, myPrivateKey) => {
  try {
    const encryptedAesKey = base64ToArrayBuffer(encryptedAesKeyBase64);
    const iv = base64ToArrayBuffer(ivBase64);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    // 1. Decrypt AES key using RSA Private key
    const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      myPrivateKey,
      encryptedAesKey
    );

    // 2. Import raw AES key back to CryptoKey
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      decryptedAesKeyRaw,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 3. Decrypt message using AES key
    const decryptedTextBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedTextBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Undecryptable Message - Key mismatch]';
  }
};
