-- Feedback aggregation database schema
-- This schema stores feedback from multiple sources with sentiment analysis

DROP TABLE IF EXISTS feedback;

CREATE TABLE feedback (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,           -- Source of feedback (Discord, Support, GitHub, Reddit, X, Email)
    message TEXT NOT NULL,          -- The actual feedback message
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When the feedback was received
    sentiment TEXT,                 -- Sentiment analysis result (positive, negative, neutral)
    category TEXT,                  -- Optional category/topic classification
    author TEXT,                    -- Optional author/user identifier
    metadata TEXT                   -- JSON field for additional source-specific data
);

-- Create indexes for common queries
CREATE INDEX idx_feedback_source ON feedback(source);
CREATE INDEX idx_feedback_timestamp ON feedback(timestamp DESC);
CREATE INDEX idx_feedback_sentiment ON feedback(sentiment);

-- Optional: Create a table for aggregated stats (can be populated via triggers or scheduled jobs)
CREATE TABLE feedback_stats (
    id INTEGER PRIMARY KEY,
    source TEXT,
    sentiment TEXT,
    count INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
