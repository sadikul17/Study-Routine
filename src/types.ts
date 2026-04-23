import { format, startOfWeek, addDays, isSameDay, subDays, isAfter } from 'date-fns';
import { supabase } from './lib/supabase';

// Helper to check if a date is within the last 7 days
const isWithinLast7Days = (dateStr: string) => {
  const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  // We include today and the past 7 days
  return isAfter(date, sevenDaysAgo) || isSameDay(date, sevenDaysAgo);
};

export const safeParse = (json: string | null, fallback: any) => {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn('JSON parse error:', e);
    return fallback;
  }
};

export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message || String(error);
  return message === 'Failed to fetch' || 
         message.toLowerCase().includes('network') ||
         message.toLowerCase().includes('fetch');
};

export interface StudySession {
  id: string;
  user_id: string;
  subject: string;
  chapter: string;
  topics: string;
  color: string;
  icon: string;
  date: string; // ISO string or YYYY-MM-DD
  completed: boolean;
  deleted_at?: string; // ISO string
  reminder_time?: string | null; // HH:mm
  routine_id?: string;
}

export interface TimerState {
  total_seconds: number;
  time_left: number;
  is_active: boolean;
  last_saved_at: number;
}

export interface StudyTimerState {
  seconds: number;
  is_running: boolean;
  last_started_at: number | null;
  last_saved_at: number | null;
  last_updated_at: string; // YYYY-MM-DD
}

export interface StudyHistory {
  [date: string]: number; // date -> seconds
}

export interface AppSettings {
  language: 'en' | 'bn';
  dark_mode: boolean;
  notifications: boolean;
  task_notification_time: string; // HH:mm
  routine_notification_time: string; // HH:mm
  sound: boolean;
  vibration: boolean;
  auto_start: boolean;
  auto_break: boolean;
  daily_goal: number;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
}

export interface UserProfile {
  name: string;
  grade: string;
  school: string;
  avatar: string;
  email?: string;
  phone?: string;
  bio?: string;
  student_info?: string;
}

export interface RoutineItem {
  id: string;
  user_id: string;
  subject: string;
  chapter: string;
  topics?: string;
  date: string; // YYYY-MM-DD (Start Date)
  end_date?: string | null; // YYYY-MM-DD
  specific_dates?: string[] | null; // YYYY-MM-DD array
  created_at: string;
  countdown: number;
  deleted_at?: string | null; // ISO string
  reminder_time?: string | null; // HH:mm
}

export interface PrayerTime {
  name: string;
  time: string; // HH:mm
  enabled: boolean;
  isManual?: boolean;
}

export interface PrayerSettings {
  times: PrayerTime[];
  location: string;
  last_updated?: string;
}

export interface ScheduleItem {
  id: string;
  user_id: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  task: string;
  created_at: string;
}

export const storage = {
  getSessions: async (userId: string): Promise<StudySession[]> => {
    try {
      // 1. Try to get from Supabase
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const sessions = data as StudySession[];
      
      // 2. Cache all sessions locally for offline access
      localStorage.setItem(`cached_sessions_${userId}`, JSON.stringify(sessions));
      
      return sessions;
    } catch (error) {
      console.warn('Offline mode or query error (Sessions):', error);
      // 3. Fallback to local cache
      const cached = localStorage.getItem(`cached_sessions_${userId}`);
      return safeParse(cached, []);
    }
  },
  saveSession: async (userId: string, session: StudySession) => {
    // 1. Update local cache immediately
    const cacheKey = `cached_sessions_${userId}`;
    const cached = safeParse(localStorage.getItem(cacheKey), []);
    
    let newCache = [...cached.filter((s: any) => s.id !== session.id), session];
    localStorage.setItem(cacheKey, JSON.stringify(newCache));
    
    // 2. Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    
    // If there's already a pending save for this ID, update it instead of adding a new one
    // This keeps the queue smaller and more efficient
    const existingSaveIndex = pending.findIndex((p: any) => p.type === 'save' && p.data?.id === session.id);
    let newPending;
    if (existingSaveIndex !== -1) {
      newPending = [...pending];
      newPending[existingSaveIndex] = { type: 'save', data: session };
    } else {
      newPending = [...pending, { type: 'save', data: session }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      // 3. Save to Supabase in real-time
      const { error } = await supabase
        .from('sessions')
        .upsert({ ...session, user_id: userId });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== session.id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for saveSession. Session cached locally.');
      } else {
        console.error('Error saving session to Supabase (offline?):', err);
      }
    }

    // 4. Sync linked routine
    if (session.routine_id) {
      const routineId = session.routine_id;
      const routinesCacheKey = `cached_routines_${userId}`;
      const routinesCached = safeParse(localStorage.getItem(routinesCacheKey), []);
      const linkedRoutine = routinesCached.find((r: any) => r.id === routineId);
      
      if (linkedRoutine) {
        const updatedRoutine = {
          ...linkedRoutine,
          subject: session.subject,
          chapter: session.chapter,
          topics: session.topics,
          reminder_time: session.reminder_time
        };
        
        const newRoutinesCache = routinesCached.map((r: any) => 
          r.id === routineId ? updatedRoutine : r
        );
        localStorage.setItem(routinesCacheKey, JSON.stringify(newRoutinesCache));
        
        // Also update in Supabase
        if (userId && userId !== 'guest_user') {
          try {
            await supabase.from('routines').upsert(updatedRoutine);
          } catch (err) {
            console.error('Error syncing linked routine:', err);
          }
        }

        // Also update OTHER sessions linked to this routine
        const sessionsCacheKey = `cached_sessions_${userId}`;
        const sessionsCached = safeParse(localStorage.getItem(sessionsCacheKey), []);
        const otherLinkedSessions = sessionsCached.filter((s: any) => s.routine_id === routineId && s.id !== session.id);
        
        if (otherLinkedSessions.length > 0) {
          const updatedSessions = sessionsCached.map((s: any) => {
            if (s.routine_id === routineId && s.id !== session.id) {
              return {
                ...s,
                subject: session.subject,
                chapter: session.chapter,
                topics: session.topics,
                reminder_time: session.reminder_time
              };
            }
            return s;
          });
          localStorage.setItem(sessionsCacheKey, JSON.stringify(updatedSessions));
          
          // Also update in Supabase
          if (userId && userId !== 'guest_user') {
            try {
              const sessionsToUpdate = updatedSessions.filter((s: any) => s.routine_id === routineId && s.id !== session.id);
              const { error: syncError } = await supabase
                .from('sessions')
                .upsert(sessionsToUpdate.map(s => ({ ...s, user_id: userId })));
              
              if (syncError) throw syncError;
            } catch (err) {
              console.error('Error syncing other linked sessions:', err);
            }
          }
        }
      }
    }
  },
  saveSessions: async (userId: string, sessions: StudySession[]) => {
    // Bulk save
    // 1. Update local cache
    const cacheKey = `cached_sessions_${userId}`;
    const cached = safeParse(localStorage.getItem(cacheKey), []);
    const newCache = [
      ...cached.filter((s: any) => !sessions.some(ns => ns.id === s.id)),
      ...sessions
    ];
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // 2. Add to pending sync for all sessions
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const newPending = [
      ...pending.filter((p: any) => !sessions.some(s => s.id === (p.id || p.data?.id))),
      ...sessions.map(s => ({ type: 'save', data: s }))
    ];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      // 3. Save to Supabase in real-time
      const { error } = await supabase
        .from('sessions')
        .upsert(sessions.map(s => ({ ...s, user_id: userId })));
      
      if (error) throw error;

      // Remove from pending if successful
      const updatedPending = safeParse(localStorage.getItem(pendingKey), [])
        .filter((p: any) => !sessions.some(s => s.id === (p.id || p.data?.id)));
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for saveSessions. Sessions cached locally.');
      } else {
        console.error('Error saving sessions to Supabase:', err);
      }
    }
  },
  toggleSession: async (userId: string, id: string, completed: boolean) => {
    // Update local cache
    const cacheKey = `cached_sessions_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = cached.map((s: any) => s.id === id ? { ...s, completed } : s);
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    // If there's a pending save, update it directly
    const existingSaveIndex = pending.findIndex((p: any) => p.type === 'save' && p.data?.id === id);
    let newPending;
    if (existingSaveIndex !== -1) {
      newPending = [...pending];
      newPending[existingSaveIndex] = { 
        ...newPending[existingSaveIndex], 
        data: { ...newPending[existingSaveIndex].data, completed } 
      };
    } else {
      // Otherwise, add a toggle operation
      newPending = [...pending, { type: 'toggle', id, completed }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ completed })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for toggleSession. Change cached locally.');
      } else {
        console.error('Error toggling session (offline?):', err);
      }
    }
  },
  deleteSession: async (userId: string, id: string) => {
    const deleted_at = new Date().toISOString();
    
    // 1. Update local cache
    const cacheKey = `cached_sessions_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const sessionToDelete = cached.find((s: any) => s.id === id);
    
    if (sessionToDelete) {
      const newCache = cached.filter((s: any) => s.id !== id);
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      
      // Add to local trash cache
      const trashKey = `cached_trash_${userId}`;
      const trashCached = JSON.parse(localStorage.getItem(trashKey) || '[]');
      const newTrashCache = [{ ...sessionToDelete, deleted_at }, ...trashCached];
      localStorage.setItem(trashKey, JSON.stringify(newTrashCache));
    }

    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    // If there's a pending save, update it to be deleted immediately
    const existingSaveIndex = pending.findIndex((p: any) => p.type === 'save' && p.data?.id === id);
    let newPending;
    if (existingSaveIndex !== -1) {
      newPending = [...pending];
      newPending[existingSaveIndex] = { 
        ...newPending[existingSaveIndex], 
        data: { ...newPending[existingSaveIndex].data, deleted_at } 
      };
    } else {
      newPending = [...pending, { type: 'delete', id, deleted_at }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ deleted_at })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for deleteSession. Change cached locally.');
      } else {
        console.error('Error deleting session (offline?):', err);
      }
    }
  },
  getTrash: async (userId: string): Promise<StudySession[]> => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      
      const trash = data as StudySession[];

      // Cache all trash locally
      localStorage.setItem(`cached_trash_${userId}`, JSON.stringify(trash));
      
      return trash;
    } catch (error) {
      console.warn('Offline mode or query error (Trash):', error);
      const trashKey = `cached_trash_${userId}`;
      const cached = localStorage.getItem(trashKey);
      return safeParse(cached, []);
    }
  },
  restoreFromTrash: async (userId: string, id: string) => {
    // Update local cache
    const trashKey = `cached_trash_${userId}`;
    const trashCached = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const sessionToRestore = trashCached.find((s: any) => s.id === id);
    
    if (sessionToRestore) {
      const newTrashCache = trashCached.filter((s: any) => s.id !== id);
      localStorage.setItem(trashKey, JSON.stringify(newTrashCache));
      
      const cacheKey = `cached_sessions_${userId}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      const newCache = [{ ...sessionToRestore, deleted_at: null }, ...cached];
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
    }

    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const newPending = [...pending.filter((p: any) => (p.id || p.data?.id) !== id), { type: 'restore', id }];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for restoreFromTrash. Change cached locally.');
      } else {
        console.error('Error restoring session (offline?):', err);
      }
    }
  },
  permanentlyDelete: async (userId: string, id: string) => {
    // Update local cache
    const trashKey = `cached_trash_${userId}`;
    const trashCached = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const newTrashCache = trashCached.filter((s: any) => s.id !== id);
    localStorage.setItem(trashKey, JSON.stringify(newTrashCache));

    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const newPending = [...pending.filter((p: any) => (p.id || p.data?.id) !== id), { type: 'permanent_delete', id }];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for permanentlyDelete. Change cached locally.');
      } else {
        console.error('Error permanently deleting session (offline?):', err);
      }
    }
  },
  getSettings: async (userId: string): Promise<AppSettings> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'app')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
      
      if (data) {
        localStorage.setItem(`cached_settings_${userId}`, JSON.stringify(data.settings));
        return data.settings as AppSettings;
      }
      return {
        language: 'en',
        dark_mode: true,
        notifications: true,
        task_notification_time: '08:00',
        routine_notification_time: '09:00',
        sound: true,
        vibration: true,
        auto_start: false,
        auto_break: false,
        daily_goal: 8,
        work_duration: 25,
        break_duration: 5,
        long_break_duration: 15,
        long_break_interval: 4
      };
    } catch (error) {
      console.warn('Offline mode or query error in getSettings:', error);
      const cached = localStorage.getItem(`cached_settings_${userId}`);
      return cached ? JSON.parse(cached) : {
        language: 'en',
        dark_mode: true,
        notifications: true,
        task_notification_time: '08:00',
        routine_notification_time: '09:00',
        sound: true,
        vibration: true,
        auto_start: false,
        auto_break: false,
        daily_goal: 8,
        work_duration: 25,
        break_duration: 5,
        long_break_duration: 15,
        long_break_interval: 4
      };
    }
  },
  saveSettings: async (userId: string, settings: AppSettings) => {
    localStorage.setItem(`cached_settings_${userId}`, JSON.stringify(settings));
    
    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_settings');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_settings', data: settings };
    } else {
      newPending = [...pending, { type: 'save_settings', data: settings }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'app', settings: settings }, { onConflict: 'user_id,type' });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_settings');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for saveSettings. Settings cached locally.');
      } else {
        console.error('Error saving settings:', err);
      }
    }
  },
  getPrayerSettings: async (userId: string): Promise<PrayerSettings> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'prayer')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        localStorage.setItem(`cached_prayer_settings_${userId}`, JSON.stringify(data.settings));
        return data.settings as PrayerSettings;
      }
      
      const defaultSettings: PrayerSettings = {
        times: [
          { name: 'Fajr', time: '04:30', enabled: true },
          { name: 'Dhuhr', time: '12:15', enabled: true },
          { name: 'Asr', time: '16:30', enabled: true },
          { name: 'Maghrib', time: '18:15', enabled: true },
          { name: 'Isha', time: '19:45', enabled: true },
          { name: 'Tahajjud', time: '03:00', enabled: true },
          { name: 'Gym', time: '07:00', enabled: true },
        ],
        location: 'Sherpur, Bogura'
      };
      return defaultSettings;
    } catch (error) {
      console.warn('Offline mode or query error in getPrayerSettings:', error);
      const cached = localStorage.getItem(`cached_prayer_settings_${userId}`);
      return cached ? JSON.parse(cached) : {
        times: [
          { name: 'Fajr', time: '04:30', enabled: true },
          { name: 'Dhuhr', time: '12:15', enabled: true },
          { name: 'Asr', time: '16:30', enabled: true },
          { name: 'Maghrib', time: '18:15', enabled: true },
          { name: 'Isha', time: '19:45', enabled: true },
          { name: 'Tahajjud', time: '03:00', enabled: true },
          { name: 'Gym', time: '07:00', enabled: true },
        ],
        location: 'Sherpur, Bogura'
      };
    }
  },
  savePrayerSettings: async (userId: string, settings: PrayerSettings) => {
    localStorage.setItem(`cached_prayer_settings_${userId}`, JSON.stringify(settings));
    
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_prayer_settings');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_prayer_settings', data: settings };
    } else {
      newPending = [...pending, { type: 'save_prayer_settings', data: settings }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    if (!userId || userId === 'guest_user') return;

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'prayer', settings: settings }, { onConflict: 'user_id,type' });
      
      if (error) throw error;
      
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_prayer_settings');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err: any) {
      console.error('Error saving prayer settings:', err);
    }
  },
  getSchedules: async (userId: string): Promise<ScheduleItem[]> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'schedules')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      const schedules = data ? (data.settings as ScheduleItem[]) : [];
      localStorage.setItem(`cached_schedules_${userId}`, JSON.stringify(schedules));
      return schedules;
    } catch (error) {
      console.warn('Offline mode or query error (Schedules):', error);
      const cached = localStorage.getItem(`cached_schedules_${userId}`);
      return safeParse(cached, []);
    }
  },
  saveSchedule: async (userId: string, schedule: ScheduleItem) => {
    const cacheKey = `cached_schedules_${userId}`;
    const cached = safeParse(localStorage.getItem(cacheKey), []);
    const newSchedules = [...cached.filter((s: any) => s.id !== schedule.id), schedule];
    localStorage.setItem(cacheKey, JSON.stringify(newSchedules));
    
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_schedules');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_schedules', data: newSchedules };
    } else {
      newPending = [...pending, { type: 'save_schedules', data: newSchedules }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    if (!userId || userId === 'guest_user') return;

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'schedules', settings: newSchedules }, { onConflict: 'user_id,type' });
      
      if (error) throw error;
      
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_schedules');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving schedules to Supabase:', err);
    }
  },
  deleteSchedule: async (userId: string, id: string) => {
    const cacheKey = `cached_schedules_${userId}`;
    const cached = safeParse(localStorage.getItem(cacheKey), []);
    const newSchedules = cached.filter((s: any) => s.id !== id);
    localStorage.setItem(cacheKey, JSON.stringify(newSchedules));

    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_schedules');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_schedules', data: newSchedules };
    } else {
      newPending = [...pending, { type: 'save_schedules', data: newSchedules }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    if (!userId || userId === 'guest_user') return;

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'schedules', settings: newSchedules }, { onConflict: 'user_id,type' });
      
      if (error) throw error;
      
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_schedules');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error deleting schedule from Supabase:', err);
    }
  },
  getTimer: async (userId: string): Promise<TimerState | null> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'timer')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        localStorage.setItem(`cached_timer_${userId}`, JSON.stringify(data.settings));
        return data.settings as TimerState;
      }
      return null;
    } catch (error) {
      console.warn('Offline mode or query error in getTimer:', error);
      const cached = localStorage.getItem(`cached_timer_${userId}`);
      return cached ? JSON.parse(cached) : null;
    }
  },
  saveTimer: async (userId: string, timer: TimerState) => {
    localStorage.setItem(`cached_timer_${userId}`, JSON.stringify(timer));
    
    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_timer');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_timer', data: timer };
    } else {
      newPending = [...pending, { type: 'save_timer', data: timer }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // CRITICAL: Ensure we have a valid authenticated user ID before syncing to Supabase
    if (!userId || userId === 'guest_user') {
      return;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'timer', settings: timer }, { onConflict: 'user_id,type' });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_timer');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for saveTimer. Timer cached locally.');
      } else {
        console.error('Error saving timer:', err);
      }
    }
  },
  getStudyTimer: async (userId: string): Promise<StudyTimerState | null> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'study_timer')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        localStorage.setItem(`cached_study_timer_${userId}`, JSON.stringify(data.settings));
        return data.settings as StudyTimerState;
      }
      return null;
    } catch (error) {
      const cached = localStorage.getItem(`cached_study_timer_${userId}`);
      return cached ? JSON.parse(cached) : null;
    }
  },
  saveStudyTimer: async (userId: string, timer: StudyTimerState) => {
    localStorage.setItem(`cached_study_timer_${userId}`, JSON.stringify(timer));
    if (!userId || userId === 'guest_user') return;
    try {
      await supabase.from('settings').upsert({ user_id: userId, type: 'study_timer', settings: timer }, { onConflict: 'user_id,type' });
    } catch (err) {
      console.error('Error saving study timer:', err);
    }
  },
  getStudyHistory: async (userId: string): Promise<StudyHistory> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'study_history')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        localStorage.setItem(`cached_study_history_${userId}`, JSON.stringify(data.settings));
        return data.settings as StudyHistory;
      }
      return {};
    } catch (error) {
      const cached = localStorage.getItem(`cached_study_history_${userId}`);
      return cached ? JSON.parse(cached) : {};
    }
  },
  saveStudyHistory: async (userId: string, history: StudyHistory) => {
    localStorage.setItem(`cached_study_history_${userId}`, JSON.stringify(history));
    if (!userId || userId === 'guest_user') return;
    try {
      await supabase.from('settings').upsert({ user_id: userId, type: 'study_history', settings: history }, { onConflict: 'user_id,type' });
    } catch (err) {
      console.error('Error saving study history:', err);
    }
  },
  getFocusTime: async (userId: string): Promise<StudyHistory> => {
    try {
      const { data, error } = await supabase
        .from('study_focus')
        .select('date, seconds')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const focusData: StudyHistory = {};
      data.forEach((row: any) => {
        focusData[row.date] = row.seconds;
      });
      
      localStorage.setItem(`cached_focus_time_${userId}`, JSON.stringify(focusData));
      return focusData;
    } catch (error) {
      console.warn('Offline mode or query error (FocusTime):', error);
      const cached = localStorage.getItem(`cached_focus_time_${userId}`);
      return safeParse(cached, {});
    }
  },
  saveFocusTime: async (userId: string, date: string, seconds: number) => {
    // 1. Update local cache
    const cacheKey = `cached_focus_time_${userId}`;
    const cached = safeParse(localStorage.getItem(cacheKey), {});
    cached[date] = seconds;
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    
    // 2. Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    
    // Update existing pending save for this date if it exists
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_focus_time' && p.data?.date === date);
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_focus_time', data: { date, seconds } };
    } else {
      newPending = [...pending, { type: 'save_focus_time', data: { date, seconds } }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    if (!userId || userId === 'guest_user') return;

    try {
      // 3. Save to Supabase
      const { error } = await supabase
        .from('study_focus')
        .upsert({ user_id: userId, date, seconds }, { onConflict: 'user_id,date' });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = safeParse(localStorage.getItem(pendingKey), [])
        .filter((p: any) => !(p.type === 'save_focus_time' && p.data?.date === date));
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving focus time to Supabase:', err);
    }
  },
  getProfile: async (userId: string): Promise<UserProfile> => {
    console.log('[Storage] Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Storage] Profile fetch error:', error);
        throw error;
      }
      
      if (data) {
        console.log('[Storage] Profile found in Supabase:', data);
        localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(data));
        return data as UserProfile;
      }
      console.log('[Storage] No profile found, using default');
      return { name: 'Student', grade: 'Grade 10', school: 'Your School', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' };
    } catch (error) {
      console.warn('[Storage] Offline mode or query error (Profile):', error);
      const cached = localStorage.getItem(`cached_profile_${userId}`);
      return cached ? JSON.parse(cached) : { name: 'Student', grade: 'Grade 10', school: 'Your School', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' };
    }
  },
  saveProfile: async (userId: string, profile: UserProfile) => {
    // CRITICAL: Ensure we have a valid authenticated user ID
    if (!userId || userId === 'guest_user') {
      console.warn('[Storage] Skipping Supabase sync: User is in Guest Mode or ID is invalid.');
      localStorage.setItem('cached_profile_guest_user', JSON.stringify(profile));
      return;
    }

    console.log(`[Storage] Attempting to sync profile for UNIQUE User ID: ${userId}`);
    localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
    
    // Add to pending sync queue
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    const existingIndex = pending.findIndex((p: any) => p.type === 'save_profile');
    let newPending;
    if (existingIndex !== -1) {
      newPending = [...pending];
      newPending[existingIndex] = { type: 'save_profile', data: profile };
    } else {
      newPending = [...pending, { type: 'save_profile', data: profile }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    try {
      // Use upsert with explicit onConflict: 'user_id' to ensure separate rows per user
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          { 
            user_id: userId, 
            ...profile, 
            updated_at: new Date().toISOString() 
          },
          { onConflict: 'user_id' }
        )
        .select();
      
      if (error) {
        console.error(`[Storage] Supabase Sync ERROR for user ${userId}:`, error.message);
        throw error;
      }
      
      console.log(`[Storage] SUCCESS: Profile synced for user ${userId}. Row data:`, data);
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_profile');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error(`[Storage] Critical Sync Failure for user ${userId}:`, err);
    }
  },
  syncOfflineData: async (userId: string) => {
    // CRITICAL: Return early if guest or offline
    if (!userId || userId === 'guest_user') return;
    
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Storage] Device is offline. Skipping sync.');
      return;
    }

    console.log('[Storage] Syncing offline data for user:', userId);
    const pendingKey = `pending_sync_${userId}`;
    const pending = safeParse(localStorage.getItem(pendingKey), []);
    
    if (pending.length === 0) {
      console.log('[Storage] No pending changes to sync.');
      return;
    }

    console.log(`[Storage] Processing ${pending.length} pending changes...`);
    
    // Process one by one to ensure reliability
    const remainingPending = [...pending];
    for (const change of pending) {
      try {
        let error;
        if (change.type === 'save') {
          ({ error } = await supabase.from('sessions').upsert({ ...change.data, user_id: userId }));
        } else if (change.type === 'toggle') {
          ({ error } = await supabase.from('sessions').update({ completed: change.completed }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'delete') {
          ({ error } = await supabase.from('sessions').update({ deleted_at: change.deleted_at }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'restore') {
          ({ error } = await supabase.from('sessions').update({ deleted_at: null }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'permanent_delete') {
          ({ error } = await supabase.from('sessions').delete().eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'permanent_delete_routine') {
          ({ error } = await supabase.from('routines').delete().eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'save_routine') {
          const routineData = change.data;
          let { error: routineError } = await supabase.from('routines').upsert({ ...routineData, user_id: userId });
          
          // Fallback for missing column
          if (routineError && routineError.message?.includes("Could not find the 'specific_dates' column")) {
            const fallbackData = {
              ...routineData,
              topics: `__JSON_FALLBACK__:${JSON.stringify({
                topics: routineData.topics,
                specific_dates: routineData.specific_dates
              })}`,
              specific_dates: undefined
            };
            ({ error: routineError } = await supabase.from('routines').upsert({ ...fallbackData, user_id: userId }));
          }
          error = routineError;
        } else if (change.type === 'delete_routine') {
          ({ error } = await supabase.from('routines').update({ deleted_at: change.deleted_at }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'restore_routine') {
          ({ error } = await supabase.from('routines').update({ deleted_at: null }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'save_settings') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'app', settings: change.data }, { onConflict: 'user_id,type' }));
        } else if (change.type === 'save_timer') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'timer', settings: change.data }, { onConflict: 'user_id,type' }));
        } else if (change.type === 'save_prayer_settings') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'prayer', settings: change.data }, { onConflict: 'user_id,type' }));
        } else if (change.type === 'save_schedules') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'schedules', settings: change.data }, { onConflict: 'user_id,type' }));
        } else if (change.type === 'save_profile') {
          ({ error } = await supabase.from('profiles').upsert({ ...change.data, user_id: userId }, { onConflict: 'user_id' }));
        } else if (change.type === 'save_focus_time') {
          const { date, seconds } = change.data;
          ({ error } = await supabase.from('study_focus').upsert({ user_id: userId, date, seconds }, { onConflict: 'user_id,date' }));
        }
        
        if (!error) {
          // Remove this specific change from the list
          const index = remainingPending.findIndex(p => 
            (p.id === (change.id || change.data?.id)) && p.type === change.type
          );
          if (index !== -1) {
            remainingPending.splice(index, 1);
            localStorage.setItem(pendingKey, JSON.stringify(remainingPending));
          }
        } else {
          if (isNetworkError(error)) {
            console.log(`[Storage] Network unavailable for ${change.type}. Stopping sync queue.`);
            break;
          } else {
            console.error(`[Storage] Sync error for ${change.type}:`, error.message);
          }
        }
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.log(`[Storage] Network error in catch for ${change.type}. Stopping sync queue.`);
          break;
        } else {
          console.error('[Storage] Sync failed for change:', change, err);
        }
      }
    }
  },
  syncGuestData: async (newUserId: string) => {
    const guestUserId = 'guest_user';
    console.log('Syncing guest data to new user:', newUserId);
    
    try {
      // 1. Get guest sessions from local storage
      const guestSessionsKey = `cached_sessions_${guestUserId}`;
      const guestTrashKey = `cached_trash_${guestUserId}`;
      const guestSettingsKey = `cached_settings_${guestUserId}`;
      const guestProfileKey = `cached_profile_${guestUserId}`;
      const guestRoutinesKey = `cached_routines_${guestUserId}`;
      const guestSchedulesKey = `cached_schedules_${guestUserId}`;

      const guestSessions = safeParse(localStorage.getItem(guestSessionsKey), []);
      const guestTrash = safeParse(localStorage.getItem(guestTrashKey), []);
      const guestSettings = safeParse(localStorage.getItem(guestSettingsKey), null);
      const guestProfile = safeParse(localStorage.getItem(guestProfileKey), null);
      const guestRoutines = safeParse(localStorage.getItem(guestRoutinesKey), []);
      const guestSchedules = safeParse(localStorage.getItem(guestSchedulesKey), []);

      // 2. Sync sessions
      if (guestSessions.length > 0 || guestTrash.length > 0) {
        const allSessions = [...guestSessions, ...guestTrash].map(s => ({
          ...s,
          user_id: newUserId
        }));
        
        const { error } = await supabase.from('sessions').upsert(allSessions);
        if (error) console.error('Error syncing guest sessions:', error);
      }

      // 3. Sync routines
      if (guestRoutines.length > 0) {
        const allRoutines = guestRoutines.map((r: any) => ({
          ...r,
          user_id: newUserId
        }));
        const { error } = await supabase.from('routines').upsert(allRoutines);
        if (error) console.error('Error syncing guest routines:', error);
      }

      // 4. Sync settings
      if (guestSettings) {
        await supabase.from('settings').upsert({ user_id: newUserId, type: 'app', settings: guestSettings }, { onConflict: 'user_id,type' });
      }

      // 5. Sync profile
      if (guestProfile) {
        await supabase.from('profiles').upsert({ ...guestProfile, user_id: newUserId }, { onConflict: 'user_id' });
      }

      // 6. Sync schedules
      if (guestSchedules.length > 0) {
        await supabase.from('settings').upsert({ user_id: newUserId, type: 'schedules', settings: guestSchedules }, { onConflict: 'user_id,type' });
      }

      // 6. Clear guest data
      localStorage.removeItem(guestSessionsKey);
      localStorage.removeItem(guestTrashKey);
      localStorage.removeItem(guestSettingsKey);
      localStorage.removeItem(guestProfileKey);
      localStorage.removeItem(guestRoutinesKey);
      localStorage.removeItem(`pending_sync_${guestUserId}`);
      
      console.log('Guest data sync complete');
    } catch (err) {
      console.error('Failed to sync guest data:', err);
    }
  },
  cleanupLocalCache: (userId: string) => {
    // No longer pruning local storage to ensure data persistence across uninstalls
    console.log('Local cache cleanup skipped to preserve all data for user:', userId);
  },
  fullSync: async (userId: string) => {
    console.log('[Storage] Full sync triggered for user:', userId);
    try {
      // 1. Sync pending changes first
      await storage.syncOfflineData(userId);

      // 2. Fetch latest data from Supabase to ensure we have everything
      const [sessionsData, trashData, routinesData, settingsData, profileData, timerData, schedulesData] = await Promise.all([
        storage.getSessions(userId),
        storage.getTrash(userId),
        storage.getRoutines(userId),
        storage.getSettings(userId),
        storage.getProfile(userId),
        storage.getTimer(userId),
        storage.getSchedules(userId)
      ]);

      // 3. Get all local data
      const localSessions = safeParse(localStorage.getItem(`cached_sessions_${userId}`), []);
      const localTrash = safeParse(localStorage.getItem(`cached_trash_${userId}`), []);
      const localRoutines = safeParse(localStorage.getItem(`cached_routines_${userId}`), []);
      const localSettings = safeParse(localStorage.getItem(`cached_settings_${userId}`), null);
      const localProfile = safeParse(localStorage.getItem(`cached_profile_${userId}`), null);
      const localTimer = safeParse(localStorage.getItem(`cached_timer_${userId}`), null);
      const localSchedules = safeParse(localStorage.getItem(`cached_schedules_${userId}`), []);

      // 4. Merge and Push to Supabase (if local has something new)
      // This is a safety measure to ensure local data is also pushed
      if (localSessions.length > 0 || localTrash.length > 0) {
        const allSessions = [...localSessions, ...localTrash].map(s => ({ ...s, user_id: userId }));
        await supabase.from('sessions').upsert(allSessions);
      }
      if (localRoutines.length > 0) {
        const allRoutines = localRoutines.map((r: any) => ({ ...r, user_id: userId }));
        const { error: routineError } = await supabase.from('routines').upsert(allRoutines);
        
        if (routineError && routineError.message?.includes("Could not find the 'specific_dates' column")) {
          const fallbackRoutines = allRoutines.map((r: any) => ({
            ...r,
            topics: `__JSON_FALLBACK__:${JSON.stringify({
              topics: r.topics,
              specific_dates: r.specific_dates
            })}`,
            specific_dates: undefined
          }));
          await supabase.from('routines').upsert(fallbackRoutines);
        }
      }
      if (localSettings) {
        await supabase.from('settings').upsert({ user_id: userId, type: 'app', settings: localSettings }, { onConflict: 'user_id,type' });
      }
      if (localProfile) {
        await supabase.from('profiles').upsert({ ...localProfile, user_id: userId }, { onConflict: 'user_id' });
      }
      if (localTimer) {
        await supabase.from('settings').upsert({ user_id: userId, type: 'timer', settings: localTimer }, { onConflict: 'user_id,type' });
      }
      if (localSchedules.length > 0) {
        await supabase.from('settings').upsert({ user_id: userId, type: 'schedules', settings: localSchedules }, { onConflict: 'user_id,type' });
      }
      
      console.log('[Storage] Full sync complete');
      return true;
    } catch (err) {
      console.error('[Storage] Full sync failed:', err);
      return false;
    }
  },
  getRoutines: async (userId: string): Promise<RoutineItem[]> => {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const routines = (data || []).map(r => {
        let specific_dates = r.specific_dates;
        let topics = r.topics;

        // Check if topics contains the JSON fallback for missing column
        if (topics && typeof topics === 'string' && topics.startsWith('__JSON_FALLBACK__:')) {
          try {
            const fallback = JSON.parse(topics.replace('__JSON_FALLBACK__:', ''));
            topics = fallback.topics;
            specific_dates = fallback.specific_dates;
          } catch (e) {
            console.error('Error parsing routine fallback:', e);
          }
        }

        return {
          ...r,
          topics,
          specific_dates
        } as RoutineItem;
      });

      // Cache routines locally
      localStorage.setItem(`cached_routines_${userId}`, JSON.stringify(routines));
      return routines;
    } catch (error) {
      console.warn('Offline mode or query error (Routines):', error);
      const cached = localStorage.getItem(`cached_routines_${userId}`);
      return safeParse(cached, []);
    }
  },
  saveRoutine: async (userId: string, routine: Partial<RoutineItem>) => {
    const routineId = routine.id || (typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    
    // 1. Get existing routine from cache for merging
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const existing = cached.find((r: any) => r.id === routineId);

    const fullRoutine: RoutineItem = {
      id: routineId,
      user_id: userId,
      subject: routine.subject ?? existing?.subject ?? '',
      chapter: routine.chapter ?? existing?.chapter ?? '',
      topics: routine.topics ?? existing?.topics ?? '',
      date: routine.date ?? existing?.date ?? format(new Date(), 'yyyy-MM-dd'),
      end_date: routine.end_date !== undefined ? routine.end_date : (existing?.end_date ?? null),
      specific_dates: routine.specific_dates !== undefined ? routine.specific_dates : (existing?.specific_dates ?? null),
      reminder_time: routine.reminder_time !== undefined ? routine.reminder_time : (existing?.reminder_time ?? null),
      created_at: routine.created_at ?? existing?.created_at ?? new Date().toISOString(),
      countdown: routine.countdown ?? existing?.countdown ?? 0,
      deleted_at: routine.deleted_at ?? existing?.deleted_at ?? null
    };

    // 2. Update local cache immediately
    let newCache = [...cached.filter((r: any) => r.id !== routineId), fullRoutine];
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // 3. Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    const existingSaveIndex = pending.findIndex((p: any) => p.type === 'save_routine' && p.data?.id === routineId);
    let newPending;
    if (existingSaveIndex !== -1) {
      newPending = [...pending];
      newPending[existingSaveIndex] = { type: 'save_routine', data: fullRoutine };
    } else {
      newPending = [...pending, { type: 'save_routine', data: fullRoutine }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    // 4. Save to Supabase in real-time
    try {
      const { error } = await supabase
        .from('routines')
        .upsert(fullRoutine);
      
      if (error) {
        // Handle missing column error by using a fallback in the topics field
        if (error.message?.includes("Could not find the 'specific_dates' column")) {
          console.warn('[Storage] specific_dates column missing in Supabase. Using fallback in topics field.');
          const fallbackRoutine = {
            ...fullRoutine,
            topics: `__JSON_FALLBACK__:${JSON.stringify({
              topics: fullRoutine.topics,
              specific_dates: fullRoutine.specific_dates
            })}`,
            specific_dates: undefined // Remove the problematic field
          };
          
          const { error: fallbackError } = await supabase
            .from('routines')
            .upsert(fallbackRoutine);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== routineId);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for saveRoutine. Routine cached locally.');
      } else {
        console.error('Error saving routine to Supabase:', err);
      }
    }

    // 5. Sync linked sessions
    const sessionsCacheKey = `cached_sessions_${userId}`;
    const sessionsCached = safeParse(localStorage.getItem(sessionsCacheKey), []);
    const linkedSessions = sessionsCached.filter((s: any) => s.routine_id === routineId);
    
    if (linkedSessions.length > 0) {
      const updatedSessions = sessionsCached.map((s: any) => {
        if (s.routine_id === routineId) {
          return {
            ...s,
            subject: fullRoutine.subject,
            chapter: fullRoutine.chapter,
            topics: fullRoutine.topics,
            reminder_time: fullRoutine.reminder_time
          };
        }
        return s;
      });
      localStorage.setItem(sessionsCacheKey, JSON.stringify(updatedSessions));
      
      // Also update in Supabase
      if (userId && userId !== 'guest_user') {
        try {
          const sessionsToUpdate = updatedSessions.filter((s: any) => s.routine_id === routineId);
          const { error: syncError } = await supabase
            .from('sessions')
            .upsert(sessionsToUpdate.map(s => ({ ...s, user_id: userId })));
          
          if (syncError) throw syncError;
        } catch (err) {
          console.error('Error syncing linked sessions:', err);
        }
      }
    }
  },
  deleteRoutine: async (userId: string, id: string) => {
    const deleted_at = new Date().toISOString();
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const routineToDelete = cached.find((r: any) => r.id === id);
    
    if (routineToDelete) {
      const newCache = cached.map((r: any) => r.id === id ? { ...r, deleted_at } : r);
      localStorage.setItem(cacheKey, JSON.stringify(newCache));

      // Sync linked sessions
      const sessionsCacheKey = `cached_sessions_${userId}`;
      const sessionsCached = safeParse(localStorage.getItem(sessionsCacheKey), []);
      const linkedSessions = sessionsCached.filter((s: any) => s.routine_id === id);
      
      if (linkedSessions.length > 0) {
        const updatedSessions = sessionsCached.map((s: any) => {
          if (s.routine_id === id) {
            return { ...s, deleted_at };
          }
          return s;
        });
        localStorage.setItem(sessionsCacheKey, JSON.stringify(updatedSessions));
        
        if (userId && userId !== 'guest_user') {
          try {
            const sessionsToUpdate = updatedSessions.filter((s: any) => s.routine_id === id);
            await Promise.all(sessionsToUpdate.map(async (s: any) => {
              await supabase.from('sessions').upsert({ ...s, user_id: userId });
            }));
          } catch (err) {
            console.error('Error syncing deleted sessions:', err);
          }
        }
      }
    }

    // Add to pending sync
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    const existingSaveIndex = pending.findIndex((p: any) => p.type === 'save_routine' && p.data?.id === id);
    let newPending;
    if (existingSaveIndex !== -1) {
      newPending = [...pending];
      newPending[existingSaveIndex] = { 
        ...newPending[existingSaveIndex], 
        data: { ...newPending[existingSaveIndex].data, deleted_at } 
      };
    } else {
      newPending = [...pending, { type: 'delete_routine', id, deleted_at }];
    }
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    try {
      const { error } = await supabase
        .from('routines')
        .update({ deleted_at })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;

      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for deleteRoutine. Change cached locally.');
      } else {
        console.error('Error deleting routine:', err);
      }
    }
  },
  restoreRoutine: async (userId: string, id: string) => {
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = cached.map((r: any) => r.id === id ? { ...r, deleted_at: null } : r);
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // Sync linked sessions
    const sessionsCacheKey = `cached_sessions_${userId}`;
    const sessionsCached = safeParse(localStorage.getItem(sessionsCacheKey), []);
    const linkedSessions = sessionsCached.filter((s: any) => s.routine_id === id);
    
    if (linkedSessions.length > 0) {
      const updatedSessions = sessionsCached.map((s: any) => {
        if (s.routine_id === id) {
          return { ...s, deleted_at: null };
        }
        return s;
      });
      localStorage.setItem(sessionsCacheKey, JSON.stringify(updatedSessions));
      
      if (userId && userId !== 'guest_user') {
        try {
          const sessionsToUpdate = updatedSessions.filter((s: any) => s.routine_id === id);
          await Promise.all(sessionsToUpdate.map(async (s: any) => {
            await supabase.from('sessions').upsert({ ...s, user_id: userId });
          }));
        } catch (err) {
          console.error('Error syncing restored sessions:', err);
        }
      }
    }

    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const newPending = [...pending.filter((p: any) => (p.id || p.data?.id) !== id), { type: 'restore_routine', id }];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    try {
      const { error } = await supabase
        .from('routines')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for restoreRoutine. Change cached locally.');
      } else {
        console.error('Error restoring routine:', err);
      }
    }
  },
  permanentlyDeleteRoutine: async (userId: string, id: string) => {
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = cached.filter((r: any) => r.id !== id);
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // Sync linked sessions
    const sessionsCacheKey = `cached_sessions_${userId}`;
    const sessionsCached = safeParse(localStorage.getItem(sessionsCacheKey), []);
    const linkedSessions = sessionsCached.filter((s: any) => s.routine_id === id);
    
    if (linkedSessions.length > 0) {
      const updatedSessions = sessionsCached.filter((s: any) => s.routine_id !== id);
      localStorage.setItem(sessionsCacheKey, JSON.stringify(updatedSessions));
      
      if (userId && userId !== 'guest_user') {
        try {
          await supabase.from('sessions').delete().eq('routine_id', id).eq('user_id', userId);
        } catch (err) {
          console.error('Error syncing permanently deleted sessions:', err);
        }
      }
    }

    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const newPending = [...pending.filter((p: any) => (p.id || p.data?.id) !== id), { type: 'permanent_delete_routine', id }];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    try {
      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== id);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[Storage] Network unavailable for permanentlyDeleteRoutine. Change cached locally.');
      } else {
        console.error('Error permanently deleting routine:', err);
      }
    }
  }
};

export const getWeekDays = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};
