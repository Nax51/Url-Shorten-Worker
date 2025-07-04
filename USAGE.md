# 短網址服務 - Cloudflare Workers

基於 Cloudflare Workers 的安全短網址服務，支持登入保護、自定義短網址、API 調用等功能。

## 🌟 主要功能

- 🔐 **安全登入保護** - 防止未授權使用
- 🎯 **自定義短網址** - 支持自定義短代碼
- 📊 **管理介面** - 一頁式管理所有短網址
- 🔗 **API 支持** - 支持 n8n 等工具調用
- 💾 **KV 儲存** - 使用 Cloudflare KV 儲存數據
- 📱 **響應式設計** - 支持各種設備

## 🚀 部署步驟

### 1. 創建 Cloudflare Workers

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 進入 **Workers & Pages**
3. 點擊 **Create application** > **Create Worker**
4. 將 `index.js` 代碼複製到編輯器中
5. 點擊 **Deploy**

### 2. 設定 KV 命名空間

1. 在 Cloudflare Dashboard 中進入 **Workers & Pages** > **KV**
2. 點擊 **Create a namespace**
3. 命名為 `LINKS` (或其他名稱)
4. 回到你的 Worker 設定頁面
5. 進入 **Settings** > **Variables** > **KV Namespace Bindings**
6. 添加綁定：
   - Variable name: `LINKS`
   - KV namespace: 選擇剛創建的命名空間

### 3. 設定環境變數

在 **Settings** > **Variables** > **Environment Variables** 中添加：

```
ADMIN_USERNAME = 你的管理員用戶名
ADMIN_PASSWORD = 你的管理員密碼
JWT_SECRET = 你的JWT密鑰（建議32字符以上的隨機字符串）
API_KEY = 你的API密鑰（用於外部工具調用）
```

**安全建議：**
- 使用強密碼
- JWT_SECRET 使用長隨機字符串
- API_KEY 使用安全的隨機字符串

## 🔧 配置選項

在 `index.js` 中的 `config` 對象可以調整以下設定：

```javascript
const config = {
  no_ref: "off",           // 控制 HTTP referrer header ("on"/"off")
  theme: "",               // 主題設定 (預設為空)
  cors: "on",              // 允許跨域請求 ("on"/"off")
  unique_link: true,       // 相同URL生成相同短網址 (true/false)
  custom_link: true,       // 允許自定義短網址 (true/false)
  safe_browsing_api_key: ""// Google Safe Browsing API Key
}
```

## 📖 使用方法

### 網頁介面使用

1. 訪問你的 Worker 域名
2. 使用設定的管理員帳號密碼登入
3. 在介面中輸入原始網址
4. 可選：輸入自定義短代碼
5. 點擊「生成短網址」
6. 在下方列表中管理已創建的短網址

### API 調用

#### 端點
```
POST https://your-worker-domain.workers.dev/api/shorten
```

#### 請求頭

**方法一：使用 X-API-Key 標頭**
```
Content-Type: application/json
X-API-Key: 你的API密鑰
```

**方法二：使用 Authorization Bearer 標頭**
```
Content-Type: application/json
Authorization: Bearer 你的API密鑰
```

#### 請求體
```json
{
  "url": "https://example.com",
  "custom": "my-link"  // 可選，自定義短代碼
}
```

#### 成功回應
```json
{
  "success": true,
  "data": {
    "short_url": "https://your-domain.com/abc123",
    "short_code": "abc123",
    "original_url": "https://example.com"
  }
}
```

#### 錯誤回應
```json
{
  "success": false,
  "error": "錯誤描述"
}
```

## 🔗 n8n 整合

### 設定步驟

1. 在 n8n 中添加 **HTTP Request** 節點
2. 設定如下：

**基本設定：**
- Method: `POST`
- URL: `https://your-worker-domain.workers.dev/api/shorten`

**Headers（擇一使用）：**

**方法一：使用 X-API-Key**
```json
{
  "Content-Type": "application/json",
  "X-API-Key": "你的API密鑰"
}
```

**方法二：使用 Authorization Bearer**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer 你的API密鑰"
}
```

**Body：**
```json
{
  "url": "{{ $json.original_url }}",
  "custom": "{{ $json.custom_code }}"  // 可選
}
```

### 範例 n8n 工作流程

**使用 X-API-Key 認證：**
```json
{
  "nodes": [
    {
      "name": "Shorten URL",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-worker-domain.workers.dev/api/shorten",
        "requestMethod": "POST",
        "headers": {
          "parameters": [
            {
              "name": "X-API-Key",
              "value": "你的API密鑰"
            }
          ]
        },
        "body": {
          "mimeType": "application/json",
          "content": {
            "url": "https://example.com"
          }
        }
      }
    }
  ]
}
```

**使用 Authorization Bearer 認證：**
```json
{
  "nodes": [
    {
      "name": "Shorten URL",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-worker-domain.workers.dev/api/shorten",
        "requestMethod": "POST",
        "headers": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer 你的API密鑰"
            }
          ]
        },
        "body": {
          "mimeType": "application/json",
          "content": {
            "url": "https://example.com"
          }
        }
      }
    }
  ]
}
```

## 🛠️ 維護管理

### 查看日誌
在 Cloudflare Dashboard 中：
1. 進入你的 Worker
2. 點擊 **Logs** 標籤
3. 查看 Real-time Logs

### 備份數據
KV 數據會自動備份到 Cloudflare 的全球網路中。如需手動備份：

1. 使用管理介面查看所有短網址
2. 或通過 API 獲取列表：
```bash
curl -X GET "https://your-domain.com/api/admin/links" \
  -H "Cookie: token=你的登入token"
```

### 更新代碼
1. 在 Cloudflare Dashboard 中進入你的 Worker
2. 點擊 **Quick edit**
3. 更新代碼後點擊 **Save and deploy**

### 清理過期數據
目前短網址不會自動過期。如需清理：
1. 使用管理介面手動刪除
2. 或寫腳本批量清理 KV 中的數據

## 🔒 安全建議

1. **強密碼**：使用複雜的管理員密碼
2. **定期更換**：定期更換 JWT_SECRET 和 API_KEY
3. **訪問控制**：考慮限制 IP 訪問範圍
4. **日誌監控**：定期檢查 Worker 日誌
5. **備份**：定期備份重要的短網址數據

## 📊 限制說明

### Cloudflare KV 限制
- 免費版：每天 100,000 次讀取操作
- 免費版：每天 1,000 次寫入操作
- 鍵名最大 512 字節
- 值最大 25 MB

### Workers 限制
- 免費版：每天 100,000 次請求
- CPU 時間：最大 10ms (免費版)

## 🐛 故障排除

### 常見問題

**1. 500 錯誤**
- 檢查環境變數是否正確設定
- 檢查 KV 命名空間是否正確綁定
- 查看 Worker 日誌獲取詳細錯誤

**2. 登入失敗**
- 確認 ADMIN_USERNAME 和 ADMIN_PASSWORD 環境變數
- 檢查 JWT_SECRET 是否設定

**3. API 調用失敗**
- 確認 API_KEY 環境變數設定正確
- 檢查請求頭格式是否正確
- 查看回應錯誤訊息

**4. 短網址無法訪問**
- 檢查 KV 命名空間是否有數據
- 確認短代碼是否存在

### 日誌分析
常見日誌訊息：
- `短網址創建成功: abc123` - 成功創建
- `save_url 錯誤:` - 保存失敗
- `API錯誤:` - API 調用錯誤

## 📝 版本記錄

### v1.0.0
- 基本短網址功能
- 登入保護
- 自定義短網址
- API 支持
- n8n 整合

## 🤝 支援

如遇問題或需要協助：
1. 檢查本文檔的故障排除章節
2. 查看 Cloudflare Workers 日誌
3. 確認環境變數和 KV 設定

## 📄 授權

本專案基於原始的 Url-Shorten-Worker 專案進行改進和擴展。

---

**注意：** 請妥善保管你的環境變數，特別是密碼和 API 密鑰。建議定期更換以確保安全性。