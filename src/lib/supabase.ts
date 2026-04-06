import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vehufqgxkdvvobvzcvpa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaHVmcWd4a2R2dm9idnpjdnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjg3MDEsImV4cCI6MjA4OTQwNDcwMX0.mV_9mWk8SIUEWtgB92sz4sG4Zlta5BKFaG1yjVBzlV8';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

// Custom storage adapter for Capacitor using @capacitor/preferences
const capacitorStorage = {
  getItem: async (key: string) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

// For Android/iOS apps using Capacitor, we need to handle the origin and persistence carefully.
// On Android, the origin is usually http://localhost or capacitor://localhost
const isApp = Capacitor.isNativePlatform();

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: isApp ? capacitorStorage : localStorage,
      flowType: 'pkce'
    }
  }
);
