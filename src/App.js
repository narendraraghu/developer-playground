import React, { useState, useEffect } from 'react';
import './App.css';
import { FaCog, FaPaperPlane, FaCode, FaExchangeAlt, FaUpload, FaList, FaKey, FaLock, FaShieldAlt, FaNetworkWired } from 'react-icons/fa';
import { motion } from 'framer-motion';

// Add new component for error display
const ErrorDisplay = ({ error, response }) => {
  if (!error && !response?.error) return null;

  const errorMapping = response?.errorMapping;
  if (!errorMapping) return null;

  return (
    <div className="error-container">
      <div className="error-header">
        <FaShieldAlt className="error-icon" />
        <h3>Error Details</h3>
      </div>
      <div className="error-content">
        <div className="error-description">
          <strong>Description:</strong> {errorMapping.description}
        </div>
        <div className="error-troubleshooting">
          <strong>Troubleshooting:</strong> {errorMapping.troubleshooting}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [settings, setSettings] = useState({
    // Credentials
    userId: '',
    password: '',
    keyId: '',
    // SSL Certificates
    sslServerCert: '',
    sslClientKey: '',
    // Message Level Encryption
    mleServerKey: '',
    mleClientKey: '',
    // Proxy Settings
    useProxy: false,
    proxyHost: '',
    proxyPort: '',
    proxyUsername: '',
    proxyPassword: ''
  });
  const [payload, setPayload] = useState('');
  const [response, setResponse] = useState(null);
  const [responseHeaders, setResponseHeaders] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://sandbox.api.visa.com/vdp/helloworld');
  const [method, setMethod] = useState('GET');
  const [mleAvailable, setMleAvailable] = useState(true);
  const [mleServerKeySuccess, setMleServerKeySuccess] = useState(false);
  const [mleClientKeySuccess, setMleClientKeySuccess] = useState(false);
  const [mleServerKeyFile, setMleServerKeyFile] = useState('');
  const [mleClientKeyFile, setMleClientKeyFile] = useState('');
  const [defaultPayload] = useState({
    "amount": 124.05,
    "senderAddress": "901 Metro Center Blvd",
    "localTransactionDateTime": "2025-05-27T12:00:00",
    "pointOfServiceData": {
      "panEntryMode": 90,
      "posConditionCode": "00",
      "motoECIIndicator": 0
    },
    "recipientPrimaryAccountNumber": "4060320000000127",
    "colombiaNationalServiceData": {
      "addValueTaxReturn": 10,
      "taxAmountConsumption": 10,
      "nationalNetReimbursementFeeBaseAmount": 20,
      "addValueTaxAmount": 10,
      "nationalNetMiscAmount": 10,
      "countryCodeNationalService": 170,
      "nationalChargebackReason": 11,
      "emvTransactionIndicator": "1",
      "nationalNetMiscAmountType": "A",
      "costTransactionIndicator": "0",
      "nationalReimbursementFee": 20
    },
    "cardAcceptor": {
      "address": {
        "country": "USA",
        "zipCode": "94404",
        "county": "San Mateo",
        "state": "CA"
      },
      "idCode": "CA-IDCode-77765",
      "name": "Visa Inc. USA-Foster City",
      "terminalId": "TID-9999"
    },
    "senderReference": "",
    "transactionIdentifier": 883916196354773,
    "acquirerCountryCode": 840,
    "acquiringBin": 408999,
    "retrievalReferenceNumber": "412770452025",
    "senderCity": "Foster City",
    "senderStateCode": "CA",
    "systemsTraceAuditNumber": 451018,
    "senderName": "Mohammed Qasim",
    "businessApplicationId": "AA",
    "settlementServiceIndicator": 9,
    "merchantCategoryCode": 6012,
    "transactionCurrencyCode": "USD",
    "recipientName": "rohan",
    "senderCountryCode": "124",
    "sourceOfFundsCode": "05",
    "senderAccountNumber": "4060320000000126"
  });
  const [postmanCollection, setPostmanCollection] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showCollection, setShowCollection] = useState(false);

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/visa/load-settings');
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
          setSettingsSaved(true);
        }
        if (data.mleAvailable !== undefined) {
          setMleAvailable(data.mleAvailable);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        switch (type) {
          case 'sslServerCert':
            setSettings(prev => ({ ...prev, sslServerCert: content }));
            break;
          case 'sslClientKey':
            setSettings(prev => ({ ...prev, sslClientKey: content }));
            break;
          case 'mleServerKey':
            setSettings(prev => ({ ...prev, mleServerKey: content }));
            setMleServerKeyFile(file.name);
            setMleServerKeySuccess(true);
            setTimeout(() => setMleServerKeySuccess(false), 3000);
            break;
          case 'mleClientKey':
            setSettings(prev => ({ ...prev, mleClientKey: content }));
            setMleClientKeyFile(file.name);
            setMleClientKeySuccess(true);
            setTimeout(() => setMleClientKeySuccess(false), 3000);
            break;
          default:
            break;
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveSettings = async () => {
    // Validate required fields
    const requiredFields = {
      sslServerCert: 'SSL Server Certificate',
      sslClientKey: 'SSL Client Key',
      userId: 'User ID',
      password: 'Password',
      keyId: 'Key ID'
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !settings[key])
      .map(([_, label]) => label);

    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/visa/save-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to save settings');
      }

      if (data.mleAvailable !== undefined) {
        setMleAvailable(data.mleAvailable);
      }

      setSettingsSaved(true);
      setError(null);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    if (newMethod === 'POST') {
      setApiUrl('https://sandbox.api.visa.com/visadirect/fundstransfer/v1/pushfundstransactions');
      setPayload(JSON.stringify(defaultPayload, null, 2));
    } else {
      setApiUrl('https://sandbox.api.visa.com/vdp/helloworld');
      setPayload('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResponse(null);
    setResponseHeaders(null);

    if (!settingsSaved) {
      setError('Please save settings first');
      return;
    }

    if (!apiUrl) {
      setError('Please provide an API URL');
      return;
    }

    if (method === 'POST' && !payload) {
      setError('Please provide a JSON payload for POST requests');
      return;
    }

    try {
      setLoading(true);
      let payloadObj;
      if (method === 'POST') {
        try {
          payloadObj = JSON.parse(payload);
        } catch (e) {
          throw new Error('Invalid JSON payload: ' + e.message);
        }
      }

      const response = await fetch('http://localhost:3001/api/visa/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: method === 'POST' ? payloadObj : null,
          apiUrl,
          method
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('=== Client Response Data ===');
        console.log('Full Response:', data);
        console.log('Response Status:', data.status);
        console.log('Response Data:', data.data);
        console.log('Decrypted Data:', data.decryptedData);
        console.log('Response Headers:', data.headers);
        console.log('========================');
      } else {
        const text = await response.text();
        console.error('Non-JSON Response:', text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
      }

      // Set response data based on status code
      if (response.ok) {
        // For successful responses (200), check if data is encrypted
        let decryptedData = null;
        if (data.data && data.data.encData) {
          try {
            // Send the encrypted data to the server for decryption
            const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                encryptedData: data.data.encData
              })
            });
            
            if (decryptResponse.ok) {
              const decryptData = await decryptResponse.json();
              decryptedData = decryptData.decryptedData;
              console.log('Decrypted Success Response:', decryptedData);
            }
          } catch (decryptError) {
            console.error('Failed to decrypt success response:', decryptError);
          }
        }

        // Set response with decrypted data if available
        setResponse({
          data: data.data,
          decryptedData: decryptedData,
          isEncrypted: !!data.data?.encData,
          status: data.status
        });
        setResponseHeaders(data.headers);
      } else {
        // For error responses, check for encrypted data
        let decryptedDetails = null;
        if (data.details && data.details.encData) {
          try {
            // Send the encrypted data to the server for decryption
            const decryptResponse = await fetch('http://localhost:3001/api/visa/decrypt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                encryptedData: data.details.encData
              })
            });
            
            if (decryptResponse.ok) {
              const decryptData = await decryptResponse.json();
              decryptedDetails = decryptData.decryptedData;
              console.log('Decrypted Error Details:', decryptedDetails);
            }
          } catch (decryptError) {
            console.error('Failed to decrypt details:', decryptError);
          }
        }

        // Set error response data
        setResponse({
          data: data.details,
          decryptedData: decryptedDetails,
          isEncrypted: !!data.details?.encData,
          status: data.status,
          error: data.error,
          errorCode: data.errorCode,
          errorMapping: data.errorMapping
        });
        setResponseHeaders(data.headers);

        // Set error message
        let errorMessage = '';
        if (decryptedDetails) {
          errorMessage = `Error: ${data.error}\nDetails: ${JSON.stringify(decryptedDetails, null, 2)}`;
        } else if (data.details) {
          errorMessage = `Error: ${data.error}\nDetails: ${JSON.stringify(data.details, null, 2)}`;
        } else {
          errorMessage = data.error || 'Request failed';
        }
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Request failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Add function to handle Postman collection upload
  const handlePostmanUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const collection = JSON.parse(e.target.result);
          setPostmanCollection(collection);
          setShowCollection(true);
        } catch (error) {
          setError('Invalid Postman collection file');
        }
      };
      reader.readAsText(file);
    }
  };

  // Add function to handle request selection
  const handleRequestSelect = (request) => {
    setSelectedRequest(request);
    setApiUrl(request.request.url.raw);
    setMethod(request.request.method);
    if (request.request.body && request.request.body.raw) {
      try {
        const body = JSON.parse(request.request.body.raw);
        setPayload(JSON.stringify(body, null, 2));
      } catch (error) {
        setPayload(request.request.body.raw);
      }
    } else {
      setPayload('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Visa Developer Sandbox Simulator</h1>
        <div className="header-buttons">
          <motion.button 
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaCog /> {showSettings ? 'Hide Settings' : 'Show Settings'}
          </motion.button>
          <motion.button 
            className="collection-toggle"
            onClick={() => setShowCollection(!showCollection)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaList /> {showCollection ? 'Hide Collection' : 'Show Collection'}
          </motion.button>
        </div>
      </header>

      <main className="App-main">
        {showSettings && (
          <motion.div 
            className="settings-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h2>Settings</h2>
            <div className="settings-form">
              {/* Credentials Section */}
              <div className="settings-section">
                <div className="section-header">
                  <FaKey /> Credentials
                </div>
                <div className="form-group">
                  <label>User ID:</label>
                  <input
                    type="text"
                    value={settings.userId}
                    onChange={(e) => setSettings(prev => ({ ...prev, userId: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password:</label>
                  <input
                    type="password"
                    value={settings.password}
                    onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* SSL Certificates Section */}
              <div className="settings-section">
                <div className="section-header">
                  <FaLock /> SSL Certificates
                </div>
                <div className="form-group">
                  <label>Visa SSL Server Certificate:</label>
                  <input
                    type="file"
                    accept=".pem,.cer,.crt"
                    onChange={(e) => handleFileChange(e, 'sslServerCert')}
                  />
                  {settings.sslServerCert && (
                    <div className="file-info success-message">✓ Server certificate loaded</div>
                  )}
                </div>
                <div className="form-group">
                  <label>Client SSL Private Key:</label>
                  <input
                    type="file"
                    accept=".pem,.key"
                    onChange={(e) => handleFileChange(e, 'sslClientKey')}
                  />
                  {settings.sslClientKey && (
                    <div className="file-info success-message">✓ Client key loaded</div>
                  )}
                </div>
              </div>

              {/* Message Level Encryption Section */}
              <div className="settings-section">
                <div className="section-header">
                  <FaShieldAlt /> Message Level Encryption {mleAvailable ? '' : '(Not Available)'}
                </div>
                {mleAvailable ? (
                  <>
                    <div className="form-group">
                      <label>Key ID:</label>
                      <input
                        type="text"
                        value={settings.keyId}
                        onChange={(e) => setSettings(prev => ({ ...prev, keyId: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Visa MLE Public Key</label>
                      <div className="file-input-container">
                        <input
                          type="file"
                          accept=".pem,.key"
                          onChange={(e) => handleFileChange(e, 'mleServerKey')}
                          className="file-input"
                        />
                        <span className="file-name">{mleServerKeyFile || 'Choose file'}</span>
                      </div>
                      {mleServerKeySuccess && (
                        <div className="success-message">MLE Public Key loaded successfully!</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Your MLE Private Key</label>
                      <div className="file-input-container">
                        <input
                          type="file"
                          accept=".pem,.key"
                          onChange={(e) => handleFileChange(e, 'mleClientKey')}
                          className="file-input"
                        />
                        <span className="file-name">{mleClientKeyFile || 'Choose file'}</span>
                      </div>
                      {mleClientKeySuccess && (
                        <div className="success-message">MLE Private Key loaded successfully!</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mle-disabled-message">
                    Message Level Encryption is not available. Please install the 'jose' package to enable MLE support.
                  </div>
                )}
              </div>

              {/* Proxy Settings Section */}
              <div className="settings-section">
                <div className="section-header">
                  <FaNetworkWired /> Proxy Settings
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.useProxy}
                      onChange={(e) => setSettings(prev => ({ ...prev, useProxy: e.target.checked }))}
                    />
                    Enable Proxy
                  </label>
                </div>
                {settings.useProxy && (
                  <>
                    <div className="form-group">
                      <label>Proxy Host:</label>
                      <input
                        type="text"
                        value={settings.proxyHost}
                        onChange={(e) => setSettings(prev => ({ ...prev, proxyHost: e.target.value }))}
                        placeholder="e.g., proxy.example.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Proxy Port:</label>
                      <input
                        type="text"
                        value={settings.proxyPort}
                        onChange={(e) => setSettings(prev => ({ ...prev, proxyPort: e.target.value }))}
                        placeholder="e.g., 8080"
                      />
                    </div>
                    <div className="form-group">
                      <label>Proxy Username (Optional):</label>
                      <input
                        type="text"
                        value={settings.proxyUsername}
                        onChange={(e) => setSettings(prev => ({ ...prev, proxyUsername: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Proxy Password (Optional):</label>
                      <input
                        type="password"
                        value={settings.proxyPassword}
                        onChange={(e) => setSettings(prev => ({ ...prev, proxyPassword: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="save-settings-button"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        )}

        <div className="main-container">
          {showCollection && (
            <div className="collection-panel">
              <div className="collection-header">
                <h3>Postman Collection</h3>
                <div className="upload-container">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handlePostmanUpload}
                    id="postman-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="postman-upload" className="upload-button">
                    <FaUpload /> Upload Collection
                  </label>
                </div>
              </div>
              {postmanCollection && (
                <div className="request-list">
                  {postmanCollection.item.map((item, index) => (
                    <div
                      key={index}
                      className={`request-item ${selectedRequest === item ? 'selected' : ''}`}
                      onClick={() => handleRequestSelect(item)}
                    >
                      <span className="method-badge" data-method={item.request.method}>
                        {item.request.method}
                      </span>
                      <span className="request-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="api-container">
            <form onSubmit={handleSubmit} className="api-form">
              <div className="request-bar">
                <div className="method-url-group">
                  <select 
                    value={method} 
                    onChange={(e) => handleMethodChange(e.target.value)}
                    className={`method-select is-${method.toLowerCase()}`}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    required
                    className="api-url-input"
                    placeholder="Enter request URL"
                  />
                </div>
                <motion.button 
                  type="submit" 
                  disabled={loading || !settingsSaved}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="send-button"
                >
                  {loading ? 'Sending...' : <><FaPaperPlane /> Send</>}
                </motion.button>
              </div>

              <div className="request-response-container">
                <div className="request-section">
                  <div className="section-header">
                    <FaCode /> Request
                  </div>
                  {method === 'POST' && (
                    <div className="form-group payload-group">
                      <textarea
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = (e.target.scrollHeight) + 'px';
                        }}
                        rows="1"
                        required
                        className="payload-textarea"
                        placeholder="Enter your JSON payload here..."
                      />
                    </div>
                  )}
                </div>

                <div className="response-section">
                  <div className="section-header">
                    <FaExchangeAlt /> Response
                    {response && (
                      <span className={`status-badge status-${response.status}`}>
                        {response.status} {response.status === 200 ? 'OK' : 'Error'}
                      </span>
                    )}
                  </div>
                  <div className="response-container">
                    {response && (
                      <div className="form-group payload-group">
                        <textarea
                          value={
                            response.decryptedData 
                              ? JSON.stringify(response.decryptedData, null, 2)
                              : response.data && response.data.encData
                                ? `Encrypted Response: ${JSON.stringify(response.data, null, 2)}`
                                : response.data
                                  ? JSON.stringify(response.data, null, 2)
                                  : 'No response data'
                          }
                          readOnly
                          className="payload-textarea"
                          style={{
                            minHeight: '200px',
                            backgroundColor: response.status >= 400 ? '#fff3f3' : '#f8f9fa',
                            fontFamily: 'monospace',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            padding: '12px',
                            borderRadius: '4px',
                            border: response.status >= 400 ? '1px solid #ffcdd2' : '1px solid #dee2e6',
                            color: response.status >= 400 ? '#d32f2f' : 'inherit'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Add ErrorDisplay component where errors are shown */}
                {error && <ErrorDisplay error={error} response={response} />}

                {responseHeaders && responseHeaders['x-correlation-id'] && (
                  <div className="correlation-id">
                    <strong>Correlation ID:</strong> {responseHeaders['x-correlation-id']}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 