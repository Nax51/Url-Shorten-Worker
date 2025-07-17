// Application constants
const CONSTANTS = {
  // Security
  MAX_CUSTOM_KEY_LENGTH: 20,
  JWT_EXPIRY_SECONDS: 86400, // 24 hours
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // KV TTL
  KV_TTL_SECONDS: 31536000, // 1 year
  
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    SERVER_ERROR: 500
  },
  
  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  
  // Validation
  URL_REGEX: /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w\- .\/?%&=]*)?$/,
  CUSTOM_KEY_REGEX: /^[a-zA-Z0-9_-]+$/
};

// Application configuration
const config = {
  no_ref: "off", // Control the HTTP referrer header
  theme: "", // Homepage theme
  cors: "on", // Allow Cross-origin resource sharing for API requests
  unique_link: true, // If true, the same long url will be shortened into the same short url
  custom_link: true, // Allow users to customize the short url
  safe_browsing_api_key: "" // Google Safe Browsing API Key
};

// Rate limiting storage
const rateLimitMap = new Map();

const html404 = `<!DOCTYPE html>
<body>
  <h1>404 Not Found.</h1>
  <p>The url you visit is not found.</p>
  <a href="https://github.com/xyTom/Url-Shorten-Worker/" target="_self">Fork me on GitHub</a>
</body>`;

const loginPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortener Service - Admin Login</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .login-container { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .login-container h1 { text-align: center; color: #333; margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
    input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; font-size: 16px; }
    button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: red; margin-top: 10px; display: none; }
    .success { color: green; margin-top: 10px; display: none; }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Admin Login</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit">Login</button>
      <div id="message" class="error"></div>
    </form>
  </div>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const messageDiv = document.getElementById('message');
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
          messageDiv.className = 'success';
          messageDiv.textContent = 'Login successful!';
          messageDiv.style.display = 'block';
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = result.message || 'Login failed';
          messageDiv.style.display = 'block';
        }
      } catch (error) {
        messageDiv.className = 'error';
        messageDiv.textContent = 'Login error occurred';
        messageDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

let response_header = {
  "content-type": "text/html;charset=UTF-8",
};

if (config.cors == "on") {
  response_header = {
    "content-type": "text/html;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
  };
}

// Security and utility functions
async function randomString(len) {
  len = len || 6;
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'; // Excluded confusing characters: oOLl,9gq,Vv,Uu,I1
  const maxPos = chars.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

// Rate limiting function
function checkRateLimit(clientIP) {
  const now = Date.now();
  const windowStart = now - CONSTANTS.RATE_LIMIT_WINDOW;
  
  // Clean old entries
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
  
  // Check current IP
  const requests = rateLimitMap.get(clientIP) || [];
  const recentRequests = requests.filter(ts => ts > windowStart);
  
  if (recentRequests.length >= CONSTANTS.RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(clientIP, recentRequests);
  return true;
}

// CSRF token generation and validation
function generateCSRFToken() {
  return crypto.randomUUID();
}

function validateCSRFToken(token, sessionToken) {
  return token && sessionToken && token === sessionToken;
}

// Enhanced input validation
function validateURL(url) {
  if (!url || typeof url !== 'string') return false;
  return CONSTANTS.URL_REGEX.test(url);
}

function validateCustomKey(key) {
  if (!key) return true; // Optional field
  if (typeof key !== 'string') return false;
  if (key.length > CONSTANTS.MAX_CUSTOM_KEY_LENGTH) return false;
  return CONSTANTS.CUSTOM_KEY_REGEX.test(key);
}

// Get client IP address
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') || 
         'unknown';
}

// Legacy URL validation function - kept for backward compatibility
async function checkURL(URL) {
  return validateURL(URL);
}

async function sha512(url) {
  url = new TextEncoder().encode(url);

  const url_digest = await crypto.subtle.digest(
    {
      name: "SHA-512",
    },
    url, // The data you want to hash as an ArrayBuffer
  );
  const hashArray = Array.from(new Uint8Array(url_digest)); // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Enhanced URL saving function with TTL support
async function save_url(URL, customKey = null, env = null) {
  if (!env) {
    console.error('save_url: env parameter is null');
    return null;
  }
  
  const shortKey = customKey || await randomString();
  
  try {
    const existingUrl = await env.LINKS.get(shortKey);
    
    if (existingUrl == null) {
      // Save URL and metadata with TTL
      const linkData = {
        url: URL,
        created: new Date().toISOString(),
        short: shortKey
      };
      
      // Set TTL for automatic deletion after 1 year
      const ttlOptions = { expirationTtl: CONSTANTS.KV_TTL_SECONDS };
      
      await env.LINKS.put(shortKey, URL, ttlOptions);
      await env.LINKS.put('meta_' + shortKey, JSON.stringify(linkData), ttlOptions);
      console.log('Short URL created successfully:', shortKey);
      
      return shortKey;
    } else {
      if (customKey) {
        // If custom key already exists, return error
        return null;
      }
      // If random key exists, regenerate
      return await save_url(URL, null, env);
    }
  } catch (error) {
    console.error('save_url error:', error);
    return null;
  }
}

// Check if URL hash exists
async function is_url_exist(urlSha512, env) {
  const existingKey = await env.LINKS.get(urlSha512);
  return existingKey || false;
}

async function is_url_safe(url) {
  let raw = JSON.stringify({"client":{"clientId":"Url-Shorten-Worker","clientVersion":"1.0.7"},"threatInfo":{"threatTypes":["MALWARE","SOCIAL_ENGINEERING","POTENTIALLY_HARMFUL_APPLICATION","UNWANTED_SOFTWARE"],"platformTypes":["ANY_PLATFORM"],"threatEntryTypes":["URL"],"threatEntries":[{"url":url}]}});

  let requestOptions = {
    method: 'POST',
    body: raw,
    redirect: 'follow'
  };

  result = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key="+config.safe_browsing_api_key, requestOptions);
  result = await result.json();
  console.log(result);
  if (Object.keys(result).length === 0) {
    return true;
  } else {
    return false;
  }
}

// JWT utility functions
const CryptoJS = {
  HmacSHA256: function(message, key) {
    const keyData = new TextEncoder().encode(key);
    const messageData = new TextEncoder().encode(message);
    
    return Promise.resolve().then(() => {
      return crypto.subtle.importKey(
        "raw", 
        keyData,
        { name: "HMAC", hash: {name: "SHA-256"} },
        false,
        ["sign"]
      );
    }).then(cryptoKey => {
      return crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageData
      );
    }).then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  }
};

async function generateJWT(username, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { username, iat: Math.floor(Date.now() / 1000) };
  
  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(payload));
  
  const signatureInput = headerBase64 + '.' + payloadBase64;
  const signature = await CryptoJS.HmacSHA256(signatureInput, secret);
  
  return headerBase64 + '.' + payloadBase64 + '.' + signature;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerBase64, payloadBase64, signature] = parts;
    const signatureInput = headerBase64 + '.' + payloadBase64;
    const expectedSignature = await CryptoJS.HmacSHA256(signatureInput, secret);
    
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(atob(payloadBase64));
    return payload;
  } catch (error) {
    return null;
  }
}

function getCookieValue(cookieString, key) {
  if (!cookieString) return null;
  
  const match = cookieString.match(new RegExp('(^| )' + key + '=([^;]+)'));
  return match ? match[2] : null;
}

// Authentication handling functions
async function handleAuthenticationCheck(request, env) {
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const jwtSecret = env.JWT_SECRET || 'your-default-secret-key';
  return token ? await verifyJWT(token, jwtSecret) : null;
}

// Handle POST requests for URL shortening
async function handleShortenRequest(request, env, user) {
  const clientIP = getClientIP(request);
  
  // Rate limiting check
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.TOO_MANY_REQUESTS,
      error: "Rate limit exceeded. Please try again later."
    }), {
      status: CONSTANTS.HTTP_STATUS.TOO_MANY_REQUESTS,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Check API Key authentication
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  const validApiKey = env.API_KEY;
  const isApiKeyValid = apiKey && validApiKey && apiKey === validApiKey;
  
  if (!user && !isApiKeyValid) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
      error: "Unauthorized. Please login first or provide valid API key."
    }), {
      status: CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  let requestData;
  try {
    requestData = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      error: "Invalid JSON format"
    }), {
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Enhanced input validation
  if (!validateURL(requestData.url)) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      error: "Invalid URL format"
    }), {
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  const customKey = requestData.custom ? requestData.custom.trim() : null;
  
  if (!validateCustomKey(customKey)) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      error: `Custom key can only contain letters, numbers, underscores and hyphens, max ${CONSTANTS.MAX_CUSTOM_KEY_LENGTH} characters`
    }), {
      status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  let shortKey;
  
  if (config.unique_link) {
    const urlHash = await sha512(requestData.url);
    const existingKey = await is_url_exist(urlHash, env);
    if (existingKey) {
      shortKey = existingKey;
    } else {
      shortKey = await save_url(requestData.url, customKey, env);
      if (shortKey) {
        await env.LINKS.put(urlHash, shortKey, { expirationTtl: CONSTANTS.KV_TTL_SECONDS });
      }
    }
  } else {
    shortKey = await save_url(requestData.url, customKey, env);
  }
  
  if (shortKey) {
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.OK,
      key: "/" + shortKey
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } else {
    const errorMsg = customKey ? "Custom short URL already exists, please choose another name" : "Failed to generate short URL, please try again later";
    return new Response(JSON.stringify({
      status: CONSTANTS.HTTP_STATUS.SERVER_ERROR,
      error: errorMsg
    }), {
      status: CONSTANTS.HTTP_STATUS.SERVER_ERROR,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Handle URL redirection
async function handleRedirection(env, shortPath, queryParams) {
  const targetUrl = await env.LINKS.get(shortPath);
  
  if (!targetUrl) {
    return new Response(html404, {
      headers: { "content-type": "text/html;charset=UTF-8" },
      status: CONSTANTS.HTTP_STATUS.NOT_FOUND
    });
  }
  
  const finalUrl = queryParams ? targetUrl + queryParams : targetUrl;
  
  // Safety check if configured
  if (config.safe_browsing_api_key) {
    if (!(await is_url_safe(finalUrl))) {
      let warningPage = await fetch("https://xytom.github.io/Url-Shorten-Worker/safe-browsing.html");
      warningPage = await warningPage.text();
      warningPage = warningPage.replace(/{Replace}/gm, finalUrl);
      return new Response(warningPage, {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }
  }
  
  // Handle no-referrer option
  if (config.no_ref === "on") {
    let noRefPage = await fetch("https://xytom.github.io/Url-Shorten-Worker/no-ref.html");
    noRefPage = await noRefPage.text();
    noRefPage = noRefPage.replace(/{Replace}/gm, finalUrl);
    return new Response(noRefPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  return Response.redirect(finalUrl, 302);
}

// Generate main page HTML
function generateMainPage(user) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortener Service</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; color: #333; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    /* Responsive design */
    @media (max-width: 768px) {
      .container { max-width: 100%; padding: 10px; }
    }
    .header { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .logout-btn { background: #dc3545; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px; font-size: 14px; }
    .shorten-section { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
    .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
    .form-group input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 5px rgba(0,123,255,0.3); }
    .shorten-btn { background: #007bff; color: white; border: none; padding: 12px 30px; border-radius: 5px; font-size: 16px; cursor: pointer; width: 100%; }
    .shorten-btn:hover { background: #0056b3; }
    .result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
    .result.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
    .result.error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
    .short-url { font-weight: bold; word-break: break-all; margin-top: 10px; }
    .short-url a { color: #007bff; text-decoration: none; }
    .short-url a:hover { text-decoration: underline; }
    .links-section { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
    .refresh-btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 14px; }
    .refresh-btn:hover { background: #218838; }
    .links-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .links-table th, .links-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .links-table th { background: #f8f9fa; font-weight: 600; color: #495057; }
    .link-short { color: #007bff; text-decoration: none; font-weight: 500; }
    .link-short:hover { text-decoration: underline; }
    .link-long { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .delete-btn { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
    .delete-btn:hover { background: #c82333; }
    .copy-btn { background: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-right: 5px; }
    .copy-btn:hover { background: #138496; }
    .copy-btn.copied { background: #28a745; }
    .action-buttons { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
    
    /* Desktop table layout */
    .links-table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; }
    .links-table th, .links-table td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #ddd; word-wrap: break-word; }
    .links-table th:nth-child(1), .links-table td:nth-child(1) { width: 15%; } /* Short URL */
    .links-table th:nth-child(2), .links-table td:nth-child(2) { width: 45%; } /* Original URL */
    .links-table th:nth-child(3), .links-table td:nth-child(3) { width: 20%; } /* Created */
    .links-table th:nth-child(4), .links-table td:nth-child(4) { width: 20%; } /* Actions */
    
    /* Mobile responsive layout */
    @media (max-width: 768px) {
      .header { flex-direction: column; gap: 15px; text-align: center; }
      .header h1 { font-size: 1.5rem; }
      .shorten-section { padding: 20px; }
      
      /* Hide desktop table on mobile */
      .links-table { display: none; }
      
      /* Mobile card layout */
      .mobile-links { display: block; }
      .link-card { 
        background: white; 
        border: 1px solid #e0e0e0; 
        border-radius: 8px; 
        margin-bottom: 15px; 
        padding: 15px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      }
      .link-card-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start; 
        margin-bottom: 10px; 
        flex-wrap: wrap;
        gap: 10px;
      }
      .link-card-short { 
        font-weight: bold; 
        color: #007bff; 
        text-decoration: none; 
        word-break: break-all;
        flex: 1;
        min-width: 0;
      }
      .link-card-short:hover { text-decoration: underline; }
      .link-card-url { 
        color: #666; 
        margin-bottom: 8px; 
        word-break: break-all; 
        font-size: 14px; 
        line-height: 1.4;
      }
      .link-card-date { 
        color: #888; 
        font-size: 12px; 
        margin-bottom: 10px; 
      }
      .link-card-actions { 
        display: flex; 
        gap: 8px; 
        justify-content: flex-start;
        flex-wrap: wrap;
      }
      .link-card-actions .copy-btn,
      .link-card-actions .delete-btn {
        padding: 8px 16px;
        font-size: 14px;
        margin-right: 0;
      }
    }
    
    /* Desktop only - hide mobile layout */
    @media (min-width: 769px) {
      .mobile-links { display: none; }
    }
    .loading, .no-data { text-align: center; padding: 40px; color: #666; }
    .optional-text { font-size: 14px; color: #666; margin-top: 5px; }
    .pagination { display: flex; justify-content: center; align-items: center; margin-top: 20px; gap: 10px; }
    .pagination button { padding: 8px 12px; border: 1px solid #ddd; background: white; cursor: pointer; border-radius: 4px; }
    .pagination button:hover { background: #f8f9fa; }
    .pagination button.active { background: #007bff; color: white; border-color: #007bff; }
    .pagination button:disabled { cursor: not-allowed; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔗 URL Shortener Service</h1>
      <div>
        <span style="margin-right: 15px;">Welcome, ${user.username}</span>
        <a href="/api/logout" class="logout-btn">Logout</a>
      </div>
    </div>
    
    <div class="shorten-section">
      <h2 style="margin-bottom: 20px;">Create Short URL</h2>
      <form id="shortenForm">
        <div class="form-group">
          <label for="longUrl">Original URL *</label>
          <input type="url" id="longUrl" placeholder="https://example.com" required>
        </div>
        <div class="form-group">
          <label for="customKey">Custom Short URL (Optional)</label>
          <input type="text" id="customKey" placeholder="my-link" maxlength="${CONSTANTS.MAX_CUSTOM_KEY_LENGTH}">
          <div class="optional-text">Only letters, numbers, underscores and hyphens allowed. Leave empty for auto-generation.</div>
        </div>
        <button type="submit" class="shorten-btn">Generate Short URL</button>
      </form>
      <div id="result" class="result"></div>
    </div>
    
    <div class="links-section">
      <div class="section-header">
        <h2>My Short URLs</h2>
        <button onclick="loadLinks(1)" class="refresh-btn">🔄 Refresh</button>
      </div>
      <div id="linksContainer">
        <div class="loading">Loading...</div>
      </div>
      <div id="mobileLinksContainer" class="mobile-links">
        <div class="loading">Loading...</div>
      </div>
      <div id="paginationContainer"></div>
    </div>
  </div>

  <script>
    let currentPage = 1;
    let totalPages = 1;
    
    // Generate short URL
    document.getElementById('shortenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const longUrl = document.getElementById('longUrl').value;
      const customKey = document.getElementById('customKey').value.trim();
      const resultDiv = document.getElementById('result');
      const submitBtn = e.target.querySelector('button[type="submit"]');
      
      submitBtn.textContent = 'Generating...';
      submitBtn.disabled = true;
      
      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: longUrl, custom: customKey || null })
        });
        
        const result = await response.json();
        
        if (result.status === ${CONSTANTS.HTTP_STATUS.OK}) {
          const shortUrl = window.location.origin + result.key;
          resultDiv.className = 'result success';
          resultDiv.innerHTML = \`Short URL created successfully!<br><div class="short-url"><a href="\${shortUrl}" target="_blank">\${shortUrl}</a></div>\`;
          resultDiv.style.display = 'block';
          document.getElementById('longUrl').value = '';
          document.getElementById('customKey').value = '';
          loadLinks(1);
        } else {
          resultDiv.className = 'result error';
          resultDiv.textContent = result.error || 'Creation failed, please try again';
          resultDiv.style.display = 'block';
        }
      } catch (error) {
        console.error('Create short URL failed:', error);
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Creation failed, please check network connection';
        resultDiv.style.display = 'block';
      } finally {
        submitBtn.textContent = 'Generate Short URL';
        submitBtn.disabled = false;
      }
    });
    
    // Load links with pagination
    async function loadLinks(page = 1) {
      try {
        currentPage = page;
        document.getElementById('linksContainer').innerHTML = '<div class="loading">Loading...</div>';
        document.getElementById('mobileLinksContainer').innerHTML = '<div class="loading">Loading...</div>';
        
        const response = await fetch(\`/api/admin/links?page=\${page}&limit=10\`);
        const data = await response.json();
        
        if (data.success) {
          totalPages = data.pagination.totalPages;
          displayLinks(data.links);
          displayMobileLinks(data.links);
          displayPagination(data.pagination);
        } else {
          document.getElementById('linksContainer').innerHTML = '<div class="no-data">Load failed: ' + (data.message || 'Unknown error') + '</div>';
          document.getElementById('mobileLinksContainer').innerHTML = '<div class="no-data">Load failed: ' + (data.message || 'Unknown error') + '</div>';
        }
      } catch (error) {
        console.error('Load short URLs failed:', error);
        document.getElementById('linksContainer').innerHTML = '<div class="no-data">Load failed, please check network connection</div>';
        document.getElementById('mobileLinksContainer').innerHTML = '<div class="no-data">Load failed, please check network connection</div>';
      }
    }
    
    function displayLinks(links) {
      if (links.length === 0) {
        document.getElementById('linksContainer').innerHTML = '<div class="no-data">No short URL data</div>';
        return;
      }
      
      let html = '<table class="links-table"><thead><tr><th>Short URL</th><th>Original URL</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
      
      links.forEach(link => {
        const createdDate = link.created ? new Date(link.created).toLocaleString() : 'Unknown';
        const shortUrl = window.location.origin + '/' + link.short;
        
        html += \`<tr>
          <td><a href="\${shortUrl}" target="_blank" class="link-short">/\${link.short}</a></td>
          <td><div class="link-long" title="\${link.url}">\${link.url}</div></td>
          <td>\${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button onclick="copyToClipboard('\${shortUrl}', this)" class="copy-btn">Copy</button>
              <button onclick="deleteLink('\${link.short}')" class="delete-btn">Delete</button>
            </div>
          </td>
        </tr>\`;
      });
      
      html += '</tbody></table>';
      document.getElementById('linksContainer').innerHTML = html;
    }
    
    function displayMobileLinks(links) {
      if (links.length === 0) {
        document.getElementById('mobileLinksContainer').innerHTML = '<div class="no-data">No short URL data</div>';
        return;
      }
      
      let html = '';
      
      links.forEach(link => {
        const createdDate = link.created ? new Date(link.created).toLocaleString() : 'Unknown';
        const shortUrl = window.location.origin + '/' + link.short;
        
        html += \`
          <div class="link-card">
            <div class="link-card-header">
              <a href="\${shortUrl}" target="_blank" class="link-card-short">/\${link.short}</a>
            </div>
            <div class="link-card-url">\${link.url}</div>
            <div class="link-card-date">Created: \${createdDate}</div>
            <div class="link-card-actions">
              <button onclick="copyToClipboard('\${shortUrl}', this)" class="copy-btn">Copy</button>
              <button onclick="deleteLink('\${link.short}')" class="delete-btn">Delete</button>
            </div>
          </div>
        \`;
      });
      
      document.getElementById('mobileLinksContainer').innerHTML = html;
    }
    
    function displayPagination(pagination) {
      if (pagination.totalPages <= 1) {
        document.getElementById('paginationContainer').innerHTML = '';
        return;
      }
      
      let html = '<div class="pagination">';
      
      // Previous button
      html += \`<button onclick="loadLinks(\${pagination.currentPage - 1})" \${pagination.currentPage === 1 ? 'disabled' : ''}>Previous</button>\`;
      
      // Page numbers
      const startPage = Math.max(1, pagination.currentPage - 2);
      const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
      
      if (startPage > 1) {
        html += '<button onclick="loadLinks(1)">1</button>';
        if (startPage > 2) html += '<span>...</span>';
      }
      
      for (let i = startPage; i <= endPage; i++) {
        html += \`<button onclick="loadLinks(\${i})" \${i === pagination.currentPage ? 'class="active"' : ''}>\${i}</button>\`;
      }
      
      if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) html += '<span>...</span>';
        html += \`<button onclick="loadLinks(\${pagination.totalPages})">\${pagination.totalPages}</button>\`;
      }
      
      // Next button
      html += \`<button onclick="loadLinks(\${pagination.currentPage + 1})" \${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}>Next</button>\`;
      
      html += '</div>';
      document.getElementById('paginationContainer').innerHTML = html;
    }
    
    // Copy to clipboard function
    async function copyToClipboard(text, button) {
      try {
        await navigator.clipboard.writeText(text);
        
        // Change button appearance temporarily
        const originalText = button.textContent;
        const originalClass = button.className;
        
        button.textContent = 'Copied!';
        button.className = 'copy-btn copied';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          button.textContent = originalText;
          button.className = originalClass;
        }, 2000);
        
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          
          // Change button appearance temporarily
          const originalText = button.textContent;
          const originalClass = button.className;
          
          button.textContent = 'Copied!';
          button.className = 'copy-btn copied';
          
          // Reset button after 2 seconds
          setTimeout(() => {
            button.textContent = originalText;
            button.className = originalClass;
          }, 2000);
          
        } catch (err) {
          console.error('Copy failed:', err);
          alert('Copy failed. Please copy manually: ' + text);
        }
        
        document.body.removeChild(textArea);
      }
    }
    
    // Delete link function
    async function deleteLink(shortCode) {
      if (!confirm('Are you sure you want to delete short URL /' + shortCode + '? This action cannot be undone.')) {
        return;
      }
      
      try {
        const response = await fetch('/api/admin/links/' + shortCode, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
          alert('Delete successful!');
          loadLinks(currentPage);
        } else {
          alert('Delete failed: ' + (result.message || 'Unknown error'));
        }
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Delete failed, please try again later');
      }
    }
    
    // Load data when page loads
    window.addEventListener('load', () => loadLinks(1));
  </script>
</body>
</html>`;
}

// Main request handler (refactored)
async function handleRequest(request, env) {
  const requestURL = new URL(request.url);
  const path = requestURL.pathname;
  
  // Handle API requests
  if (path.startsWith('/api/')) {
    return await handleAPIRequest(request, env);
  }
  
  // Check user authentication
  const user = await handleAuthenticationCheck(request, env);
  
  // Handle login page routing
  if (path === '/' && !user) {
    return new Response(loginPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  if (path === '/login') {
    if (user) {
      return new Response('', {
        status: 302,
        headers: { 'Location': '/' }
      });
    }
    return new Response(loginPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  // Handle POST requests for URL shortening
  if (request.method === "POST") {
    return await handleShortenRequest(request, env, user);
  }
  
  // Handle OPTIONS requests
  if (request.method === "OPTIONS") {
    return new Response('', {
      headers: response_header
    });
  }
  
  const shortPath = requestURL.pathname.split("/")[1];
  const queryParams = requestURL.search;
  
  // Show main page for authenticated users
  if (!shortPath && user) {
    return new Response(generateMainPage(user), {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  // Handle URL redirection
  if (shortPath) {
    return await handleRedirection(env, shortPath, queryParams);
  }
  
  // Default 404 response
  return new Response(html404, {
    headers: { "content-type": "text/html;charset=UTF-8" },
    status: CONSTANTS.HTTP_STATUS.NOT_FOUND
  });
}

// API request handler (refactored)
async function handleAPIRequest(request, env) {
  const requestURL = new URL(request.url);
  const path = requestURL.pathname.slice(4); // Remove '/api'
  
  // Read configuration from environment variables
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  const adminPassword = env.ADMIN_PASSWORD || 'password';
  const jwtSecret = env.JWT_SECRET || 'your-default-secret-key';
  
  // Handle login request
  if (path === '/login' && request.method === 'POST') {
    const body = await request.json();
    
    if (body.username === adminUsername && body.password === adminPassword) {
      const token = await generateJWT(body.username, jwtSecret);
      
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${CONSTANTS.JWT_EXPIRY_SECONDS}`
          }
        }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid username or password' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // Handle logout request
  if (path === '/logout' && (request.method === 'GET' || request.method === 'POST')) {
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
      }
    });
  }
  
  // API endpoint for external tools - requires API Key only
  if (path === '/shorten' && request.method === 'POST') {
    return await handleShortenAPI(request, env);
  }
  
  // Other API requests require login authentication
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const user = token ? await verifyJWT(token, jwtSecret) : null;
  
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, message: 'Unauthorized access' }),
      { status: CONSTANTS.HTTP_STATUS.UNAUTHORIZED, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Admin backend API
  if (path === '/admin/links' && request.method === 'GET') {
    return await getLinksForAdmin(env, requestURL);
  }
  
  if (path.startsWith('/admin/links/') && request.method === 'DELETE') {
    const shortCode = path.split('/')[3];
    return await deleteLinkForAdmin(shortCode, env);
  }
  
  // Default 404 for unknown API endpoints
  return new Response(
    JSON.stringify({ success: false, message: 'Requested resource not found' }),
    { status: CONSTANTS.HTTP_STATUS.NOT_FOUND, headers: { 'Content-Type': 'application/json' } }
  );
}

// Admin backend API functions with pagination support
async function getLinksForAdmin(env, requestURL) {
  try {
    const url = new URL(requestURL);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || CONSTANTS.DEFAULT_PAGE_SIZE, CONSTANTS.MAX_PAGE_SIZE);
    
    const links = [];
    
    // Get all KV keys
    const list = await env.LINKS.list();
    
    for (const key of list.keys) {
      // Only process metadata keys
      if (key.name.startsWith('meta_')) {
        try {
          const metaData = await env.LINKS.get(key.name);
          if (metaData) {
            const linkData = JSON.parse(metaData);
            links.push(linkData);
          }
        } catch (error) {
          console.error('Parse metadata failed:', key.name, error);
        }
      }
    }
    
    // Sort by creation time (newest first)
    links.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
    
    // Pagination calculations
    const totalLinks = links.length;
    const totalPages = Math.ceil(totalLinks / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLinks = links.slice(startIndex, endIndex);
    
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalLinks: totalLinks,
      limit: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        links: paginatedLinks,
        pagination: pagination
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get short URL list failed:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to get data: ' + error.message }),
      { status: CONSTANTS.HTTP_STATUS.SERVER_ERROR, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function deleteLinkForAdmin(shortCode, env) {
  try {
    // Check if short URL exists
    const url = await env.LINKS.get(shortCode);
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, message: 'Short URL does not exist' }),
        { status: CONSTANTS.HTTP_STATUS.NOT_FOUND, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Delete short URL and metadata
    await env.LINKS.delete(shortCode);
    await env.LINKS.delete('meta_' + shortCode);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Delete successful' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete short URL failed:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Delete failed' }),
      { status: CONSTANTS.HTTP_STATUS.SERVER_ERROR, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Dedicated API endpoint handler for external tools
async function handleShortenAPI(request, env) {
  try {
    // Check API Key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const validApiKey = env.API_KEY;
    
    if (!apiKey || !validApiKey || apiKey !== validApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid or missing API key"
      }), {
        status: CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    let requestData;
    try {
      requestData = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid JSON format"
      }), {
        status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate required parameters
    if (!requestData.url) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required parameter: url"
      }), {
        status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (!await checkURL(requestData.url)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid URL format"
      }), {
        status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    let customKey = requestData.custom ? requestData.custom.trim() : null;
    
    // Check custom short URL format
    if (customKey) {
      if (!validateCustomKey(customKey)) {
        return new Response(JSON.stringify({
          success: false,
          error: "Custom key can only contain letters, numbers, underscores and hyphens, max 20 characters"
        }), {
          status: CONSTANTS.HTTP_STATUS.BAD_REQUEST,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    let shortKey;
    
    if (config.unique_link) {
      let urlHash = await sha512(requestData.url);
      let existingKey = await is_url_exist(urlHash, env);
      if (existingKey) {
        shortKey = existingKey;
      } else {
        shortKey = await save_url(requestData.url, customKey, env);
        if (shortKey) {
          await env.LINKS.put(urlHash, shortKey);
        }
      }
    } else {
      shortKey = await save_url(requestData.url, customKey, env);
    }
    
    if (shortKey) {
      const shortUrl = `https://${request.headers.get('host')}/${shortKey}`;
      return new Response(JSON.stringify({
        success: true,
        data: {
          short_url: shortUrl,
          short_code: shortKey,
          original_url: requestData.url
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      let errorMsg = customKey ? "Custom key already exists" : "Failed to generate short URL";
      return new Response(JSON.stringify({
        success: false,
        error: errorMsg
      }), {
        status: CONSTANTS.HTTP_STATUS.SERVER_ERROR,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error"
    }), {
      status: CONSTANTS.HTTP_STATUS.SERVER_ERROR,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};