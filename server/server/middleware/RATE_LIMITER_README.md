# Rate Limiter Middleware Documentation

## 📋 Overview

Rate limiting middleware untuk melindungi API dari abuse dan DDoS attacks. Middleware ini menggunakan `express-rate-limit` untuk membatasi jumlah request per IP address.

## 🚀 Installation

Install package terlebih dahulu:

```bash
cd server
npm install express-rate-limit
```

## 📁 File Location

`server/middleware/rateLimiter.js`

## 🔧 Available Limiters

### 1. `apiLimiter`
**Purpose:** General API rate limiting  
**Limit:** 100 requests per minute per IP  
**Use Case:** Applied to all API routes

### 2. `loginLimiter`
**Purpose:** Login endpoint protection  
**Limit:** 10 attempts per minute per IP  
**Use Case:** Applied to login/register endpoints

## 💻 Usage Examples

### Example 1: Apply to All Routes (server.js)

```javascript
const { apiLimiter } = require('./middleware/rateLimiter');

// Apply to all API routes
app.use('/api', apiLimiter);
```

### Example 2: Apply to Auth Routes (authRoutes.js)

```javascript
const { loginLimiter } = require('../middleware/rateLimiter');

// Apply to login endpoint
router.post('/login', loginLimiter, (req, res, next) => {
  AuthController.login(req, res, next);
});

// Apply to register endpoint
router.post('/register', loginLimiter, (req, res, next) => {
  AuthController.register(req, res, next);
});
```

### Example 3: Apply to Specific Routes

```javascript
const { apiLimiter, loginLimiter } = require('../middleware/rateLimiter');

// AI endpoints - stricter limit
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // Only 5 requests per minute
  message: {
    error: 'AI quota exceeded. Please wait before making another request.',
    retryAfter: 60
  }
});

router.post('/ai/query', aiLimiter, (req, res, next) => {
  // AI query handler
});
```

## 📊 Response Format

When rate limit is exceeded, the middleware returns:

```json
{
  "error": "Too many requests from this IP. Please try again later.",
  "retryAfter": 60
}
```

HTTP Status: `429 Too Many Requests`

Headers included:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)
- `Retry-After`: Seconds to wait before retrying

## 🔒 Security Considerations

1. **IP-based Limiting**: Uses `req.ip` to identify clients
2. **Proxy Support**: If behind proxy, ensure `trust proxy` is enabled:
   ```javascript
   app.set('trust proxy', 1);
   ```

3. **Redis Store (Optional)**: For distributed systems, use Redis store:
   ```javascript
   const RedisStore = require('rate-limit-redis');
   const redis = require('redis');
   
   const client = redis.createClient();
   
   const apiLimiter = rateLimit({
     store: new RedisStore({
       client: client,
       prefix: 'rl:'
     }),
     windowMs: 60 * 1000,
     max: 100
   });
   ```

## 🧪 Testing

Test rate limiting:

```bash
# Test API limiter (100 requests/minute)
for i in {1..101}; do
  curl http://localhost:5000/api/health
done

# Test login limiter (10 requests/minute)
for i in {1..11}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}'
done
```

## 📝 Implementation Checklist

- [ ] Install `express-rate-limit` package
- [ ] Import rate limiters in `server.js`
- [ ] Apply `apiLimiter` to all API routes
- [ ] Apply `loginLimiter` to auth routes
- [ ] Test rate limiting functionality
- [ ] Monitor rate limit hits in production
- [ ] Adjust limits based on usage patterns
- [ ] Consider Redis store for production scaling

## 🎯 Recommended Implementation

### Step 1: Update server.js

```javascript
const { apiLimiter } = require('./middleware/rateLimiter');

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);
```

### Step 2: Update authRoutes.js

```javascript
const { loginLimiter } = require('../middleware/rateLimiter');

// Apply to login
router.post('/login', loginLimiter, (req, res, next) => {
  AuthController.login(req, res, next);
});

// Apply to register
router.post('/register', loginLimiter, (req, res, next) => {
  AuthController.register(req, res, next);
});
```

### Step 3: Optional - Create AI-specific limiter

```javascript
// In rateLimiter.js, add:
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Too many AI requests. Please wait before trying again.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.user?.id || req.ip
});

module.exports = { apiLimiter, loginLimiter, aiLimiter };
```

## ⚠️ Important Notes

1. **Development vs Production**: Consider different limits for different environments
2. **User-based Limiting**: For authenticated users, consider using `req.user.id` instead of `req.ip`
3. **Whitelist**: Add trusted IPs to skip rate limiting if needed
4. **Monitoring**: Log rate limit hits to identify abuse patterns
5. **Error Handling**: Ensure rate limit errors are properly handled by error middleware

## 🔗 Related Documentation

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [PRD Security Requirements](./PRD_idxgpt.mdx#security-requirements)
- [ANALISIS_DAN_PERBAIKAN.md](../ANALISIS_DAN_PERBAIKAN.md)

---

**Last Updated:** 2025-01-27  
**Status:** Ready for Implementation



