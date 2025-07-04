# Url-Shorten-Worker (Enhanced 2025)
A secure URL Shortener created using Cloudflare Worker with authentication and API support

## 🌟 Features

- 🔐 **Secure Authentication** - JWT-based login protection
- 🎯 **Custom Short URLs** - Support for custom short codes
- 📊 **Management Interface** - All-in-one management page
- 🔗 **API Support** - Complete API for external tools (n8n, etc.)
- 💾 **KV Storage** - Cloudflare KV for data storage
- 📱 **Responsive Design** - Works on all devices
- 🛡️ **Anti-abuse Protection** - Environment-based access control

## 📚 Documentation

- [Complete Usage Guide (完整使用指南)](USAGE.md)

## 🚀 Quick Start

### 1. Create KV Namespace
Go to Workers KV and create a namespace named `LINKS`.

## 2. Bind KV Namespace
In Worker Settings, bind the KV namespace with Variable name `LINKS`.

### 3. Set Environment Variables
Configure the following environment variables in Worker Settings:
```
ADMIN_USERNAME = your-admin-username
ADMIN_PASSWORD = your-admin-password
JWT_SECRET = your-jwt-secret-key
API_KEY = your-api-key
```

### 4. Deploy Code
Copy the `index.js` code to Cloudflare Worker and click "Save and Deploy".

### 5. Access Your Service
Visit your Worker domain and login with your credentials.

## 🔧 API Usage

### Authentication
Supports two authentication methods:
- `X-API-Key: your-api-key`
- `Authorization: Bearer your-api-key`

### Example Request
```bash
curl -X POST "https://your-domain.workers.dev/api/shorten" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url": "https://example.com", "custom": "my-link"}'
```

### Response
```json
{
  "success": true,
  "data": {
    "short_url": "https://your-domain.com/my-link",
    "short_code": "my-link",
    "original_url": "https://example.com"
  }
}
```

## 🛠️ n8n Integration

Perfect integration with n8n workflows. See [USAGE.md](USAGE.md) for detailed setup instructions.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Based on the original [Url-Shorten-Worker](https://github.com/xyTom/Url-Shorten-Worker) project with enhancements for 2025.

## 🔗 Demo

For testing purposes only. Deploy your own instance for production use.

---

**Note**: This enhanced version includes authentication, API support, and modern security features. For detailed setup and usage instructions, please refer to [USAGE.md](USAGE.md).
