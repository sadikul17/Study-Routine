import { LocalNotifications } from '@capacitor/local-notifications';
import { StudySession, RoutineItem, AppSettings, PrayerSettings, ScheduleItem } from '../types';
import { isSameDay, parseISO, startOfDay, format, subMinutes } from 'date-fns';

export const notificationService = {
  async requestPermissions() {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    }
    return true;
  },

  getScheduleNotificationMessage(task: string, _minutesBefore?: number) {
    return task;
  },

  async scheduleReminders(
    sessions: StudySession[], 
    routines: RoutineItem[], 
    settings: AppSettings, 
    prayerSettings?: PrayerSettings,
    schedules: ScheduleItem[] = []
  ) {
    if (!settings.notifications) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    // Create a channel for Android (professional touch)
    try {
      await LocalNotifications.createChannel({
        id: 'study_reminders',
        name: 'Study Reminders',
        description: 'Notifications for your study tasks and routines',
        importance: 5,
        visibility: 1,
        sound: settings.sound ? 'default' : undefined,
        vibration: true
      });
    } catch (e) {
      console.warn('Could not create notification channel:', e);
    }

    // Cancel existing notifications to reschedule
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    const notifications = [];
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Common notification properties for professional look
    const commonProps = {
      smallIcon: 'ic_launcher', // Standard native icon reference
      largeIcon: 'https://cdn-icons-png.flaticon.com/512/831/831386.png', // App logo
      iconColor: '#000000', // Black color to match the provided icon
      channelId: 'study_reminders',
      sound: settings.sound ? 'default' : undefined,
    };

    // 1. General Task Reminder (Home Page)
    const pendingTasks = sessions.filter(s => {
      if (s.completed) return false;
      const taskDateStr = s.date.includes('T') ? s.date.split('T')[0] : s.date;
      return taskDateStr === todayStr;
    });

    if (pendingTasks.length > 0) {
      const [hours, minutes] = settings.task_notification_time.split(':').map(Number);
      const scheduleDate = new Date();
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate < now) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
      }

      notifications.push({
        ...commonProps,
        title: 'Task Reminder',
        body: `You have ${pendingTasks.length} pending tasks for today. Don't forget to complete them!`,
        id: 1,
        schedule: { at: scheduleDate, allowWhileIdle: true },
        extra: { type: 'tasks' },
        group: 'tasks',
        threadId: 'tasks',
      });
    }

    // 2. General Routine Reminder (Routine Page)
    const activeRoutines = routines.filter(r => !r.deleted_at);
    if (activeRoutines.length > 0) {
      const [hours, minutes] = settings.routine_notification_time.split(':').map(Number);
      const scheduleDate = new Date();
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate < now) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
      }

      notifications.push({
        ...commonProps,
        title: 'Task Reminder',
        body: `Time to check your study routines! You have ${activeRoutines.length} active routines.`,
        id: 2,
        schedule: { at: scheduleDate, allowWhileIdle: true },
        extra: { type: 'routines' },
        group: 'routines',
        threadId: 'routines',
      });
    }

    // 3. Specific Task Reminders
    sessions.filter(s => !s.completed && s.reminder_time).forEach(s => {
      const [h, m] = s.reminder_time.split(':').map(Number);
      const taskDate = new Date(s.date.includes('T') ? s.date : `${s.date}T00:00:00`);
      taskDate.setHours(h, m, 0, 0);

      if (taskDate > now) {
        notifications.push({
          ...commonProps,
          title: 'Task Reminder',
          body: `Subject : ${s.subject}\nchapter : ${s.chapter}`,
          id: Math.abs(this.hashCode(`task_${s.id}`)),
          schedule: { at: taskDate, allowWhileIdle: true },
          extra: { type: 'specific_task', id: s.id },
          group: 'specific_tasks',
          threadId: 'specific_tasks',
        });
      }
    });

    // 4. Specific Routine Reminders
    routines.filter(r => !r.deleted_at && r.reminder_time).forEach(r => {
      const [h, m] = r.reminder_time.split(':').map(Number);
      const routineDate = new Date(r.date.includes('T') ? r.date : `${r.date}T00:00:00`);
      routineDate.setHours(h, m, 0, 0);

      if (routineDate > now) {
        notifications.push({
          ...commonProps,
          title: 'Task Reminder',
          body: `Subject : ${r.subject}\nchapter : ${r.chapter}`,
          id: Math.abs(this.hashCode(`routine_${r.id}`)),
          schedule: { at: routineDate, allowWhileIdle: true },
          extra: { type: 'specific_routine', id: r.id },
          group: 'specific_routines',
          threadId: 'specific_routines',
        });
      }
    });

    // 5. Prayer Time Reminders
    if (prayerSettings && prayerSettings.times) {
      prayerSettings.times.filter(p => p.enabled && p.time).forEach(p => {
        const [hours, minutes] = p.time.split(':').map(Number);
        
        // Schedule for today
        const prayerDateToday = new Date();
        prayerDateToday.setHours(hours, minutes, 0, 0);
        
        if (prayerDateToday > now) {
          notifications.push({
            ...commonProps,
            title: `Time for ${p.name}`,
            body: `It's ${p.time}. Time for your scheduled ${p.name}.`,
            id: Math.abs(this.hashCode(`prayer_${p.name}_today`)),
            schedule: { at: prayerDateToday, allowWhileIdle: true },
            extra: { type: 'prayer_time', name: p.name },
            group: 'prayers',
            threadId: 'prayers',
          });
        }

        // Also schedule for tomorrow to ensure continuity
        const prayerDateTomorrow = new Date();
        prayerDateTomorrow.setDate(prayerDateTomorrow.getDate() + 1);
        prayerDateTomorrow.setHours(hours, minutes, 0, 0);
        
        notifications.push({
          ...commonProps,
          title: `Time for ${p.name}`,
          body: `It's ${p.time}. Time for your scheduled ${p.name}.`,
          id: Math.abs(this.hashCode(`prayer_${p.name}_tomorrow`)),
          schedule: { at: prayerDateTomorrow, allowWhileIdle: true },
          extra: { type: 'prayer_time', name: p.name },
          group: 'prayers',
          threadId: 'prayers',
        });
      });
    }

    // 6. Daily Schedule Reminders
    schedules.forEach(item => {
      const scheduleTimes = [
        { time: item.start_time, label: 'Start' },
        { time: item.end_time, label: 'End' },
      ];

      scheduleTimes.forEach((st) => {
        const [hours, mins] = st.time.split(':').map(Number);
        const scheduleDate = new Date();
        scheduleDate.setHours(hours, mins, 0, 0);

        if (scheduleDate > now) {
          const body = item.task;
          notifications.push({
            ...commonProps,
            title: st.label === 'Start' ? 'Schedule Start' : 'Schedule End',
            body: body,
            id: Math.abs(this.hashCode(`schedule_${item.id}_${st.label}`)),
            schedule: { at: scheduleDate, allowWhileIdle: true },
            extra: { type: 'schedule', id: item.id },
            group: 'schedules',
            threadId: 'schedules',
          });
        }
      });
    });

    if (notifications.length > 0) {
      try {
        // Sort by date and limit to 60 to avoid OS limits
        const sortedNotifications = notifications
          .sort((a, b) => (a.schedule?.at?.getTime() || 0) - (b.schedule?.at?.getTime() || 0))
          .slice(0, 60);

        await LocalNotifications.schedule({ notifications: sortedNotifications as any });
        console.log('Notifications scheduled successfully:', sortedNotifications.length);
      } catch (error) {
        console.error('Error scheduling notifications:', error);
      }
    }
  },

  hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },

  async setQuickAlarm(time: string, subject: string, chapter: string) {
    if (!time) return;
    
    const [hours, minutes] = time.split(':').map(Number);
    const scheduleDate = new Date();
    scheduleDate.setHours(hours, minutes, 0, 0);

    // If time is in the past, schedule for tomorrow
    if (scheduleDate < new Date()) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 10000) + 5000,
          title: 'Task Reminder',
          body: `Subject : ${subject}\nchapter : ${chapter}`,
          schedule: { at: scheduleDate, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'https://cdn-icons-png.flaticon.com/512/831/831386.png',
          iconColor: '#000000',
          extra: { type: 'alarm' }
        }]
      });
      return true;
    } catch (error) {
      console.error('Error setting quick alarm:', error);
      return false;
    }
  },

  async notify(title: string, body: string, id: number = Math.floor(Math.random() * 10000)) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_launcher',
          largeIcon: 'https://cdn-icons-png.flaticon.com/512/831/831386.png',
          iconColor: '#000000',
          extra: { type: 'prayer_time' }
        }]
      });
      return true;
    } catch (error) {
      console.error('Error sending immediate notification:', error);
      return false;
    }
  }
};
