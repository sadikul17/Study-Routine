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
  reminder_time?: string; // HH:mm
}

export interface TimerState {
  total_seconds: number;
  time_left: number;
  is_active: boolean;
  last_saved_at: number;
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
  end_date?: string; // YYYY-MM-DD
  created_at: string;
  countdown: number;
  deleted_at?: string; // ISO string
  reminder_time?: string; // HH:mm
}

export const storage = {
  getSessions: async (userId: string): Promise<StudySession[]> => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const sessions = data as StudySession[];
      
      // Cache only last 7 days sessions locally for offline access
      const prunedSessions = sessions.filter(s => isWithinLast7Days(s.date));
      localStorage.setItem(`cached_sessions_${userId}`, JSON.stringify(prunedSessions));
      
      return sessions;
    } catch (error) {
      console.warn('Offline mode or query error (Sessions):', error);
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
      console.error('Error saving session to Supabase (offline?):', err);
    }
  },
  saveSessions: async (userId: string, sessions: StudySession[]) => {
    // Bulk save
    // 1. Update local cache
    const cacheKey = `cached_sessions_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = [
      ...cached.filter((s: any) => !sessions.some(ns => ns.id === s.id)),
      ...sessions
    ];
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // 2. Add to pending sync for all sessions
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const newPending = [
      ...pending.filter((p: any) => !sessions.some(s => s.id === (p.id || p.data?.id))),
      ...sessions.map(s => ({ type: 'save', data: s }))
    ];
    localStorage.setItem(pendingKey, JSON.stringify(newPending));

    try {
      // 3. Save to Supabase in real-time
      const { error } = await supabase
        .from('sessions')
        .upsert(sessions.map(s => ({ ...s, user_id: userId })));
      
      if (error) throw error;

      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]')
        .filter((p: any) => !sessions.some(s => s.id === (p.id || p.data?.id)));
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving sessions to Supabase:', err);
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
      console.error('Error toggling session (offline?):', err);
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
      console.error('Error deleting session (offline?):', err);
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

      // Cache only last 7 days trash locally
      const prunedTrash = trash.filter(s => s.deleted_at ? isWithinLast7Days(s.deleted_at) : true);
      localStorage.setItem(`cached_trash_${userId}`, JSON.stringify(prunedTrash));
      
      return trash;
    } catch (error) {
      console.warn('Offline mode or query error (Trash):', error);
      const trashKey = `cached_trash_${userId}`;
      const cached = localStorage.getItem(trashKey);
      return cached ? JSON.parse(cached) : [];
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
      console.error('Error restoring session (offline?):', err);
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
      console.error('Error permanently deleting session (offline?):', err);
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

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'app', settings: settings });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_settings');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving settings:', err);
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

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, type: 'timer', settings: timer });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_timer');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving timer:', err);
    }
  },
  getProfile: async (userId: string): Promise<UserProfile> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(data));
        return data as UserProfile;
      }
      return { name: 'Student', grade: 'Grade 10', school: 'Your School', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' };
    } catch (error) {
      console.warn('Offline mode or query error (Profile):', error);
      const cached = localStorage.getItem(`cached_profile_${userId}`);
      return cached ? JSON.parse(cached) : { name: 'Student', grade: 'Grade 10', school: 'Your School', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' };
    }
  },
  saveProfile: async (userId: string, profile: UserProfile) => {
    localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
    
    // Add to pending sync
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
      const { error } = await supabase
        .from('profiles')
        .upsert({ ...profile, user_id: userId });
      
      if (error) throw error;
      
      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.type !== 'save_profile');
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  },
  syncOfflineData: async (userId: string) => {
    console.log('Syncing offline data for user:', userId);
    const pendingKey = `pending_sync_${userId}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    if (pending.length === 0) return;

    // Process in batches or one by one
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
          ({ error } = await supabase.from('routines').upsert({ ...change.data, user_id: userId }));
        } else if (change.type === 'delete_routine') {
          ({ error } = await supabase.from('routines').delete().eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'restore_routine') {
          ({ error } = await supabase.from('routines').update({ deleted_at: null }).eq('id', change.id).eq('user_id', userId));
        } else if (change.type === 'save_settings') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'app', settings: change.data }));
        } else if (change.type === 'save_timer') {
          ({ error } = await supabase.from('settings').upsert({ user_id: userId, type: 'timer', settings: change.data }));
        } else if (change.type === 'save_profile') {
          ({ error } = await supabase.from('profiles').upsert({ ...change.data, user_id: userId }));
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
        }
      } catch (err) {
        console.error('Sync failed for change:', change, err);
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

      const guestSessions = safeParse(localStorage.getItem(guestSessionsKey), []);
      const guestTrash = safeParse(localStorage.getItem(guestTrashKey), []);
      const guestSettings = safeParse(localStorage.getItem(guestSettingsKey), null);
      const guestProfile = safeParse(localStorage.getItem(guestProfileKey), null);
      const guestRoutines = safeParse(localStorage.getItem(guestRoutinesKey), []);

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
        await supabase.from('settings').upsert({ user_id: newUserId, type: 'app', settings: guestSettings });
      }

      // 5. Sync profile
      if (guestProfile) {
        await supabase.from('profiles').upsert({ ...guestProfile, user_id: newUserId });
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
    // Prune local storage to only keep the last 7 days of sessions
    const cacheKey = `cached_sessions_${userId}`;
    const trashKey = `cached_trash_${userId}`;
    
    const sessions = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    
    const prunedSessions = sessions.filter((s: StudySession) => isWithinLast7Days(s.date));
    const prunedTrash = trash.filter((s: StudySession) => s.deleted_at ? isWithinLast7Days(s.deleted_at) : true);
    
    localStorage.setItem(cacheKey, JSON.stringify(prunedSessions));
    localStorage.setItem(trashKey, JSON.stringify(prunedTrash));
    
    console.log('Local cache pruned to last 7 days for user:', userId);
  },
  fullSync: async (userId: string) => {
    console.log('Full sync triggered for user:', userId);
    try {
      // 1. Sync pending changes first
      await storage.syncOfflineData(userId);

      // 2. Get all local data
      const sessions = JSON.parse(localStorage.getItem(`cached_sessions_${userId}`) || '[]');
      const trash = JSON.parse(localStorage.getItem(`cached_trash_${userId}`) || '[]');
      const routines = JSON.parse(localStorage.getItem(`cached_routines_${userId}`) || '[]');
      const settings = JSON.parse(localStorage.getItem(`cached_settings_${userId}`) || 'null');
      const profile = JSON.parse(localStorage.getItem(`cached_profile_${userId}`) || 'null');
      const timer = JSON.parse(localStorage.getItem(`cached_timer_${userId}`) || 'null');

      // 3. Push to Supabase
      if (sessions.length > 0 || trash.length > 0) {
        const allSessions = [...sessions, ...trash].map(s => ({ ...s, user_id: userId }));
        await supabase.from('sessions').upsert(allSessions);
      }
      if (routines.length > 0) {
        const allRoutines = routines.map((r: any) => ({ ...r, user_id: userId }));
        await supabase.from('routines').upsert(allRoutines);
      }
      if (settings) {
        await supabase.from('settings').upsert({ user_id: userId, type: 'app', settings });
      }
      if (profile) {
        await supabase.from('profiles').upsert({ ...profile, user_id: userId });
      }
      if (timer) {
        await supabase.from('settings').upsert({ user_id: userId, type: 'timer', settings: timer });
      }
      
      console.log('Full sync complete');
      return true;
    } catch (err) {
      console.error('Full sync failed:', err);
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
      
      const routines = data as RoutineItem[];
      // Cache all routines locally
      localStorage.setItem(`cached_routines_${userId}`, JSON.stringify(routines));
      return routines;
    } catch (error) {
      console.warn('Offline mode or query error (Routines):', error);
      const cached = localStorage.getItem(`cached_routines_${userId}`);
      return cached ? JSON.parse(cached) : [];
    }
  },
  saveRoutine: async (userId: string, routine: Partial<RoutineItem>) => {
    const routineId = routine.id || (typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    
    const fullRoutine: RoutineItem = {
      id: routineId,
      user_id: userId,
      subject: routine.subject || '',
      chapter: routine.chapter || '',
      topics: routine.topics || '',
      date: routine.date || format(new Date(), 'yyyy-MM-dd'),
      end_date: routine.end_date,
      created_at: routine.created_at || new Date().toISOString(),
      countdown: routine.countdown || 0
    };

    // 1. Update local cache immediately
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    
    let newCache = [...cached.filter((r: any) => r.id !== routineId), fullRoutine];
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

    // 2. Add to pending sync
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

    try {
      // 3. Save to Supabase in real-time
      const { error } = await supabase
        .from('routines')
        .upsert(fullRoutine);
      
      if (error) throw error;

      // Remove from pending if successful
      const updatedPending = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => (p.id || p.data?.id) !== routineId);
      localStorage.setItem(pendingKey, JSON.stringify(updatedPending));
    } catch (err) {
      console.error('Error saving routine to Supabase:', err);
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
      console.error('Error deleting routine:', err);
    }
  },
  restoreRoutine: async (userId: string, id: string) => {
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = cached.map((r: any) => r.id === id ? { ...r, deleted_at: null } : r);
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

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
      console.error('Error restoring routine:', err);
    }
  },
  permanentlyDeleteRoutine: async (userId: string, id: string) => {
    const cacheKey = `cached_routines_${userId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const newCache = cached.filter((r: any) => r.id !== id);
    localStorage.setItem(cacheKey, JSON.stringify(newCache));

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
      console.error('Error permanently deleting routine:', err);
    }
  }
};

export const getWeekDays = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};
