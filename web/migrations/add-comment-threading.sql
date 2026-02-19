-- Add comment threading support (single-level)
-- Run this migration to add parent_id column to comments table

ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE;

-- Create index for faster parent lookup
CREATE INDEX IF NOT EXISTS idx_parent_id ON comments(parent_id);
