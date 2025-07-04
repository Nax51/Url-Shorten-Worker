const config = {
no_ref: "off", //Control the HTTP referrer header, if you want to create an anonymous link that will hide the HTTP Referer header, please set to "on" .
theme:"",//Homepage theme, use the empty value for default theme. To use urlcool theme, please fill with "theme/urlcool" .
cors: "on",//Allow Cross-origin resource sharing for API requests.
unique_link:true,//If it is true, the same long url will be shorten into the same short url
custom_link:true,//Allow users to customize the short url.
safe_browsing_api_key: "" //Enter Google Safe Browsing API Key to enable url safety check before redirect.
}

const html404 = `<!DOCTYPE html>
<body>
  <h1>404 Not Found.</h1>
  <p>The url you visit is not found.</p>
  <a href="https://github.com/xyTom/Url-Shorten-Worker/" target="_self">Fork me on GitHub</a>
</body>`

const loginPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>短網址服務 - 管理員登入</title>
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
    <h1>管理員登入</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">用戶名:</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div class="form-group">
        <label for="password">密碼:</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit">登入</button>
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
          messageDiv.textContent = '登入成功！';
          messageDiv.style.display = 'block';
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } else {
          messageDiv.className = 'error';
          messageDiv.textContent = result.message || '登入失敗';
          messageDiv.style.display = 'block';
        }
      } catch (error) {
        messageDiv.className = 'error';
        messageDiv.textContent = '登入時發生錯誤';
        messageDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`

let response_header={
  "content-type": "text/html;charset=UTF-8",
} 

if (config.cors=="on"){
  response_header={
  "content-type": "text/html;charset=UTF-8",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods": "POST",
  }
}

async function randomString(len) {
　　len = len || 6;
　　let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
　　let maxPos = $chars.length;
　　let result = '';
　　for (let i = 0; i < len; i++) {
　　　　result += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return result;
}

async function sha512(url){
    url = new TextEncoder().encode(url)

    const url_digest = await crypto.subtle.digest(
      {
        name: "SHA-512",
      },
      url, // The data you want to hash as an ArrayBuffer
    )
    const hashArray = Array.from(new Uint8Array(url_digest)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    //console.log(hashHex)
    return hashHex
}
async function checkURL(URL){
    let str=URL;
    let Expression=/http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
    let objExp=new RegExp(Expression);
    if(objExp.test(str)==true){
      if (str[0] == 'h')
        return true;
      else
        return false;
    }else{
        return false;
    }
} 
async function save_url(URL, customKey = null, env = null){
    if (!env) {
        console.error('save_url: env 參數為空');
        return null;
    }
    
    let random_key = customKey || await randomString();
    
    try {
        let is_exist = await env.LINKS.get(random_key);
        
        if (is_exist == null) {
            // 保存URL和創建時間的元數據
            const linkData = {
                url: URL,
                created: new Date().toISOString(),
                short: random_key
            };
            
            await env.LINKS.put(random_key, URL);
            await env.LINKS.put('meta_' + random_key, JSON.stringify(linkData));
            console.log('短網址創建成功:', random_key);
            
            return random_key;
        } else {
            if (customKey) {
                // 如果是自定義key且已存在，返回錯誤
                return null;
            }
            // 如果是隨機key且已存在，重新生成
            return await save_url(URL, null, env);
        }
    } catch (error) {
        console.error('save_url 錯誤:', error);
        return null;
    }
}
async function is_url_exist(url_sha512, env){
  let is_exist = await env.LINKS.get(url_sha512)
  if (is_exist == null) {
    return false
  }else{
    return is_exist
  }
}
async function is_url_safe(url){

  let raw = JSON.stringify({"client":{"clientId":"Url-Shorten-Worker","clientVersion":"1.0.7"},"threatInfo":{"threatTypes":["MALWARE","SOCIAL_ENGINEERING","POTENTIALLY_HARMFUL_APPLICATION","UNWANTED_SOFTWARE"],"platformTypes":["ANY_PLATFORM"],"threatEntryTypes":["URL"],"threatEntries":[{"url":url}]}});

  let requestOptions = {
    method: 'POST',
    body: raw,
    redirect: 'follow'
  };

  result = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key="+config.safe_browsing_api_key, requestOptions)
  result = await result.json()
  console.log(result)
  if (Object.keys(result).length === 0){
    return true
  }else{
    return false
  }
}

// JWT 工具函數
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

async function handleRequest(request, env) {
  const requestURL = new URL(request.url);
  const path = requestURL.pathname;
  
  // 處理 API 請求
  if (path.startsWith('/api/')) {
    return await handleAPIRequest(request, env);
  }
  
  // 檢查用戶是否已登入
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const jwtSecret = env.JWT_SECRET || 'your-default-secret-key';
  const user = token ? await verifyJWT(token, jwtSecret) : null;
  
  // 如果是根目錄且未登入，顯示登入頁面
  if (path === '/' && !user) {
    return new Response(loginPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  // 如果訪問登入頁面但已經登入，重定向到根目錄
  if (path === '/login' && user) {
    return new Response('', {
      status: 302,
      headers: { 'Location': '/' }
    });
  }
  
  // 如果訪問登入頁面且未登入，顯示登入頁面
  if (path === '/login' && !user) {
    return new Response(loginPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
  
  
  // POST 請求（創建短網址）需要登入驗證或API Key
  if (request.method === "POST") {
    try {
      // 檢查API Key驗證
      const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
      const validApiKey = env.API_KEY;
      
      const isApiKeyValid = apiKey && validApiKey && apiKey === validApiKey;
      
      if (!user && !isApiKeyValid) {
        return new Response(JSON.stringify({"status":401,"error":"Unauthorized. Please login first or provide valid API key."}), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      let req;
      try {
        req = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({"status":400,"error":"無效的JSON格式"}), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      
      if (!req.url || !await checkURL(req.url)) {
        return new Response(JSON.stringify({"status":500,"error":"URL格式不正確"}), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      let random_key;
      let customKey = req.custom ? req.custom.trim() : null;
      
      // 檢查自定義短網址格式
      if (customKey) {
        if (!/^[a-zA-Z0-9_-]+$/.test(customKey) || customKey.length > 20) {
          return new Response(JSON.stringify({"status":500,"error":"自定義短網址只能包含字母、數字、下劃線和橫線，且長度不超過20個字符"}), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      if (config.unique_link) {
        let url_sha512 = await sha512(req.url);
        let url_key = await is_url_exist(url_sha512, env);
        if (url_key) {
          random_key = url_key;
        } else {
          random_key = await save_url(req.url, customKey, env);
          if (random_key) {
            await env.LINKS.put(url_sha512, random_key);
          }
        }
      } else {
        random_key = await save_url(req.url, customKey, env);
      }
      
      
      if (random_key) {
        return new Response(JSON.stringify({"status":200,"key":"/" + random_key}), {
          headers: { "Content-Type": "application/json" },
        });
      } else {
        let errorMsg = customKey ? "自定義短網址已存在，請選擇其他名稱" : "生成短網址失敗，請稍後再試";
        return new Response(JSON.stringify({"status":500,"error":errorMsg}), {
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error('POST請求處理錯誤:', error);
      return new Response(JSON.stringify({"status":500,"error":"服務器內部錯誤: " + error.message}), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } else if(request.method === "OPTIONS") {  
      return new Response(``, {
      headers: response_header,
    })
  }

  const urlPath = requestURL.pathname.split("/")[1]
  const params = requestURL.search;

  
  // 如果是根目錄且已登入，顯示短網址服務頁面
  if(!urlPath && user){
    const mainPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>短網址服務</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    
    .header { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
      margin-bottom: 30px;
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    
    .logout-btn { 
      background: #dc3545; 
      color: white; 
      padding: 8px 15px; 
      text-decoration: none; 
      border-radius: 5px; 
      font-size: 14px;
    }
    
    .shorten-section { 
      background: white; 
      padding: 30px; 
      border-radius: 10px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
      margin-bottom: 30px; 
    }
    
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
    .form-group input { 
      width: 100%; 
      padding: 12px; 
      border: 1px solid #ddd; 
      border-radius: 5px; 
      font-size: 16px;
    }
    .form-group input:focus { 
      outline: none; 
      border-color: #007bff; 
      box-shadow: 0 0 5px rgba(0,123,255,0.3); 
    }
    
    .shorten-btn { 
      background: #007bff; 
      color: white; 
      border: none; 
      padding: 12px 30px; 
      border-radius: 5px; 
      font-size: 16px; 
      cursor: pointer; 
      width: 100%;
    }
    .shorten-btn:hover { background: #0056b3; }
    
    .result { 
      margin-top: 20px; 
      padding: 15px; 
      border-radius: 5px; 
      display: none; 
    }
    .result.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
    .result.error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
    
    .short-url { 
      font-weight: bold; 
      word-break: break-all; 
      margin-top: 10px; 
    }
    .short-url a { color: #007bff; text-decoration: none; }
    .short-url a:hover { text-decoration: underline; }
    
    .links-section { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
    }
    
    .section-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 20px; 
      padding-bottom: 15px; 
      border-bottom: 1px solid #eee;
    }
    
    .refresh-btn { 
      background: #28a745; 
      color: white; 
      border: none; 
      padding: 8px 16px; 
      border-radius: 5px; 
      cursor: pointer; 
      font-size: 14px;
    }
    .refresh-btn:hover { background: #218838; }
    
    .links-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px;
    }
    
    .links-table th, .links-table td { 
      padding: 12px; 
      text-align: left; 
      border-bottom: 1px solid #ddd; 
    }
    
    .links-table th { 
      background: #f8f9fa; 
      font-weight: 600; 
      color: #495057;
    }
    
    .link-short { 
      color: #007bff; 
      text-decoration: none; 
      font-weight: 500;
    }
    .link-short:hover { text-decoration: underline; }
    
    .link-long { 
      max-width: 300px; 
      overflow: hidden; 
      text-overflow: ellipsis; 
      white-space: nowrap;
    }
    
    .delete-btn { 
      background: #dc3545; 
      color: white; 
      border: none; 
      padding: 6px 12px; 
      border-radius: 3px; 
      cursor: pointer; 
      font-size: 12px;
    }
    .delete-btn:hover { background: #c82333; }
    
    .loading, .no-data { 
      text-align: center; 
      padding: 40px; 
      color: #666;
    }
    
    .optional-text { 
      font-size: 14px; 
      color: #666; 
      margin-top: 5px; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔗 短網址服務</h1>
      <div>
        <span style="margin-right: 15px;">歡迎，${user.username}</span>
        <a href="/api/logout" class="logout-btn">登出</a>
      </div>
    </div>
    
    <div class="shorten-section">
      <h2 style="margin-bottom: 20px;">創建短網址</h2>
      <form id="shortenForm">
        <div class="form-group">
          <label for="longUrl">原始網址 *</label>
          <input type="url" id="longUrl" placeholder="https://example.com" required>
        </div>
        
        <div class="form-group">
          <label for="customKey">自定義短網址 (可選)</label>
          <input type="text" id="customKey" placeholder="my-link" maxlength="20">
          <div class="optional-text">只能包含字母、數字、下劃線和橫線，留空則自動生成</div>
        </div>
        
        <button type="submit" class="shorten-btn">生成短網址</button>
      </form>
      
      <div id="result" class="result"></div>
    </div>
    
    <div class="links-section">
      <div class="section-header">
        <h2>我的短網址</h2>
        <button onclick="loadLinks()" class="refresh-btn">🔄 刷新</button>
      </div>
      
      <div id="linksContainer">
        <div class="loading">載入中...</div>
      </div>
    </div>
  </div>

  <script>
    // 生成短網址
    document.getElementById('shortenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const longUrl = document.getElementById('longUrl').value;
      const customKey = document.getElementById('customKey').value.trim();
      const resultDiv = document.getElementById('result');
      const submitBtn = e.target.querySelector('button[type="submit"]');
      
      submitBtn.textContent = '生成中...';
      submitBtn.disabled = true;
      
      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: longUrl,
            custom: customKey || null
          })
        });
        
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('伺服器返回非JSON格式的回應');
        }
        
        const result = await response.json();
        
        if (result.status === 200) {
          const shortUrl = window.location.origin + result.key;
          resultDiv.className = 'result success';
          resultDiv.innerHTML = \`
            短網址創建成功！<br>
            <div class="short-url"><a href="\${shortUrl}" target="_blank">\${shortUrl}</a></div>
          \`;
          resultDiv.style.display = 'block';
          
          // 清空表單
          document.getElementById('longUrl').value = '';
          document.getElementById('customKey').value = '';
          
          // 刷新列表
          loadLinks();
        } else {
          resultDiv.className = 'result error';
          resultDiv.textContent = result.error || '創建失敗，請稍後再試';
          resultDiv.style.display = 'block';
        }
      } catch (error) {
        console.error('創建短網址失敗:', error);
        resultDiv.className = 'result error';
        resultDiv.textContent = '創建失敗，請檢查網路連接';
        resultDiv.style.display = 'block';
      } finally {
        submitBtn.textContent = '生成短網址';
        submitBtn.disabled = false;
      }
    });
    
    // 載入短網址列表
    async function loadLinks() {
      try {
        document.getElementById('linksContainer').innerHTML = '<div class="loading">載入中...</div>';
        
        const response = await fetch('/api/admin/links');
        
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('伺服器返回非JSON格式的回應');
        }
        
        const data = await response.json();
        
        if (data.success) {
          displayLinks(data.links);
        } else {
          document.getElementById('linksContainer').innerHTML = '<div class="no-data">載入失敗：' + (data.message || '未知錯誤') + '</div>';
        }
      } catch (error) {
        console.error('載入短網址失敗:', error);
        document.getElementById('linksContainer').innerHTML = '<div class="no-data">載入失敗，請檢查網路連接</div>';
      }
    }
    
    function displayLinks(links) {
      if (links.length === 0) {
        document.getElementById('linksContainer').innerHTML = '<div class="no-data">暫無短網址數據</div>';
        return;
      }
      
      let html = '<table class="links-table"><thead><tr><th>短網址</th><th>原始網址</th><th>創建時間</th><th>操作</th></tr></thead><tbody>';
      
      links.forEach(link => {
        const createdDate = link.created ? new Date(link.created).toLocaleString('zh-TW') : '未知';
        const shortUrl = window.location.origin + '/' + link.short;
        
        html += '<tr>';
        html += '<td><a href="' + shortUrl + '" target="_blank" class="link-short">/' + link.short + '</a></td>';
        html += '<td><div class="link-long" title="' + link.url + '">' + link.url + '</div></td>';
        html += '<td>' + createdDate + '</td>';
        html += '<td><button onclick="deleteLink(\\'' + link.short + '\\')" class="delete-btn">刪除</button></td>';
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      document.getElementById('linksContainer').innerHTML = html;
    }
    
    // 刪除短網址
    async function deleteLink(shortCode) {
      if (!confirm('確定要刪除短網址 /' + shortCode + ' 嗎？此操作無法復原。')) {
        return;
      }
      
      try {
        const response = await fetch('/api/admin/links/' + shortCode, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('刪除成功！');
          loadLinks(); // 重新載入列表
        } else {
          alert('刪除失敗：' + (result.message || '未知錯誤'));
        }
      } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗，請稍後再試');
      }
    }
    
    // 頁面載入時自動載入數據
    window.addEventListener('load', loadLinks);
  </script>
</body>
</html>`;
    
    return new Response(mainPage, {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }

  // 短網址重定向功能（不需要登入驗證）
  const value = await env.LINKS.get(urlPath);
  let location ;

  if(params) {
    location = value + params
  } else {
      location = value
  }
  

  if (location) {
    if (config.safe_browsing_api_key){
      if(!(await is_url_safe(location))){
        let warning_page = await fetch("https://xytom.github.io/Url-Shorten-Worker/safe-browsing.html")
        warning_page =await warning_page.text()
        warning_page = warning_page.replace(/{Replace}/gm, location)
        return new Response(warning_page, {
          headers: {
            "content-type": "text/html;charset=UTF-8",
          },
        })
      }
    }
    if (config.no_ref=="on"){
      let no_ref= await fetch("https://xytom.github.io/Url-Shorten-Worker/no-ref.html")
      no_ref=await no_ref.text()
      no_ref=no_ref.replace(/{Replace}/gm, location)
      return new Response(no_ref, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    })
    }else{
      return Response.redirect(location, 302)
    }
    
  }
  // If request not in kv, return 404
  return new Response(html404, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
    status: 404
  })
}

async function handleAPIRequest(request, env) {
  const requestURL = new URL(request.url);
  const path = requestURL.pathname.slice(4); // 移除 '/api'
  
  // 從環境變數讀取配置
  const adminUsername = env.ADMIN_USERNAME || 'admin';
  const adminPassword = env.ADMIN_PASSWORD || 'password';
  const jwtSecret = env.JWT_SECRET || 'your-default-secret-key';
  
  // 處理登入請求
  if (path === '/login' && request.method === 'POST') {
    const body = await request.json();
    
    if (body.username === adminUsername && body.password === adminPassword) {
      const token = await generateJWT(body.username, jwtSecret);
      
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`
          }
        }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, message: '用戶名或密碼錯誤' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // 處理登出請求
  if (path === '/logout' && (request.method === 'GET' || request.method === 'POST')) {
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
      }
    });
  }
  
  // API端點 - 用於外部工具（如n8n）- 不需要登入驗證，只需要API Key
  if (path === '/shorten' && request.method === 'POST') {
    return await handleShortenAPI(request, env);
  }
  
  // 其他 API 請求需要登入驗證
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const user = token ? await verifyJWT(token, jwtSecret) : null;
  
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, message: '未授權訪問' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 管理後台 API
  if (path === '/admin/links' && request.method === 'GET') {
    return await getLinksForAdmin(env);
  }
  
  if (path.startsWith('/admin/links/') && request.method === 'DELETE') {
    const shortCode = path.split('/')[3];
    return await deleteLinkForAdmin(shortCode, env);
  }
  
  // 添加其他需要驗證的 API 處理邏輯
  return new Response(
    JSON.stringify({ success: false, message: '未找到請求的資源' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}




// 管理後台 API 函數
async function getLinksForAdmin(env) {
  try {
    const links = [];
    
    // 獲取所有KV鍵值
    const list = await env.LINKS.list();
    
    for (const key of list.keys) {
      // 只處理元數據鍵
      if (key.name.startsWith('meta_')) {
        try {
          const metaData = await env.LINKS.get(key.name);
          if (metaData) {
            const linkData = JSON.parse(metaData);
            links.push(linkData);
          }
        } catch (error) {
          console.error('解析元數據失敗:', key.name, error);
        }
      }
    }
    
    // 按創建時間排序（最新的在前）
    links.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
    
    return new Response(
      JSON.stringify({ success: true, links: links }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('獲取短網址列表失敗:', error);
    return new Response(
      JSON.stringify({ success: false, message: '獲取數據失敗: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function deleteLinkForAdmin(shortCode, env) {
  try {
    // 檢查短網址是否存在
    const url = await env.LINKS.get(shortCode);
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, message: '短網址不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 刪除短網址和元數據
    await env.LINKS.delete(shortCode);
    await env.LINKS.delete('meta_' + shortCode);
    
    return new Response(
      JSON.stringify({ success: true, message: '刪除成功' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('刪除短網址失敗:', error);
    return new Response(
      JSON.stringify({ success: false, message: '刪除失敗' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 專用API端點處理函數
async function handleShortenAPI(request, env) {
  try {
    // 檢查API Key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const validApiKey = env.API_KEY;
    
    if (!apiKey || !validApiKey || apiKey !== validApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid or missing API key"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    let req;
    try {
      req = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid JSON format"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 驗證必需參數
    if (!req.url) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required parameter: url"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (!await checkURL(req.url)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid URL format"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    let customKey = req.custom ? req.custom.trim() : null;
    
    // 檢查自定義短網址格式
    if (customKey) {
      if (!/^[a-zA-Z0-9_-]+$/.test(customKey) || customKey.length > 20) {
        return new Response(JSON.stringify({
          success: false,
          error: "Custom key can only contain letters, numbers, underscores and hyphens, max 20 characters"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    let random_key;
    
    if (config.unique_link) {
      let url_sha512 = await sha512(req.url);
      let url_key = await is_url_exist(url_sha512, env);
      if (url_key) {
        random_key = url_key;
      } else {
        random_key = await save_url(req.url, customKey, env);
        if (random_key) {
          await env.LINKS.put(url_sha512, random_key);
        }
      }
    } else {
      random_key = await save_url(req.url, customKey, env);
    }
    
    if (random_key) {
      const shortUrl = `https://${request.headers.get('host')}/${random_key}`;
      return new Response(JSON.stringify({
        success: true,
        data: {
          short_url: shortUrl,
          short_code: random_key,
          original_url: req.url
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
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error('API錯誤:', error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
