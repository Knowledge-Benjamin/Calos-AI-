# AI Assistant Backend

Conversational AI assistant for Day Tracker app with voice interaction, task automation, and proactive features.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection (same as Day Tracker)
- `GEMINI_API_KEY` - Google Gemini API key
- `JWT_SECRET` - Same as Day Tracker (for auth validation)

### 3. Apply Database Migration
```bash
npm run migrate
```

### 4. Run Development Server
```bash
npm run dev
```

Server runs on `http://localhost:3002`

---

## 📡 API Endpoints

### Chat
```
POST   /api/ai/chat/message     - Send message
GET    /api/ai/chat/history     - Get conversation history
POST   /api/ai/chat/session     - Create new session
```

### Authentication
All `/api/ai/*` endpoints require JWT token from Day Tracker:
```
Authorization: Bearer {token}
```

---

## 🗄️ Database Schema

Extends Day Tracker with 4 new tables:
- `ai_conversations` - Chat history (indefinite memory)
- `ai_context` - User preferences & learned patterns
- `ai_pending_actions` - Actions awaiting approval
- `ai_external_sync` - OAuth tokens for Gmail/X

---

## 📦 Project Structure

```
ai-assistant/
├── src/
│   ├── config/          # Database, Gemini config
│   ├── services/        # AI, conversation services
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth middleware
│   ├── utils/           # Logger
│   └── server.ts        # Express app
├── database/
│   └── schema.sql       # Migration
└── package.json
```

---

## 🔧 Development

```bash
npm run dev      # Start dev server
npm run build    # Compile TypeScript
npm run start    # Run compiled code
npm run test:ai  # Test Gemini connection
```

---

## 🤖 Features (Phase 1)

- ✅ Text chat with Gemini AI
- ✅ Conversation memory
- ✅ Context-aware responses
- ✅ User preferences storage
- ✅ JWT authentication (shared with Day Tracker)

## 📅 Upcoming Phases

- Phase 2: Voice (STT/TTS)
- Phase 3: Task automation (create logs/events)
- Phase 4: Email/social monitoring
- Phase 5: Proactive features (wake-up, reminders)
- Phase 6: Document drafting

---

Built with ❤️ for Day Tracker
