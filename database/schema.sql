-- AI Assistant Database Schema
-- Extends Day Tracker database
-- PostgreSQL

-- AI Conversations (indefinite memory)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    audio_url TEXT,
    intent VARCHAR(100),
    entities JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at DESC);

-- AI Context (user preferences, learned patterns)
CREATE TABLE IF NOT EXISTS ai_context (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    preferences JSONB DEFAULT '{}',
    learned_patterns JSONB DEFAULT '{}',
    last_interaction TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending Actions (for approval workflow)
CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_status ON ai_pending_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_created_at ON ai_pending_actions(created_at DESC);

-- External Service Sync (Gmail, X, etc.)
CREATE TABLE IF NOT EXISTS ai_external_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL CHECK (service IN ('gmail', 'twitter', 'google_calendar')),
    last_sync TIMESTAMP,
    sync_token TEXT,
    credentials JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, service)
);

-- Trigger for updated_at on ai_context
CREATE OR REPLACE FUNCTION update_ai_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_ai_context_updated_at 
BEFORE UPDATE ON ai_context
FOR EACH ROW EXECUTE FUNCTION update_ai_context_updated_at();

-- Trigger for updated_at on ai_external_sync
CREATE TRIGGER update_ai_external_sync_updated_at 
BEFORE UPDATE ON ai_external_sync
FOR EACH ROW EXECUTE FUNCTION update_ai_context_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_context_user_id ON ai_context(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_external_sync_user_service ON ai_external_sync(user_id, service);

-- Comments
COMMENT ON TABLE ai_conversations IS 'Stores all AI conversations with indefinite history';
COMMENT ON TABLE ai_context IS 'User preferences and AI learned patterns';
COMMENT ON TABLE ai_pending_actions IS 'Actions awaiting user approval (drafts, etc.)';
COMMENT ON TABLE ai_external_sync IS 'External service OAuth tokens and sync status';
