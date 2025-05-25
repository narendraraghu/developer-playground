import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [settings, setSettings] = useState({
    // SSL Mutual Authentication
    sslServerCert: '', // Visa's SSL server certificate
    sslClientKey: '',  // Our SSL private key
    // Message Level Encryption
    mleServerKey: '',  // Visa's MLE public key
    mleClientKey: '',  // Our MLE private key
    // Credentials
    userId: '',
    password: '',
    keyId: ''
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
  const [sslServerCertFile, setSslServerCertFile] = useState('');
  const [sslClientKeyFile, setSslClientKeyFile] = useState('');

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
            setSslServerCertFile(file.name);
            break;
          case 'sslClientKey':
            setSettings(prev => ({ ...prev, sslClientKey: content }));
            setSslClientKeyFile(file.name);
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
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Request failed');
      }

      setResponse(data.response);
      setResponseHeaders(data.headers);
    } catch (error) {
      console.error('Request failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Visa API Tester</h1>
        <button 
          className="settings-toggle"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Hide Settings' : 'Show Settings'}
        </button>
      </header>
      <main className="App-main">
        {showSettings && (
          <div className="settings-panel">
            <h2>Settings</h2>
            <div className="settings-form">
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
              <div className="form-group">
                <label>Key ID:</label>
                <input
                  type="text"
                  value={settings.keyId}
                  onChange={(e) => setSettings(prev => ({ ...prev, keyId: e.target.value }))}
                  required
                />
              </div>
              <h3>SSL Mutual Authentication</h3>
              <div className="form-group">
                <label>Visa SSL Server Certificate:</label>
                <input
                  type="file"
                  accept=".pem,.cer,.crt"
                  onChange={(e) => handleFileChange(e, 'sslServerCert')}
                />
                {settings.sslServerCert && (
                  <div className="file-info">✓ Server certificate loaded</div>
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
                  <div className="file-info">✓ Client key loaded</div>
                )}
              </div>
              <h3>Message Level Encryption {mleAvailable ? '(Optional)' : '(Not Available)'}</h3>
              {mleAvailable ? (
                <>
                  <div className="form-group">
                    <label>Visa MLE Public Key (Optional)</label>
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
                    <label>Your MLE Private Key (Optional)</label>
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
              <button 
                onClick={handleSaveSettings}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="api-form">
          <div className="request-bar">
            <div className="method-url-group">
              <select 
                value={method} 
                onChange={(e) => setMethod(e.target.value)}
                className={`method-select is-${method.toLowerCase()}`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                {/* Add options for other methods if needed */}
                {/* <option value="PUT">PUT</option> */}
                {/* <option value="DELETE">DELETE</option> */}
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
            <button type="submit" disabled={loading || !settingsSaved}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
          {method === 'POST' && (
            <div className="form-group payload-group">
              <label>Payload (JSON):</label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                onInput={(e) => {
                  e.target.style.height = 'auto'; // Reset height
                  e.target.style.height = (e.target.scrollHeight) + 'px'; // Set to scroll height
                }}
                rows="1"
                required
                className="payload-textarea"
              />
            </div>
          )}
        </form>

        {error && (
          <div className="error-message">
            <h3>Error:</h3>
            <pre>{error}</pre>
          </div>
        )}

        {response && (
          <div className="response">
            <h3>Response:</h3>
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </div>
        )}

        {responseHeaders && responseHeaders['x-correlation-id'] && (
          <div className="correlation-id">
            <strong>Correlation ID:</strong> {responseHeaders['x-correlation-id']}
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 