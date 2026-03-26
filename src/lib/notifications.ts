import { LocalNotifications } from '@capacitor/local-notifications';
import { StudySession, RoutineItem, AppSettings } from '../types';
import { isSameDay, parseISO, startOfDay } from 'date-fns';

export const notificationService = {
  async requestPermissions() {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    }
    return true;
  },

  async scheduleReminders(sessions: StudySession[], routines: RoutineItem[], settings: AppSettings) {
    if (!settings.notifications) {
      await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
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
    const today = startOfDay(new Date());

    // Common notification properties for professional look
    const commonProps = {
      smallIcon: 'ic_launcher', // Use the main app icon for notifications
      iconColor: '#FF4444', // Professional red
      channelId: 'study_reminders',
      sound: settings.sound ? 'default' : undefined,
    };

    // 1. General Task Reminder (Home Page)
    const pendingTasks = sessions.filter(s => !s.completed && isSameDay(parseISO(s.date), today));
    if (pendingTasks.length > 0) {
      const [hours, minutes] = settings.task_notification_time.split(':').map(Number);
      const scheduleDate = new Date();
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate < new Date()) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
      }

      notifications.push({
        ...commonProps,
        title: 'Task Reminder',
        body: `You have ${pendingTasks.length} pending tasks for today. Don't forget to complete them!`,
        id: 1,
        schedule: { at: scheduleDate, repeats: true, every: 'day' },
        extra: { type: 'tasks' },
        group: 'tasks',
        threadId: 'tasks'
      });
    }

    // 2. General Routine Reminder (Routine Page)
    const activeRoutines = routines.filter(r => !r.deleted_at);
    if (activeRoutines.length > 0) {
      const [hours, minutes] = settings.routine_notification_time.split(':').map(Number);
      const scheduleDate = new Date();
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate < new Date()) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
      }

      notifications.push({
        ...commonProps,
        title: 'Routine Reminder',
        body: `Time to check your study routines! You have ${activeRoutines.length} active routines.`,
        id: 2,
        schedule: { at: scheduleDate, repeats: true, every: 'day' },
        extra: { type: 'routines' },
        group: 'routines',
        threadId: 'routines'
      });
    }

    // 3. Specific Task Reminders
    sessions.filter(s => !s.completed && s.reminder_time).forEach(s => {
      const [hours, minutes] = s.reminder_time!.split(':').map(Number);
      const taskDate = new Date(s.date.includes('T') ? s.date : s.date + 'T00:00:00');
      taskDate.setHours(hours, minutes, 0, 0);

      if (taskDate > new Date()) {
        notifications.push({
          ...commonProps,
          title: 'Task Reminder: ' + s.subject,
          body: `Time for your task: ${s.chapter}. Stay focused!`,
          id: Math.abs(this.hashCode(s.id)),
          schedule: { at: taskDate },
          extra: { type: 'specific_task', id: s.id },
          group: 'specific_tasks',
          threadId: 'specific_tasks'
        });
      }
    });

    // 4. Specific Routine Reminders
    routines.filter(r => !r.deleted_at && r.reminder_time).forEach(r => {
      const [hours, minutes] = r.reminder_time!.split(':').map(Number);
      const routineDate = new Date(r.date.includes('T') ? r.date : r.date + 'T00:00:00');
      routineDate.setHours(hours, minutes, 0, 0);

      if (routineDate > new Date()) {
        notifications.push({
          ...commonProps,
          title: 'Routine Reminder: ' + r.subject,
          body: `Time for your routine: ${r.chapter}. Keep it up!`,
          id: Math.abs(this.hashCode(r.id)),
          schedule: { at: routineDate },
          extra: { type: 'specific_routine', id: r.id },
          group: 'specific_routines',
          threadId: 'specific_routines'
        });
      }
    });

    if (notifications.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications: notifications as any });
        console.log('Notifications scheduled successfully:', notifications.length);
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
  }
};
