const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { createPublicKey, createPrivateKey } = require('crypto');

// Try to load jose module, but don't fail if it's not available
let jose;
try {
  jose = require('jose');
} catch (error) {
  console.log('jose module not available - MLE will be disabled');
}

const app = express();

// Security middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase payload size limit for larger requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Constants
const CERT_DIR = path.join(__dirname, 'certificates');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Ensure certificates directory exists
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR);
}

// Helper function to validate key format
function validateKeyFormat(key, type) {
  console.log(`\nValidating ${type} format...`);
  console.log('Key content (first 100 chars):', key.substring(0, 100));
  console.log('Key length:', key.length);

  let isValid = false;
  let validStart = '';
  let validEnd = '';

  switch (type) {
    case 'sslServerCert':
      validStart = '-----BEGIN CERTIFICATE-----';
      validEnd = '-----END CERTIFICATE-----';
      break;
    case 'sslClientKey':
      validStart = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----'];
      validEnd = ['-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----', '-----END EC PRIVATE KEY-----'];
      break;
    case 'mleServerKey':
      validStart = ['-----BEGIN PUBLIC KEY-----', '-----BEGIN RSA PUBLIC KEY-----', '-----BEGIN CERTIFICATE-----'];
      validEnd = ['-----END PUBLIC KEY-----', '-----END RSA PUBLIC KEY-----', '-----END CERTIFICATE-----'];
      break;
    case 'mleClientKey':
      validStart = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----'];
      validEnd = ['-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----', '-----END EC PRIVATE KEY-----'];
      break;
  }

  if (Array.isArray(validStart)) {
    isValid = validStart.some(start => key.includes(start)) && 
              validEnd.some(end => key.includes(end));
  } else {
    isValid = key.includes(validStart) && key.includes(validEnd);
  }

  if (!isValid) {
    console.error(`Invalid ${type} format. Expected to find:`, validStart, 'and', validEnd);
    throw new Error(`Invalid ${type} format`);
  }

  console.log(`${type} format validation successful`);
  return true;
}

// Helper function to save settings
function saveSettings(settings) {
  // Validate required fields
  const requiredFields = [
    'sslServerCert', 'sslClientKey',
    'userId', 'password', 'keyId'
  ];

  for (const field of requiredFields) {
    if (!settings[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate certificate and key formats
  validateKeyFormat(settings.sslServerCert, 'sslServerCert');
  validateKeyFormat(settings.sslClientKey, 'sslClientKey');

  // Validate MLE keys if provided and jose is available
  if (jose) {
    if (settings.mleServerKey) {
      validateKeyFormat(settings.mleServerKey, 'mleServerKey');
    }
    if (settings.mleClientKey) {
      validateKeyFormat(settings.mleClientKey, 'mleClientKey');
    }
  }

  // Save settings to file
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Helper function to load settings
function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

// Helper function to create base64 credentials
function createBase64Credentials(userId, password) {
  console.log('Creating base64 credentials...');
  console.log('User ID:', userId);
  console.log('Password length:', password ? password.length : 0);
  const credentials = Buffer.from(`${userId}:${password}`).toString('base64');
  console.log('Base64 credentials length:', credentials.length);
  return credentials;
}

// Helper function to encrypt payload using MLE
async function encryptPayload(payload, mleServerKey, keyId) {
  if (!jose) {
    console.log('MLE not available: jose module not found');
    return payload;
  }

  if (!mleServerKey) {
    console.log('MLE not configured: MLE Server Key not provided');
    return payload;
  }

  if (!keyId) {
    console.log('MLE not configured: Key ID not provided');
    return payload;
  }

  console.log('\n=== Encryption Process Start ===');
  console.log('Input Payload:', payload);
  console.log('Input Payload Type:', typeof payload);
  console.log('Using Key ID:', keyId);
  
  try {
    // Handle certificate format
    let publicKey;
    if (mleServerKey.includes('-----BEGIN CERTIFICATE-----')) {
      console.log('Converting certificate to public key...');
      const cert = createPublicKey({
        key: mleServerKey,
        format: 'pem'
      });
      publicKey = cert;
    } else {
      publicKey = createPublicKey({
        key: mleServerKey,
        format: 'pem'
      });
    }

    console.log('\nPublic key created successfully');
    
    // Ensure payload is a string
    const payloadToEncrypt = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    console.log('\nPayload after stringification:');
    console.log('Type:', typeof payloadToEncrypt);
    console.log('Content:', payloadToEncrypt);
    
    // Create JWE with explicit kid matching keyId and iat timestamp
    console.log('\nCreating JWE token...');
    const jwe = await new jose.CompactEncrypt(
      new TextEncoder().encode(payloadToEncrypt)
    )
      .setProtectedHeader({ 
        alg: 'RSA-OAEP-256',  // Key encryption algorithm
        enc: 'A128GCM',       // Content encryption algorithm (changed to match Java)
        kid: keyId,           // Key ID
        iat: Date.now()       // Issued at timestamp in milliseconds
      })
      .encrypt(publicKey);

    // Wrap the JWE in an encData object to match Java implementation
    const wrappedJwe = {
      encData: jwe
    };

    console.log('\nFinal Encrypted Payload:');
    console.log(JSON.stringify(wrappedJwe));
    console.log('=== Encryption Process End ===\n');
    
    return JSON.stringify(wrappedJwe);
  } catch (error) {
    console.error('\nEncryption failed:', error);
    throw error;
  }
}

// Helper function to decrypt response using MLE
async function decryptResponse(encryptedResponse, mleClientKey) {
  if (!jose || !mleClientKey) {
    console.log('MLE not configured, returning response without decryption');
    return encryptedResponse;
  }

  console.log('Decrypting response...');
  
  try {
    // Extract the JWE from the encData field
    const jwe = encryptedResponse.encData || encryptedResponse;
    
    const privateKey = createPrivateKey({
      key: mleClientKey,
      format: 'pem'
    });

    const { payload } = await jose.jwtDecrypt(jwe, privateKey);
    console.log('Response decrypted successfully');
    return payload;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}

// Endpoint to load settings
app.get('/api/visa/load-settings', (req, res) => {
  try {
    const settings = loadSettings();
    res.json({ 
      settings, 
      settingsSaved: !!settings,
      mleAvailable: !!jose 
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Endpoint to save settings
app.post('/api/visa/save-settings', (req, res) => {
  try {
    const settings = req.body;
    saveSettings(settings);
    res.json({ 
      message: 'Settings saved successfully',
      mleAvailable: !!jose
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint to make Visa API request
app.post('/api/visa/transaction', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings) {
      return res.status(400).json({ error: 'Settings not found. Please save settings first.' });
    }

    const { payload, apiUrl, method = 'GET' } = req.body;
    if (!apiUrl) {
      return res.status(400).json({ error: 'API URL is required' });
    }

    if (method === 'POST' && !payload) {
      return res.status(400).json({ error: 'Payload is required for POST requests' });
    }

    console.log('\n=== Visa API Request Start ===');
    console.log('Method:', method);
    console.log('API URL:', apiUrl);
    console.log('Key ID:', settings.keyId);
    console.log('User ID:', settings.userId);
    console.log('Password length:', settings.password ? settings.password.length : 0);

    // Create base64 credentials
    const credentials = createBase64Credentials(settings.userId, settings.password);

    // Encrypt payload using MLE if it's a POST request
    console.log('\nOriginal Payload:');
    console.log(JSON.stringify(payload, null, 2));
    
    let requestData;
    if (method === 'POST') {
      console.log('\nEncrypting payload...');
      const encryptedPayload = await encryptPayload(payload, settings.mleServerKey, settings.keyId);
      console.log('\nEncrypted Payload:');
      console.log(encryptedPayload);
      requestData = encryptedPayload;
    }

    // Configure HTTPS agent for SSL mutual authentication
    console.log('\nMLE Configuration:');
    console.log('MLE Server Key present:', !!settings.mleServerKey);
    console.log('MLE Client Key present:', !!settings.mleClientKey);
    console.log('jose module available:', !!jose);

    const httpsAgent = new https.Agent({
      cert: settings.sslServerCert,
      key: settings.sslClientKey,
      rejectUnauthorized: true
    });

    try {
      // Make request to Visa API
      console.log('\nSending request to Visa API...');
      const requestHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'Visa API Client',
        'Host': new URL(apiUrl).host,
        'keyId': settings.keyId
      };
      console.log('Request Headers:', requestHeaders);
      console.log('Request Data:', requestData);

      const response = await axios({
        method: method.toLowerCase(),
        url: apiUrl,
        headers: requestHeaders,
        data: requestData,
        httpsAgent
      });

      console.log('\nVisa API response received:');
      console.log('Status:', response.status);
      console.log('Response Headers:', response.headers);
      console.log('Response Data:', response.data);
      console.log('=== Visa API Request End ===\n');

      // Decrypt response if it's encrypted
      let decryptedResponse = response.data;
      if (typeof response.data === 'string' && response.data.includes('eyJ')) {
        console.log('\nDetected encrypted response, attempting decryption...');
        decryptedResponse = await decryptResponse(response.data, settings.mleClientKey);
        console.log('Decrypted Response:', decryptedResponse);
      }

      res.json({
        response: decryptedResponse,
        headers: response.headers
      });
    } catch (axiosError) {
      console.error('\nVisa API request failed:');
      console.error('Error details:', {
        message: axiosError.message,
        code: axiosError.code,
        response: axiosError.response ? {
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers
        } : 'No response'
      });
      
      if (axiosError.response) {
        return res.status(axiosError.response.status).json({
          error: 'Visa API request failed',
          details: axiosError.response.data,
          status: axiosError.response.status
        });
      } else if (axiosError.request) {
        return res.status(500).json({
          error: 'No response received from Visa API',
          details: axiosError.message
        });
      } else {
        return res.status(500).json({
          error: 'Error setting up Visa API request',
          details: axiosError.message
        });
      }
    }
  } catch (error) {
    console.error('\nError in transaction endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    details: err.stack
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`MLE support: ${jose ? 'enabled' : 'disabled'}`);
}); 