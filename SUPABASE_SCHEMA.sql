-- Run this SQL in your Supabase SQL Editor to fix the sync issues

-- Add routine_id column to sessions table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='routine_id') THEN
        ALTER TABLE sessions ADD COLUMN routine_id TEXT;
        -- Optional: Add an index for better performance when querying by routine_id
        CREATE INDEX IF NOT EXISTS idx_sessions_routine_id ON sessions(routine_id);
    END IF;
END $$;

-- Add specific_dates column to routines table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routines' AND column_name='specific_dates') THEN
        ALTER TABLE routines ADD COLUMN specific_dates JSONB;
    END IF;
END $$;


