# Url-Shorten-Worker (Enhanced 2025)
A secure, production-ready URL Shortener built with Cloudflare Worker featuring modern authentication, responsive design, and comprehensive API support.

## ✨ Key Features

### 🔐 **Security & Authentication**
- JWT-based secure login system
- API key authentication for external tools
- Rate limiting protection (100 requests/minute)
- CSRF protection mechanisms
- Enhanced input validation

### 🎯 **URL Management**
- Custom short URL codes support
- Automatic URL duplicate detection
- Smart pagination (10 items per page for optimal performance)
- One-click copy functionality
- Bulk management capabilities

### 📱 **Responsive Design**
- **Desktop**: Wide layout (1400px) with table view and horizontal button layout
- **Mobile**: Card-based layout with no horizontal scrolling
- Seamless experience across all devices
- Touch-friendly interface elements

### 💾 **Data & Storage**
- Cloudflare KV storage with automatic TTL (1-year expiration)
- Metadata tracking with creation timestamps
- Efficient pagination system
- Automatic cleanup of expired links

### 🔗 **API & Integration**
- RESTful API for external tools integration
- Perfect n8n workflow compatibility
- Comprehensive error handling
- Standardized response formats

### 🛡️ **Enterprise Ready**
- Production-grade error handling
- Comprehensive logging
- Environment-based configuration
- Security best practices implementation

## 🚀 Quick Setup

### 1. Create KV Namespace
```bash
# In Cloudflare Dashboard
Workers & Pages > KV > Create Namespace > "LINKS"
```

### 2. Bind KV Namespace
In Worker Settings, bind the KV namespace:
- Variable name: `LINKS`
- KV namespace: Select your created namespace

### 3. Environment Variables
Configure these required environment variables:
```env
ADMIN_USERNAME = your-secure-username
ADMIN_PASSWORD = your-strong-password
JWT_SECRET = your-secret-key-min-32-chars
API_KEY = your-api-key-for-external-access
```

### 4. Deploy Worker
1. Copy the complete `index.js` code
2. Paste into Cloudflare Worker editor
3. Click "Save and Deploy"

### 5. Access Your Service
Visit `https://your-worker.your-subdomain.workers.dev` and login!

## 🔧 API Documentation

### Authentication Methods
The API supports dual authentication:

**Method 1: API Key Header**
```bash
X-API-Key: your-api-key
```

**Method 2: Bearer Token**
```bash
Authorization: Bearer your-api-key
```

### Shorten URL Endpoint
```bash
POST /api/shorten
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://example.com/very-long-url",
  "custom": "my-short-code"  // Optional
}
```

### Success Response
```json
{
  "success": true,
  "data": {
    "short_url": "https://your-domain.workers.dev/my-short-code",
    "short_code": "my-short-code",
    "original_url": "https://example.com/very-long-url"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Custom key already exists"
}
```

## 🛠️ Advanced Configuration

### Rate Limiting
Default: 100 requests per minute per IP
```javascript
// Configurable in CONSTANTS
RATE_LIMIT_MAX_REQUESTS: 100,
RATE_LIMIT_WINDOW: 60000 // 1 minute
```

### TTL Settings
Default: 1 year auto-expiration
```javascript
// All short URLs automatically expire after 1 year
KV_TTL_SECONDS: 31536000 // 365 days
```

### Pagination
Desktop-optimized pagination:
```javascript
// 10 items per page for better UX
DEFAULT_PAGE_SIZE: 10
```

## 📱 User Interface Features

### Desktop Experience
- **Wide Layout**: 1400px container for better content visibility
- **Table View**: Organized columns with proper spacing
- **Horizontal Buttons**: Copy and Delete buttons side-by-side
- **Smart Pagination**: 10 items per page with full navigation

### Mobile Experience
- **Card Layout**: Each URL in a dedicated card
- **No Horizontal Scroll**: All content fits screen width
- **Touch-Friendly**: Large buttons optimized for mobile
- **Responsive Typography**: Scales appropriately for readability

### Interactive Elements
- **One-Click Copy**: Instant clipboard copying with visual feedback
- **Status Indicators**: Copy button changes to "Copied!" with color change
- **Smooth Transitions**: Professional animations and hover effects
- **Error Handling**: User-friendly error messages and fallbacks

## 🔗 Integration Examples

### n8n Workflow
```json
{
  "method": "POST",
  "url": "https://your-worker.workers.dev/api/shorten",
  "headers": {
    "Content-Type": "application/json",
    "X-API-Key": "{{$node[\"Credentials\"].json[\"api_key\"]}}"
  },
  "body": {
    "url": "{{$node[\"Previous\"].json[\"long_url\"]}}",
    "custom": "{{$node[\"Previous\"].json[\"custom_code\"]}}"
  }
}
```

### Python Script
```python
import requests

def shorten_url(long_url, custom=None):
    response = requests.post(
        'https://your-worker.workers.dev/api/shorten',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': 'your-api-key'
        },
        json={
            'url': long_url,
            'custom': custom
        }
    )
    return response.json()
```

## 📊 Performance & Limits

| Feature | Specification |
|---------|---------------|
| **Response Time** | < 100ms (global edge) |
| **Concurrent Users** | Unlimited (Cloudflare edge) |
| **Storage** | 1GB free (Cloudflare KV) |
| **Rate Limiting** | 100 req/min per IP |
| **Custom URL Length** | Max 20 characters |
| **Auto Expiration** | 1 year TTL |

## 🛡️ Security Features

- **JWT Authentication**: Secure session management
- **API Key Protection**: External access control
- **Rate Limiting**: DDoS and abuse protection
- **Input Validation**: XSS and injection prevention
- **CSRF Protection**: Cross-site request forgery prevention
- **Secure Headers**: Modern web security headers
- **Environment Isolation**: Secure configuration management

## 📈 What's New in 2025 Enhancement

### Code Quality Improvements
- ✅ Refactored long functions into modular components
- ✅ Replaced magic numbers with named constants
- ✅ Unified English comments and consistent naming
- ✅ Enhanced error handling and validation

### New Features
- ✅ Complete responsive design overhaul
- ✅ One-click copy functionality
- ✅ Automatic KV TTL management
- ✅ Advanced pagination system
- ✅ Rate limiting protection
- ✅ CSRF security measures

### UI/UX Enhancements
- ✅ Desktop: 1400px wide layout
- ✅ Mobile: Card-based responsive design
- ✅ 10-item pagination for optimal performance
- ✅ Professional button layouts and interactions
- ✅ Smooth animations and visual feedback

## 🤝 Contributing

This enhanced version builds upon the excellent foundation of [xyTom/Url-Shorten-Worker](https://github.com/xyTom/Url-Shorten-Worker) with significant improvements for modern production use.

### Development
1. Fork this repository
2. Make your enhancements
3. Test thoroughly on both desktop and mobile
4. Submit a pull request with detailed description

## 📄 License

MIT License - Use freely in personal and commercial projects.

## 🔗 Demo & Support

**Demo**: Deploy your own instance for testing
**Documentation**: Comprehensive setup guides included
**Community**: GitHub Issues for support and feature requests

---

🚀 **Ready for Production**: This enhanced version is battle-tested and production-ready with enterprise-grade features, security, and user experience.