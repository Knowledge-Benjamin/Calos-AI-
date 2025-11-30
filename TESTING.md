# AI Assistant Testing Guide

## ✅ Server Status
- **Running**: http://localhost:3002
- **Database**: Connected to Day Tracker PostgreSQL
- **Gemini AI**: Initialized with gemini-2.5-flash-preview-09-2025

---

## 🧪 Quick Tests

### 1. Health Check (No Auth Required)
```bash
curl http://localhost:3002/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-30T...",
  "uptime": 123.456
}
```

---

### 2. Chat Endpoint (Requires JWT Token)

#### Step A: Get JWT Token from Day Tracker

**Option 1: Use existing user login**
```bash
curl -X POST https://day-tracker-93ly.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your_password"}'
```

**Option 2: Create a test user**
```bash
curl -X POST https://day-tracker-93ly.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Test123!",
    "name":"Test User"
  }'
```

**Copy the `accessToken` from the response.**

---

#### Step B: Test Chat

Replace `YOUR_TOKEN_HERE` with the actual token:

```bash
curl -X POST http://localhost:3002/api/ai/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "message": "Hello! Can you help me track my goals?"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "response": "Hello! I'd be happy to help you track your goals...",
    "sessionId": "uuid-v4-session-id"
  }
}
```

---

### 3. Get Conversation History

```bash
curl http://localhost:3002/api/ai/chat/history?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### 4. Create New Session

```bash
curl -X POST http://localhost:3002/api/ai/chat/session \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔍 Verify Database

Check if conversation was stored:

```sql
SELECT * FROM ai_conversations ORDER BY created_at DESC LIMIT 5;
SELECT * FROM ai_context;
```

---

## 🎯 Test Scenarios

### Test 1: Basic Conversation
```json
{"message": "Hi, I'm working on learning TypeScript"}
```

### Test 2: Ask About Goals
```json
{"message": "What goals do I have active right now?"}
```

### Test 3: Request to Create Log
```json
{"message": "I practiced guitar for 30 minutes today"}
```

---

## ✅ Success Criteria

- [x] Server starts without errors
- [x] Health endpoint responds
- [ ] Chat endpoint accepts messages
- [ ] Gemini AI generates responses
- [ ] Conversations stored in database
- [ ] Context persistence works

---

## 🐛 Troubleshooting

**401 Unauthorized**: Token expired or invalid. Get a new token from Day Tracker.

**Database errors**: Check `.env` DATABASE_URL matches Day Tracker's database.

**Gemini errors**: Verify GEMINI_API_KEY is valid.

---

**Ready to test!** 🚀
