-- Phase 4: Email & Social Media Monitoring Schema
-- Adds tables for monitoring Gmail and X (Twitter), message classification, and user feedback

-- Table for storing monitored messages from Gmail and X
CREATE TABLE IF NOT EXISTS monitored_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('gmail', 'twitter')),
    message_id VARCHAR(255) NOT NULL,
    sender VARCHAR(255),
    subject VARCHAR(500),
    content TEXT,
    importance_score INTEGER CHECK (importance_score >= 1 AND importance_score <= 10),
    classification VARCHAR(20) CHECK (classification IN ('high', 'medium', 'low')),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, source, message_id)
);

CREATE INDEX idx_monitored_messages_user_date ON monitored_messages(user_id, created_at DESC);
CREATE INDEX idx_monitored_messages_unread ON monitored_messages(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_monitored_messages_classification ON monitored_messages(user_id, classification) WHERE is_read = FALSE;

-- Table for storing user feedback on message classification
CREATE TABLE IF NOT EXISTS message_feedback (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES monitored_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_score INTEGER NOT NULL,
    corrected_score INTEGER NOT NULL,
    feedback_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_message_feedback_user ON message_feedback(user_id, created_at DESC);
CREATE INDEX idx_message_feedback_message ON message_feedback(message_id);

-- Table for AI preferences (wake time, important contacts, etc.)
CREATE TABLE IF NOT EXISTS ai_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wake_time TIME DEFAULT '08:00',
    sleep_time TIME DEFAULT '21:00',
    important_contacts JSONB DEFAULT '[]',
    ignore_keywords JSONB DEFAULT '[]',
    gmail_last_sync TIMESTAMP,
    twitter_last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_preferences_user ON ai_preferences(user_id);

-- Table for storing Gmail OAuth tokens
CREATE TABLE IF NOT EXISTS gmail_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expiry_date BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gmail_tokens_user ON gmail_tokens(user_id);
