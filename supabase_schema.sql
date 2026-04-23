-- Supabase Table Schema for "Study Routine" app

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  grade TEXT,
  school TEXT,
  avatar TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  student_info TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sessions Table (Tasks/Sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter TEXT,
  topics TEXT,
  color TEXT,
  icon TEXT,
  date TEXT NOT NULL, -- YYYY-MM-DD
  completed BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  reminder_time TEXT, -- HH:mm
  routine_id UUID
);

-- 3. Routines Table
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter TEXT,
  topics TEXT,
  date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT, -- YYYY-MM-DD
  specific_dates TEXT[], -- Array of YYYY-MM-DD
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  countdown INTEGER DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE,
  reminder_time TEXT -- HH:mm
);

-- 4. Settings Table (Flexible storage for app settings, timer state, etc.)
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'app', 'prayer', 'schedules', 'timer', 'study_timer', 'study_history'
  settings JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

-- 5. Study Focus Table (Focus time history)
CREATE TABLE IF NOT EXISTS study_focus (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_focus ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for Sessions
CREATE POLICY "Users can manage their own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);

-- Policies for Routines
CREATE POLICY "Users can manage their own routines" ON routines FOR ALL USING (auth.uid() = user_id);

-- Policies for Settings
CREATE POLICY "Users can manage their own settings" ON settings FOR ALL USING (auth.uid() = user_id);

-- Policies for Study Focus
CREATE POLICY "Users can manage their own study focus" ON study_focus FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime for Settings (optional, helpful for sync)
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE study_focus;
