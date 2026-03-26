import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  Home as HomeIcon, 
  BarChart2, 
  Settings as SettingsIcon, 
  Plus, 
  X, 
  Book, 
  Music, 
  Heart, 
  Brain, 
  Zap, 
  Flame, 
  Target, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Languages,
  Moon,
  Sun,
  Trash2,
  Atom,
  Calculator,
  Activity,
  PieChart as PieChartIcon,
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Check,
  LogOut,
  Smartphone as Store,
  Printer,
  Settings2,
  AlertCircle,
  Download,
  RefreshCw,
  Edit,
  History,
  Archive,
  Bell,
  Clock
} from 'lucide-react';
import { 
  format, 
  isSameDay, 
  startOfDay, 
  addDays, 
  startOfWeek, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  isToday,
  isBefore,
  addMonths,
  subMonths,
  isWithinInterval,
  subDays,
  differenceInDays
} from 'date-fns';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { storage, type StudySession, type AppSettings, type UserProfile, type TimerState, getWeekDays, type RoutineItem, safeParse } from './types';
import { supabase } from './lib/supabase';
import { AuthPage } from './components/AuthPage';
import { notificationService } from './lib/notifications';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const RoutineCard = ({ 
  routine, 
  index, 
  view, 
  darkMode, 
  onAddTask, 
  handleEditRoutine, 
  onDeleteRoutine, 
  onRestoreRoutine, 
  onPermanentlyDeleteRoutine,
  onSaveRoutine
}: any) => {
  let statusText = '';
  let statusColor = '';
  
  if (routine.end_date) {
    const today = startOfDay(new Date());
    const end = startOfDay(new Date(routine.end_date));
    const diff = differenceInDays(end, today);
    
    if (diff < 0) {
      statusText = 'End';
      statusColor = 'bg-red-500/10 text-red-500';
    } else {
      statusText = diff.toString();
      statusColor = 'bg-orange-500/10 text-orange-500';
    }
  }
  
  return (
    <div 
      key={`${routine.id}-${index}`}
      className={cn(
        "p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center relative transition-all duration-300 border overflow-hidden",
        darkMode 
          ? "bg-slate-800/40 border-slate-700 hover:border-indigo-500/50 shadow-xl shadow-black/20" 
          : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md"
      )}
    >
      <div className="space-y-4 flex-1 min-w-0 w-full">
        <div className="flex items-center justify-between w-full gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0",
            darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
          )}>
            <Calendar size={12} className="text-indigo-500" />
            {format(new Date(routine.date), 'MMM d, yyyy')}
          </div>

          {statusText && (
            <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 whitespace-nowrap", statusColor)}>
              <Clock size={12} />
              {statusText} {statusText === 'End' ? '' : 'Days Left'}
            </span>
          )}

          {view !== 'deleted' && (
            <button
              onClick={() => onDeleteRoutine(routine.id)}
              className={cn(
                "p-2 rounded-xl transition-all opacity-30 hover:opacity-100 hover:bg-red-500/10 text-red-500 shrink-0",
                darkMode ? "hover:bg-red-500/20" : "hover:bg-red-50"
              )}
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className={cn(
            "font-black text-2xl leading-tight tracking-tight break-words",
            darkMode ? "text-indigo-400" : "text-indigo-600"
          )}>
            {routine.subject}
          </h3>
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold",
            darkMode ? "bg-indigo-500/10 text-indigo-300" : "bg-indigo-50 text-indigo-700"
          )}>
            <Book size={14} />
            {routine.chapter}
          </div>
        </div>

        {routine.topics && (
          <div className={cn(
            "p-4 rounded-2xl text-sm leading-relaxed border",
            darkMode 
              ? "bg-slate-900/50 border-slate-700/50 text-slate-300" 
              : "bg-slate-50 border-slate-100 text-slate-600"
          )}>
            <div className="flex items-center gap-2 mb-2 opacity-60">
              <Target size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Topics to Cover</span>
            </div>
            <p className="whitespace-pre-line break-words font-medium">
              {routine.topics}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-row sm:flex-col gap-3 items-center sm:items-end mt-4 sm:mt-0 sm:ml-6 w-full sm:w-auto justify-between sm:justify-center border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-slate-700">
        {view === 'active' && (
          <button
            onClick={() => onAddTask(routine.subject, routine.chapter, routine.topics || '', routine.date, routine.reminder_time)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border active:scale-95",
              darkMode 
                ? "bg-transparent border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10" 
                : "bg-transparent border-indigo-500 text-indigo-600 hover:bg-indigo-50"
            )}
          >
            <Plus size={16} />
            ADD TASK
          </button>
        )}
        <div className="flex items-center gap-2">
          {view !== 'deleted' ? (
            <>
              <button
                onClick={() => handleEditRoutine(routine)}
                className={cn(
                  "p-2.5 rounded-xl transition-all border",
                  darkMode 
                    ? "text-indigo-400 border-slate-700 hover:bg-slate-700" 
                    : "text-indigo-600 border-slate-200 hover:bg-slate-50"
                )}
                title="Edit"
              >
                <Edit size={20} />
              </button>
              <button
                  onClick={() => {
                    if (view === 'ended') {
                      onSaveRoutine({
                        ...routine,
                        end_date: ''
                      });
                    } else {
                      const today = new Date();
                      onSaveRoutine({
                        ...routine,
                        end_date: format(subDays(today, 16), 'yyyy-MM-dd')
                      });
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border",
                    view === 'ended' 
                      ? "text-green-500 border-green-100 bg-green-50/50 hover:bg-green-50" 
                      : "text-orange-500 border-orange-100 bg-orange-50/50 hover:bg-orange-50",
                    darkMode && (view === 'ended' ? "border-green-900/30 bg-green-900/10 hover:bg-green-900/20" : "border-orange-900/30 bg-orange-900/10 hover:bg-orange-900/20")
                  )}
                  title={view === 'ended' ? "Move to Active" : "Move to Ended"}
                >
                  <History size={20} />
                </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRestoreRoutine(routine.id)}
                className="p-2.5 rounded-xl text-green-500 border border-green-100 bg-green-50/50 hover:bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 transition-all"
                title="Restore"
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={() => {
                  onPermanentlyDeleteRoutine(routine.id);
                }}
                className="p-2.5 rounded-xl text-red-500 border border-red-100 bg-red-50/50 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-900/10 transition-all"
                title="Permanently Delete"
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RoutinePage = ({ 
  routines, 
  onSaveRoutine, 
  onDeleteRoutine, 
  onRestoreRoutine,
  onPermanentlyDeleteRoutine,
  onAddTask,
  user, 
  darkMode 
}: { 
  routines: RoutineItem[], 
  onSaveRoutine: (routine: Partial<RoutineItem>) => Promise<void>, 
  onDeleteRoutine: (id: string) => Promise<void>,
  onRestoreRoutine: (id: string) => Promise<void>,
  onPermanentlyDeleteRoutine: (id: string) => Promise<void>,
  onAddTask: (subject: string, chapter: string, topics: string, date: string, reminder_time?: string) => Promise<void>,
  user: any,
  darkMode: boolean
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [topics, setTopics] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printDays, setPrintDays] = useState('7');
  const [printStartDate, setPrintStartDate] = useState('');
  const [printEndDate, setPrintEndDate] = useState('');
  const [view, setView] = useState<'active' | 'ended' | 'deleted'>('active');
  const printRef = useRef<HTMLDivElement>(null);

  const activeRoutines = useMemo(() => routines.filter(r => {
    if (r.deleted_at) return false;
    if (!r.end_date) return true;
    const today = startOfDay(new Date());
    const end = startOfDay(new Date(r.end_date));
    // Stay in active for 15 days after it ends
    return differenceInDays(today, end) <= 15;
  }), [routines]);

  const endedRoutines = useMemo(() => routines.filter(r => {
    if (r.deleted_at) return false;
    if (!r.end_date) return false;
    const today = startOfDay(new Date());
    const end = startOfDay(new Date(r.end_date));
    // Move to ended after 15 days
    return differenceInDays(today, end) > 15;
  }), [routines]);

  const deletedRoutines = useMemo(() => routines.filter(r => !!r.deleted_at), [routines]);

  const currentRoutines = useMemo(() => 
    view === 'active' ? activeRoutines : view === 'ended' ? endedRoutines : deletedRoutines
  , [view, activeRoutines, endedRoutines, deletedRoutines]);

  const generatePDF = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    
    try {
      let startDate: Date;
      let endDate: Date;

      if (printStartDate && printEndDate) {
        startDate = startOfDay(new Date(printStartDate));
        endDate = startOfDay(new Date(printEndDate));
      } else {
        const days = parseInt(printDays) || 7;
        const today = startOfDay(new Date());
        startDate = subDays(today, days - 1);
        endDate = today;
      }
      
      // Include both active and ended routines for PDF if not in deleted view
      const baseRoutines = view === 'deleted' ? deletedRoutines : routines.filter(r => !r.deleted_at);
      
      // Filter routines by date range
      const routinesToPrint = baseRoutines.filter(r => {
        const rDate = startOfDay(new Date(r.date));
        return rDate >= startDate && rDate <= endDate;
      });

      if (routinesToPrint.length === 0) {
        setIsGeneratingPDF(false);
        setShowPrintOptions(false);
        return;
      }

      // Group routines by date
      const groupedRoutines: { [date: string]: RoutineItem[] } = {};
      routinesToPrint.forEach(r => {
        const dateStr = r.date.includes('T') ? format(new Date(r.date), 'yyyy-MM-dd') : r.date;
        if (!groupedRoutines[dateStr]) groupedRoutines[dateStr] = [];
        groupedRoutines[dateStr].push(r);
      });

      // Determine which dates to print (unique dates in the range that have routines)
      const allDatesToPrint = Object.keys(groupedRoutines).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      // Chunk dates into pages (7 days per page)
      const daysPerPage = 7;
      const dateChunks = [];
      for (let i = 0; i < allDatesToPrint.length; i += daysPerPage) {
        dateChunks.push(allDatesToPrint.slice(i, i + daysPerPage));
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      for (let i = 0; i < dateChunks.length; i++) {
        if (i > 0) pdf.addPage();
        
        const chunk = dateChunks[i];
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.style.padding = '40px';
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.color = '#000000';
        tempContainer.style.fontFamily = '"Hind Siliguri", "Inter", sans-serif';
        
        let htmlContent = `
          <div style="font-family: 'Hind Siliguri', sans-serif; color: #1e293b; background-color: #ffffff; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4338CA; padding-bottom: 20px; margin-bottom: 30px;">
              <div>
                <h1 style="font-size: 32px; color: #4338CA; margin: 0; font-weight: 900; letter-spacing: -0.02em;">STUDY ROUTINE SCHEDULE</h1>
                <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0; font-weight: 500;">
                  Page ${i + 1} of ${dateChunks.length} | 
                  <span style="color: #4338CA; font-weight: 700;">${view === 'deleted' ? 'Deleted Records' : 'Active & Ended Routines'}</span>
                </p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 10px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">Exported On</p>
                <p style="font-size: 15px; color: #1e293b; font-weight: 800; margin: 2px 0 0 0;">${format(new Date(), 'MMM d, yyyy')}</p>
                <p style="font-size: 12px; color: #64748b; margin: 0;">${format(new Date(), 'HH:mm')}</p>
              </div>
            </div>
            
            <div style="margin-bottom: 30px; background: linear-gradient(to right, #f8fafc, #f1f5f9); padding: 16px 24px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <div style="width: 8px; height: 8px; background-color: #4338CA; border-radius: 50%;"></div>
              <span style="color: #4338CA; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Report Period:</span>
              <span style="font-weight: 700; color: #1e293b; font-size: 15px;">${format(startDate, 'MMM d, yyyy')}</span>
              <span style="color: #cbd5e1; font-weight: 300; font-size: 20px;">&mdash;</span>
              <span style="font-weight: 700; color: #1e293b; font-size: 15px;">${format(endDate, 'MMM d, yyyy')}</span>
            </div>
            
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <thead>
                <tr style="background-color: #4338CA; color: #ffffff;">
                  <th style="padding: 18px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; border-right: 1px solid rgba(255,255,255,0.1);">DATE</th>
                  <th style="padding: 18px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; border-right: 1px solid rgba(255,255,255,0.1);">Subject</th>
                  <th style="padding: 18px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; border-right: 1px solid rgba(255,255,255,0.1);">Chapter</th>
                  <th style="padding: 18px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800;">Topics & Details</th>
                </tr>
              </thead>
              <tbody>
            `;
        
        chunk.forEach((dateStr, idx) => {
          const dayRoutines = groupedRoutines[dateStr] || [];
          const isLastDate = idx === chunk.length - 1;
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

          if (dayRoutines.length === 0) {
            htmlContent += `
              <tr style="background-color: ${rowBg};">
                <td style="padding: 20px 16px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; border-right: 1px solid #e2e8f0; vertical-align: top; width: 160px;">
                  <div style="font-weight: 900; color: #1e293b; font-size: 16px;">${format(new Date(dateStr), 'MMM d')}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${format(new Date(dateStr), 'EEEE')}</div>
                </td>
                <td colspan="3" style="padding: 20px 16px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; color: #94a3b8; font-style: italic; font-size: 14px; text-align: center; letter-spacing: 0.02em;">No routine scheduled for this date</td>
              </tr>
            `;
          } else {
            dayRoutines.forEach((r, rIdx) => {
              const isLastRoutine = rIdx === dayRoutines.length - 1;
              const borderBottom = (isLastDate && isLastRoutine) ? 'none' : '1px solid #e2e8f0';

              htmlContent += `
                <tr style="background-color: ${rowBg};">
                  ${rIdx === 0 ? `
                    <td style="padding: 20px 16px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; border-right: 1px solid #e2e8f0; vertical-align: top; width: 160px;" rowspan="${dayRoutines.length}">
                      <div style="font-weight: 900; color: #1e293b; font-size: 16px;">${format(new Date(dateStr), 'MMM d')}</div>
                      <div style="font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${format(new Date(dateStr), 'EEEE')}</div>
                      <div style="margin-top: 12px; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                        Start: ${format(new Date(r.date), 'MMM d')}
                        ${r.end_date ? `<br/>End: ${format(new Date(r.end_date), 'MMM d')}` : ''}
                      </div>
                    </td>
                  ` : ''}
                  <td style="padding: 20px 16px; border-bottom: ${borderBottom}; border-right: 1px solid #e2e8f0; vertical-align: top;">
                    <div style="color: #4338CA; font-weight: 800; font-size: 15px; line-height: 1.2;">${r.subject}</div>
                  </td>
                  <td style="padding: 20px 16px; border-bottom: ${borderBottom}; border-right: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 600; vertical-align: top; line-height: 1.4;">${r.chapter}</td>
                  <td style="padding: 20px 16px; border-bottom: ${borderBottom}; color: #475569; font-size: 13px; vertical-align: top; line-height: 1.6; font-weight: 500;">
                    ${r.topics ? r.topics.split('\n').map(t => `<div style="margin-bottom: 4px; display: flex; gap: 6px;"><span style="color: #4338CA;">&bull;</span><span>${t}</span></div>`).join('') : '<span style="color: #cbd5e1; font-style: italic;">No topics specified</span>'}
                  </td>
                </tr>
              `;
            });
          }
        });
        
        htmlContent += `
              </tbody>
            </table>
            <div style="margin-top: 40px; border-top: 2px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; font-weight: 600;">&copy; ${new Date().getFullYear()} Study Planner Pro &bull; Excellence through consistency</p>
              <div style="display: flex; gap: 15px;">
                <div style="width: 12px; height: 12px; background-color: #4338CA; border-radius: 3px;"></div>
                <div style="width: 12px; height: 12px; background-color: #818cf8; border-radius: 3px;"></div>
                <div style="width: 12px; height: 12px; background-color: #c7d2fe; border-radius: 3px;"></div>
              </div>
            </div>
          </div>
        `;
        
        tempContainer.innerHTML = htmlContent;
        document.body.appendChild(tempContainer);

        await document.fonts.ready;

        const canvas = await html2canvas(tempContainer, {
          scale: 4,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
        });
        
        document.body.removeChild(tempContainer);
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        
        let heightLeft = pdfHeight;
        let position = 0;

        // Add the first page for this chunk
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdfPageHeight;

        // If the chunk overflows the page, add more pages
        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdfPageHeight;
        }
      }

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = `study_routine_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Study Routine',
          url: result.uri,
        });
      } else {
        pdf.save(`study_routine_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      }
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingPDF(false);
      setShowPrintOptions(false);
    }
  };

  const handleAddNow = async () => {
    if (!subject || !chapter) return;
    setIsSaving(true);
    try {
      await onSaveRoutine({
        id: editingRoutineId || undefined,
        subject,
        chapter,
        topics,
        date: selectedDate,
        end_date: selectedEndDate || undefined,
        reminder_time: reminderTime || undefined,
        countdown: 0
      });
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setChapter('');
    setTopics('');
    setReminderTime('');
    setSelectedEndDate('');
    setEditingRoutineId(null);
    setIsAdding(false);
  };

  const handleEditRoutine = (routine: RoutineItem) => {
    setEditingRoutineId(routine.id);
    setSubject(routine.subject);
    setChapter(routine.chapter);
    setTopics(routine.topics || '');
    setSelectedDate(routine.date);
    setSelectedEndDate(routine.end_date || '');
    setReminderTime(routine.reminder_time || '');
    setIsAdding(true);
  };

  return (
    <div ref={printRef} className="space-y-8">
      {/* Routine List Container */}
      <div className={cn(
        "rounded-[2.5rem] border p-8 min-h-[500px] relative overflow-hidden",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-2xl shadow-slate-200/50"
      )}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div className="flex items-center gap-4">
            <h2 className={cn("text-3xl font-black tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              {view === 'active' ? 'Routine' : view === 'ended' ? 'Ended History' : 'Deleted Archive'}
            </h2>
            <div className="relative">
              <button
                onClick={() => setShowPrintOptions(!showPrintOptions)}
                className={cn(
                  "p-2 rounded-xl transition-all border",
                  darkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Download size={20} />
              </button>
              
              <AnimatePresence>
                {showPrintOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 top-12 z-50 w-56 p-5 rounded-[2rem] border shadow-2xl",
                      darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                    )}
                  >
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 text-indigo-500">
                        <Printer size={18} />
                        <span className="font-black text-sm uppercase tracking-wider">Export PDF</span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Days to Include</label>
                        <input 
                          type="number"
                          value={printDays}
                          onChange={(e) => setPrintDays(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold",
                            darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                          )}
                          min="1"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Start Date</label>
                          <input 
                            type="date"
                            value={printStartDate}
                            onChange={(e) => setPrintStartDate(e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-bold",
                              darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">End Date</label>
                          <input 
                            type="date"
                            value={printEndDate}
                            onChange={(e) => setPrintEndDate(e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-bold",
                              darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            )}
                          />
                        </div>
                      </div>
                      <button
                        onClick={generatePDF}
                        disabled={isGeneratingPDF}
                        className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 active:scale-95"
                      >
                        {isGeneratingPDF ? "GENERATING..." : "DOWNLOAD PDF"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center p-1 rounded-2xl",
              darkMode ? "bg-slate-800" : "bg-slate-100"
            )}>
              <button
                onClick={() => setView('active')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  view === 'active' 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "text-slate-500 hover:text-indigo-500"
                )}
              >
                ACTIVE
              </button>
              <button
                onClick={() => setView('ended')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  view === 'ended' 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "text-slate-500 hover:text-indigo-500"
                )}
              >
                ENDED
              </button>
              <button
                onClick={() => setView('deleted')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  view === 'deleted' 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "text-slate-500 hover:text-indigo-500"
                )}
              >
                TRASH
              </button>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setView('active');
                  setIsAdding(!isAdding);
                }}
                className="p-3 rounded-2xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/30 active:scale-95"
              >
                {isAdding ? <X size={20} /> : <Plus size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Back button removed per request */}

        <AnimatePresence>
          {isAdding && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={cn(
                  "w-full max-w-sm p-6 rounded-2xl border shadow-2xl space-y-2 overflow-y-auto max-h-[90vh]",
                  darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className={cn("text-lg font-bold", darkMode ? "text-white" : "text-slate-900")}>
                    {editingRoutineId ? 'Edit Routine' : 'Add New Routine'}
                  </h3>
                  <button 
                    onClick={resetForm}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60">Subject</label>
                    <input 
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60">Chapter</label>
                    <input 
                      type="text"
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                        darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60">Topics</label>
                    <textarea 
                      value={topics}
                      onChange={(e) => setTopics(e.target.value)}
                      rows={4}
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none",
                        darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-60">Start Date</label>
                      <div className="relative group">
                        <input 
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all",
                            darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                          )}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-60">End Date</label>
                      <div className="relative group">
                        <input 
                          type="date"
                          value={selectedEndDate}
                          onChange={(e) => setSelectedEndDate(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all",
                            darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center pt-2">
                    <div className="relative flex-shrink-0 w-28">
                      <input 
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        placeholder="set a time"
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center",
                          darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>

                    <button
                      onClick={handleAddNow}
                      disabled={isSaving || !subject || !chapter}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                    >
                      {isSaving ? (editingRoutineId ? "Updating..." : "Adding...") : (editingRoutineId ? "Update Routine" : "Add Routine")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6">
          {currentRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <Book size={48} className="mb-4" />
              <p>No routines found in this view</p>
            </div>
          ) : (
            currentRoutines
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((routine, index) => (
                <RoutineCard 
                  key={`${routine.id}-${index}`}
                  routine={routine}
                  index={index}
                  view={view}
                  darkMode={darkMode}
                  onAddTask={onAddTask}
                  handleEditRoutine={handleEditRoutine}
                  onDeleteRoutine={onDeleteRoutine}
                  onRestoreRoutine={onRestoreRoutine}
                  onPermanentlyDeleteRoutine={onPermanentlyDeleteRoutine}
                  onSaveRoutine={onSaveRoutine}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const Timer = ({ 
  layoutId, 
  isExpanded, 
  onToggleExpand, 
  initialMinutes, 
  onSetInitialMinutes,
  taskName,
  onComplete,
  timeLeft,
  setTimeLeft,
  isActive,
  setIsActive,
  totalSeconds,
  setTotalSeconds,
  darkMode
}: { 
  layoutId: string; 
  isExpanded: boolean; 
  onToggleExpand: () => void; 
  initialMinutes: number;
  onSetInitialMinutes: (m: number) => void;
  taskName: string;
  onComplete: () => void;
  timeLeft: number;
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  isActive: boolean;
  setIsActive: (a: boolean) => void;
  totalSeconds: number;
  setTotalSeconds: (s: number) => void;
  darkMode: boolean;
}) => {
  const [h, setH] = useState(Math.floor(initialMinutes / 60).toString());
  const [m, setM] = useState((initialMinutes % 60).toString());
  const [showSettings, setShowSettings] = useState(false);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(true);
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(false);
    setTimeLeft(initialMinutes * 60);
    setTotalSeconds(initialMinutes * 60);
  };

  const handleSetTime = (totalMins: number) => {
    onSetInitialMinutes(totalMins);
    if (!isActive) {
      setTimeLeft(totalMins * 60);
      setTotalSeconds(totalMins * 60);
    }
  };

  const updateFromHM = (newH: string, newM: string) => {
    const hours = parseInt(newH) || 0;
    const mins = parseInt(newM) || 0;
    const total = (hours * 60) + mins;
    if (total > 0) handleSetTime(total);
  };

  if (!isExpanded) {
    return (
      <motion.div 
        layoutId={layoutId}
        onClick={onToggleExpand}
        className={cn(
          "flex items-center px-3 py-1 rounded-full cursor-pointer transition-colors shadow-sm",
          darkMode ? "bg-black/90 hover:bg-black" : "bg-white border border-gray-200 hover:bg-gray-50"
        )}
      >
        <span className={cn(
          "text-[11px] font-bold font-mono tabular-nums",
          darkMode ? "text-white" : "text-gray-900"
        )}>{formatTime(timeLeft)}</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      layoutId={layoutId}
      className={cn(
        "w-full max-w-[280px] backdrop-blur-sm border rounded-2xl p-3 shadow-xl relative overflow-hidden mx-auto transition-colors duration-300",
        darkMode ? "bg-transparent border-white/10" : "bg-white/80 border-gray-200"
      )}
    >
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full", 
              isActive ? "bg-green-400 animate-pulse" : (darkMode ? "bg-white/20" : "bg-gray-300")
            )} />
            <span className={cn(
              "text-[8px] font-bold uppercase tracking-widest",
              darkMode ? "text-white/40" : "text-gray-400"
            )}>Focus Mode</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              className={cn(
                "p-1 rounded-md transition-colors",
                showSettings 
                  ? (darkMode ? "bg-white/20 text-white" : "bg-gray-100 text-gray-900") 
                  : (darkMode ? "text-white/40 hover:text-white" : "text-gray-400 hover:text-gray-900")
              )}
            >
              <Settings2 size={14} />
            </button>
            <button 
              onClick={onToggleExpand} 
              className={cn(
                "p-1 transition-colors",
                darkMode ? "text-white/40 hover:text-white" : "text-gray-400 hover:text-gray-900"
              )}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {showSettings ? (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 py-1"
          >
            <div className="flex justify-center gap-1.5">
              {[15, 25, 45, 60].map(mins => (
                <button 
                  key={mins}
                  onClick={() => {
                    handleSetTime(mins);
                    setH(Math.floor(mins / 60).toString());
                    setM((mins % 60).toString());
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[9px] font-bold transition-all",
                    initialMinutes === mins 
                      ? (darkMode ? "bg-white text-black" : "bg-primary text-white shadow-sm") 
                      : (darkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                  )}
                >
                  {mins >= 60 ? `${mins/60}h` : `${mins}m`}
                </button>
              ))}
            </div>
            <div className={cn(
              "flex items-center justify-center gap-4 rounded-xl p-3 border transition-colors",
              darkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
            )}>
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  "text-[7px] font-bold uppercase tracking-tighter",
                  darkMode ? "text-white/30" : "text-gray-400"
                )}>Hours</span>
                <input 
                  type="number"
                  value={h}
                  onChange={(e) => {
                    const val = e.target.value;
                    setH(val);
                    updateFromHM(val, m);
                  }}
                  className={cn(
                    "w-12 bg-transparent text-lg font-bold outline-none text-center border-b transition-colors",
                    darkMode ? "text-white border-white/10 focus:border-white/40" : "text-gray-900 border-gray-200 focus:border-primary"
                  )}
                  min="0"
                />
              </div>
              <span className={cn(
                "font-bold text-xl mb-[-10px]",
                darkMode ? "text-white/20" : "text-gray-300"
              )}>:</span>
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  "text-[7px] font-bold uppercase tracking-tighter",
                  darkMode ? "text-white/30" : "text-gray-400"
                )}>Minutes</span>
                <input 
                  type="number"
                  value={m}
                  onChange={(e) => {
                    const val = e.target.value;
                    setM(val);
                    updateFromHM(h, val);
                  }}
                  className={cn(
                    "w-12 bg-transparent text-lg font-bold outline-none text-center border-b transition-colors",
                    darkMode ? "text-white border-white/10 focus:border-white/40" : "text-gray-900 border-gray-200 focus:border-primary"
                  )}
                  min="0"
                  max="59"
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "text-xs font-bold truncate",
                darkMode ? "text-white" : "text-gray-900"
              )}>{taskName}</h3>
              <p className={cn(
                "text-[8px] font-medium uppercase tracking-widest",
                darkMode ? "text-white/40" : "text-gray-500"
              )}>Keep pushing forward</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-2xl font-bold font-mono tabular-nums tracking-tight",
                darkMode ? "text-white" : "text-gray-900"
              )}>{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        <div className={cn(
          "flex items-center justify-between pt-1 border-t",
          darkMode ? "border-white/5" : "border-gray-100"
        )}>
          <div className="flex gap-2">
            <button 
              onClick={handleReset}
              className={cn(
                "p-1.5 transition-colors",
                darkMode ? "text-white/40 hover:text-white" : "text-gray-400 hover:text-gray-900"
              )}
            >
              <RotateCcw size={14} />
            </button>
            <button 
              onClick={onComplete}
              className={cn(
                "p-1.5 transition-colors",
                darkMode ? "text-white/40 hover:text-white" : "text-gray-400 hover:text-gray-900"
              )}
            >
              <Check size={14} />
            </button>
          </div>
          
          <button 
            onClick={isActive ? handlePause : handleStart}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5",
              isActive 
                ? (darkMode ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-900 hover:bg-gray-200") 
                : (darkMode ? "bg-white text-black hover:bg-white/90" : "bg-primary text-white hover:opacity-90 shadow-sm shadow-primary/20")
            )}
          >
            {isActive ? (
              <><Pause size={12} fill="currentColor" /> Pause</>
            ) : (
              <><Play size={12} fill="currentColor" /> Start</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <motion.div 
    whileHover={onClick ? { scale: 1.005 } : {}}
    whileTap={onClick ? { scale: 0.98 } : {}}
    onClick={onClick}
    className={cn(
      "rounded-card p-6 border md:shadow-xl overflow-hidden transition-all duration-200 ease-out will-change-transform",
      "bg-card border-white/5", // Default dark mode
      "light:bg-white light:border-gray-200 light:shadow-sm", // Light mode
      className, 
      onClick && "cursor-pointer active:opacity-80 touch-manipulation"
    )}
    style={{ transform: 'translateZ(0)' }}
  >
    {children}
  </motion.div>
);

const Badge = ({ count, color }: { count: number; color: string }) => (
  <span className={cn("ml-3 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold", color)}>
    {count}
  </span>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'overview' | 'settings' | 'routine'>('home');
  const [activeSettingsSection, setActiveSettingsSection] = useState<'preferences'>('preferences');
  
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [trash, setTrash] = useState<StudySession[]>([]);

  const last7DaysSessions = useMemo(() => 
    sessions.filter(s => isWithinInterval(new Date(s.date), { start: subDays(new Date(), 7), end: new Date() }))
  , [sessions]);

  const completedSessionsCount = useMemo(() => 
    sessions.filter(s => s.completed).length
  , [sessions]);

  const efficiencyRate = useMemo(() => 
    sessions.length > 0 ? Math.round((completedSessionsCount / sessions.length) * 100) : 0
  , [sessions.length, completedSessionsCount]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
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
    const saved = localStorage.getItem('routine_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        // ignore
      }
    }
    return defaultSettings;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullCalendarOpen, setIsFullCalendarOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [detailModalData, setDetailModalData] = useState<{ type: 'stat' | 'subject' | 'activity' | 'trend'; data: any } | null>(null);

  const [timerInitialMinutes, setTimerInitialMinutes] = useState(25);
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(25 * 60);

  const [profile, setProfile] = useState<UserProfile>({ name: 'Student', grade: 'Grade 10', school: 'Your School', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' });
  const [isGeneratingHomePDF, setIsGeneratingHomePDF] = useState(false);
  const [showHomePrintOptions, setShowHomePrintOptions] = useState(false);
  const [homePrintDays, setHomePrintDays] = useState('7');

  const lastSupabaseSaveRef = useRef<number>(0);

  // Timer Persistence
  useEffect(() => {
    if (!user || isLoading) return;
    
    const saveTimerState = async (force = false) => {
      const now = Date.now();
      // Save to localStorage immediately
      const timerState = {
        total_seconds: timerTotalSeconds,
        time_left: timerTimeLeft,
        is_active: isTimerActive,
        last_saved_at: now
      };
      localStorage.setItem(`cached_timer_${user.id}`, JSON.stringify(timerState));

      // Only save to Supabase if forced, or if it's been 30 seconds, or if timer state changed (active/inactive)
      const shouldSaveToSupabase = force || 
                                   (now - lastSupabaseSaveRef.current > 30000) || 
                                   !isTimerActive;

      if (shouldSaveToSupabase) {
        lastSupabaseSaveRef.current = now;
        try {
          await storage.saveTimer(user.id, timerState);
        } catch (err) {
          console.warn('Failed to sync timer to Supabase:', err);
        }
      }
    };

    // If timer is active, we save every 10 seconds (throttled by the 30s check for Supabase)
    // If timer is NOT active, we save immediately (debounced)
    if (isTimerActive) {
      const interval = setInterval(() => saveTimerState(), 10000);
      return () => clearInterval(interval);
    } else {
      const debounceTimer = setTimeout(() => saveTimerState(true), 2000);
      return () => clearTimeout(debounceTimer);
    }
  }, [timerTotalSeconds, timerTimeLeft, isTimerActive, user, isLoading]);

  // Timer Interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timerTimeLeft > 0) {
      interval = setInterval(() => {
        setTimerTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerTimeLeft === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timerTimeLeft]);

  useEffect(() => {
    const isAnyModalOpen = isFullCalendarOpen || isModalOpen || isTrashOpen || !!detailModalData;
    const mainElement = document.querySelector('main');
    
    if (isAnyModalOpen) {
      if (mainElement) mainElement.style.overflow = 'hidden';
    } else {
      if (mainElement) mainElement.style.overflowY = 'auto';
    }
  }, [isFullCalendarOpen, isModalOpen, isTrashOpen, detailModalData]);

  // Optimized refreshData for instant startup
  const refreshData = useCallback(async (userId: string) => {
    // 1. First, try to load from local cache immediately
    const cacheKey = `cached_sessions_${userId}`;
    const trashKey = `cached_trash_${userId}`;
    const routinesKey = `cached_routines_${userId}`;
    
    const cachedSessions = localStorage.getItem(cacheKey);
    const cachedTrash = localStorage.getItem(trashKey);
    const cachedRoutines = localStorage.getItem(routinesKey);
    
    try {
      if (cachedSessions) setSessions(JSON.parse(cachedSessions));
      if (cachedTrash) setTrash(JSON.parse(cachedTrash));
      if (cachedRoutines) setRoutines(JSON.parse(cachedRoutines));
    } catch (e) {
      console.warn('Error parsing cached data:', e);
    }

    // 2. Then, fetch from Supabase in the background
    try {
      const [sessionsData, trashData, routinesData] = await Promise.all([
        storage.getSessions(userId),
        storage.getTrash(userId),
        storage.getRoutines(userId)
      ]);
      
      setSessions(sessionsData);
      setTrash(trashData);
      setRoutines(routinesData);
    } catch (error) {
      console.warn('Background sync failed:', error);
    }
  }, []);

  useEffect(() => {
    // Check session validity on mount to handle "Invalid Refresh Token" errors
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
            console.warn('Invalid session detected, signing out to clear state');
            await supabase.auth.signOut();
          }
        }
      } catch (e) {
        console.error('Error checking session:', e);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    // Timeout for auth loading to prevent hanging
    const authTimeout = setTimeout(() => {
      if (isAuthLoading) {
        console.warn('Auth loading timed out, proceeding as guest');
        setIsAuthLoading(false);
      }
    }, 30000); // Increased to 30s for mobile apps

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(authTimeout);
      const currentUser = session?.user || null;
      
      if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=recovery')) {
        setIsRecovering(true);
      }

      if (currentUser) {
        // Always try to sync guest data if it exists when a real user logs in
        await storage.syncGuestData(currentUser.id).catch(err => console.warn('Guest sync failed:', err));
        
        setUser(currentUser);
        setIsGuestMode(false);
        refreshData(currentUser.id);
        storage.getProfile(currentUser.id).then(p => {
          setProfile(p);
        }).catch(err => console.warn('Failed to load profile:', err));
      } else {
        // Only clear user if we're not in guest mode
        setUser(prev => {
          if (prev?.id === 'guest_user') return prev;
          return null;
        });
      }
      setIsAuthLoading(false);
    });

    // Add online listener to sync data when connection is restored
    const handleOnline = () => {
      if (user?.id && user.id !== 'guest_user') {
        console.log('App is online, triggering sync...');
        storage.syncOfflineData(user.id);
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      clearTimeout(authTimeout);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshData]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
    // Clear all local storage related to auth to be sure
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase.auth') || key.includes('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    setProfile({ name: 'Guest User', grade: 'Guest', school: 'Offline Mode', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest' });
    setSessions([]);
    setTrash([]);
    setUser(null);
    setIsGuestMode(false);
  };

  const handleGuestUser = () => {
    setIsGuestMode(true);
    setUser({ id: 'guest_user', email: 'guest@example.com' });
    setActiveTab('home');
  };

  // Auto-sync twice a day (at 6:00 AM and 6:00 PM)
  useEffect(() => {
    if (!user) return;

    const checkSync = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const today = format(now, 'yyyy-MM-dd');
      const lastSyncKey = `last_auto_sync_${user.id}`;
      const lastSyncData = safeParse(localStorage.getItem(lastSyncKey), { date: '', hours: [] });

      // Sync at 6 AM or 6 PM
      const targetHours = [6, 18];
      const currentTargetHour = targetHours.find(h => currentHour === h);

      if (currentTargetHour !== undefined) {
        const alreadySyncedThisHour = lastSyncData.date === today && lastSyncData.hours.includes(currentTargetHour);
        
        if (!alreadySyncedThisHour) {
          console.log(`Auto-sync triggered at ${currentTargetHour}:00`);
          storage.fullSync(user.id).then(() => {
            const updatedSyncData = {
              date: today,
              hours: lastSyncData.date === today ? [...lastSyncData.hours, currentTargetHour] : [currentTargetHour]
            };
            localStorage.setItem(lastSyncKey, JSON.stringify(updatedSyncData));
          });
        }
      }
    };

    const interval = setInterval(checkSync, 60000); // Check every minute
    checkSync(); // Initial check

    return () => clearInterval(interval);
  }, [user]);

  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    const success = await storage.fullSync(user.id);
    setIsSyncing(false);
    
    if (success) {
      // Refresh data after sync
      storage.getSessions(user.id).then(setSessions).catch(err => console.warn('Refresh sessions failed:', err));
      storage.getTrash(user.id).then(setTrash).catch(err => console.warn('Refresh trash failed:', err));
      storage.getSettings(user.id).then(setSettings).catch(err => console.warn('Refresh settings failed:', err));
      storage.getProfile(user.id).then(setProfile).catch(err => console.warn('Refresh profile failed:', err));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      
      // Create a timeout promise and a way to clear it
      let timeoutId: any = null;
      
      try {
        // Cleanup local cache for data older than 7 days
        storage.cleanupLocalCache(user.id);
        
        // Sync any pending offline data
        if (navigator.onLine) {
          await storage.syncOfflineData(user.id).catch(err => console.warn('Offline sync failed:', err));
        }

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Timeout loading data')), 30000);
        });

        const dataPromise = Promise.all([
          storage.getSessions(user.id),
          storage.getTrash(user.id),
          storage.getSettings(user.id),
          storage.getProfile(user.id),
          storage.getTimer(user.id)
        ]);

        // Race the data fetch against the timeout
        const result = await Promise.race([
          dataPromise,
          timeoutPromise
        ]);
        
        // Clear the timeout if dataPromise wins
        if (timeoutId) clearTimeout(timeoutId);

        const [sessionsData, trashData, settingsData, profileData, timerData] = result as [StudySession[], StudySession[], AppSettings, UserProfile, TimerState | null];

        setSessions(sessionsData);
        setTrash(trashData);
        setSettings(settingsData);
        setProfile(profileData);

        if (timerData) {
          setTimerTotalSeconds(timerData.total_seconds);
          setTimerInitialMinutes(Math.floor(timerData.total_seconds / 60));
          
          // If timer was active, calculate elapsed time
          if (timerData.is_active) {
            const elapsed = Math.floor((Date.now() - timerData.last_saved_at) / 1000);
            const newTimeLeft = Math.max(0, timerData.time_left - elapsed);
            setTimerTimeLeft(newTimeLeft);
            setIsTimerActive(newTimeLeft > 0);
          } else {
            setTimerTimeLeft(timerData.time_left);
            setIsTimerActive(false);
          }
        }
      } catch (error) {
        console.warn('Error loading data from Supabase:', error);
        if (timeoutId) clearTimeout(timeoutId);
        
        // Fallback to cache if Supabase fails or times out
        try {
          const cachedSessions = localStorage.getItem(`cached_sessions_${user.id}`);
          const cachedTrash = localStorage.getItem(`cached_trash_${user.id}`);
          const cachedSettings = localStorage.getItem(`cached_settings_${user.id}`);
          const cachedProfile = localStorage.getItem(`cached_profile_${user.id}`);
          const cachedTimer = localStorage.getItem(`cached_timer_${user.id}`);
          const cachedRoutines = localStorage.getItem(`cached_routines_${user.id}`);

          if (cachedSessions) setSessions(JSON.parse(cachedSessions));
          if (cachedTrash) setTrash(JSON.parse(cachedTrash));
          if (cachedSettings) setSettings(JSON.parse(cachedSettings));
          if (cachedProfile) setProfile(JSON.parse(cachedProfile));
          if (cachedRoutines) setRoutines(JSON.parse(cachedRoutines));
          
          if (cachedTimer) {
            const timerData = JSON.parse(cachedTimer);
            setTimerTotalSeconds(timerData.total_seconds);
            setTimerInitialMinutes(Math.floor(timerData.total_seconds / 60));
            setTimerTimeLeft(timerData.time_left);
            setIsTimerActive(false);
          }
        } catch (e) {
          console.warn('Error parsing cached data in fallback:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Apply theme
  useLayoutEffect(() => {
    if (settings.dark_mode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [settings.dark_mode]);

  useEffect(() => {
    const saveSettings = async () => {
      if (isLoading || !user) return;
      await storage.saveSettings(user.id, settings);
    };
    saveSettings();
  }, [settings, isLoading, user]);

  useEffect(() => {
    // Initial load - this will be near-instant due to local cache check inside refreshData
    if (user) refreshData(user.id);
    
    // Listen for online status to sync data
    const handleOnline = () => {
      if (user) storage.syncOfflineData(user.id).then(() => refreshData(user.id)).catch(err => console.warn('Sync offline data failed:', err));
    };

    window.addEventListener('online', handleOnline);
    
    // Initial sync check
    if (navigator.onLine && user) {
      storage.syncOfflineData(user.id).then(() => refreshData(user.id)).catch(err => console.warn('Initial sync failed:', err));
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [user, refreshData]);

  useEffect(() => {
    // Request permissions on mount
    notificationService.requestPermissions();

    // Handle notification clicks
    const actionListenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      console.log('Notification action performed:', notification);
    });

    return () => {
      actionListenerPromise.then(handle => handle.remove());
    };
  }, []);

  useEffect(() => {
    if (user && user.id !== 'guest_user') {
      notificationService.scheduleReminders(sessions, routines, settings);
    }

    // Reschedule when app comes back to foreground to ensure accuracy
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && user.id !== 'guest_user') {
        notificationService.scheduleReminders(sessions, routines, settings);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessions, routines, settings, user]);

  const handleReorder = async (newOrder: StudySession[], isCompleted: boolean) => {
    if (!user) return;
    const currentDayIds = new Set(newOrder.map(s => s.id));
    const otherSessions = sessions.filter(s => !currentDayIds.has(s.id));
    const finalSessions = [...otherSessions, ...newOrder];
    
    setSessions(finalSessions);
    await storage.saveSessions(user.id, finalSessions);
  };

  const handleAddSession = async (newSession: Omit<StudySession, 'id' | 'date' | 'completed' | 'user_id'>) => {
    console.log('handleAddSession called with:', newSession);
    if (!newSession.subject || !newSession.chapter) {
      console.warn('Missing subject or chapter in handleAddSession');
      return;
    }
    if (!user) {
      console.warn('No user found in handleAddSession');
      return;
    }
    
    try {
      // Fallback for UUID generation
      const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const session: StudySession = {
        ...newSession,
        id: sessionId,
        user_id: user.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        completed: false
      };
      
      console.log('Saving session to storage:', session);
      await storage.saveSession(user.id, session);
      console.log('Session saved, refreshing data...');
      await refreshData(user.id);
      setIsModalOpen(false);
      console.log('Modal closed');
    } catch (error) {
      console.warn('Error adding session to Supabase:', error);
      // You could add a toast notification here if you have one
    }
  };

  const toggleComplete = async (id: string) => {
    if (!user) return;
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    // Optimistic update
    const newCompleted = !session.completed;
    setSessions(prev => prev.map(s => s.id === id ? { ...s, completed: newCompleted } : s));
    
    // Update storage (this also updates local cache)
    await storage.toggleSession(user.id, id, newCompleted);
  };

  const handleRestoreSession = async (id: string) => {
    if (!user) return;
    await storage.restoreFromTrash(user.id, id);
    await refreshData(user.id);
  };

  const handlePermanentDelete = async (id: string) => {
    if (!user) return;
    await storage.permanentlyDelete(user.id, id);
    await refreshData(user.id);
  };

  const generateHomePDF = async () => {
    if (isGeneratingHomePDF) return;
    setIsGeneratingHomePDF(true);
    
    try {
      const days = parseInt(homePrintDays) || 7;
      
      // Sort sessions by date ascending
      const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (sortedSessions.length === 0) {
        setIsGeneratingHomePDF(false);
        setShowHomePrintOptions(false);
        return;
      }

      // Calculate the date range
      // End date is the latest session date, start date is 'days' before that
      const endDate = startOfDay(new Date(sortedSessions[sortedSessions.length - 1].date));
      const startDate = subDays(endDate, days - 1);
      
      // Generate ALL dates in the range to ensure we show exactly 'days' days
      const allDatesInRange: string[] = [];
      for (let i = 0; i < days; i++) {
        allDatesInRange.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
      }

      // Group sessions by date
      const groupedSessions: { [date: string]: StudySession[] } = {};
      sessions.forEach(s => {
        const dateStr = s.date.includes('T') ? format(new Date(s.date), 'yyyy-MM-dd') : s.date;
        if (!groupedSessions[dateStr]) groupedSessions[dateStr] = [];
        groupedSessions[dateStr].push(s);
      });

      // Chunk dates into pages (7 days per page to ensure it fits on A4 comfortably)
      const daysPerPage = 7;
      const dateChunks = [];
      for (let i = 0; i < allDatesInRange.length; i += daysPerPage) {
        dateChunks.push(allDatesInRange.slice(i, i + daysPerPage));
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < dateChunks.length; i++) {
        if (i > 0) pdf.addPage();
        
        const chunk = dateChunks[i];
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.style.padding = '40px';
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.color = '#000000';
        tempContainer.style.fontFamily = '"Hind Siliguri", "Inter", sans-serif';
        
        let htmlContent = `
          <div style="font-family: 'Hind Siliguri', sans-serif; color: #333; background-color: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px;">
              <div>
                <h1 style="font-size: 28px; color: #4F46E5; margin: 0; font-weight: bold;">Study Diary Report</h1>
                <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Page ${i + 1} of ${dateChunks.length} | ${days} Days Plan</p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 11px; color: #999; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Generated on</p>
                <p style="font-size: 14px; color: #444; font-weight: bold; margin: 0;">${format(new Date(), 'MMM d, yyyy HH:mm')}</p>
              </div>
            </div>
            
            <div style="font-size: 14px; color: #444; margin-bottom: 25px; background-color: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px;">
              <span style="color: #4F46E5; font-weight: bold;">Report Period:</span>
              <span>${format(startDate, 'MMM d, yyyy')}</span>
              <span style="color: #cbd5e1;">&rarr;</span>
              <span>${format(endDate, 'MMM d, yyyy')}</span>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background-color: #4F46E5; color: #ffffff;">
                  <th style="padding: 14px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.2); border-right: 1px solid rgba(255,255,255,0.2);">Date</th>
                  <th style="padding: 14px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.2); border-right: 1px solid rgba(255,255,255,0.2);">Subject</th>
                  <th style="padding: 14px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.2); border-right: 1px solid rgba(255,255,255,0.2);">Chapter</th>
                  <th style="padding: 14px 12px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.2); border-right: 1px solid rgba(255,255,255,0.2);">Status</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        chunk.forEach((dateStr, idx) => {
          const daySessions = groupedSessions[dateStr] || [];
          const isLastDate = idx === chunk.length - 1;
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

          if (daySessions.length === 0) {
            // Empty day row
            htmlContent += `
              <tr style="background-color: ${rowBg};">
                <td style="padding: 14px 12px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; border-right: 1px solid #e2e8f0; vertical-align: top; width: 130px;">
                  <div style="font-weight: 800; color: #1e293b; font-size: 15px;">${format(new Date(dateStr), 'MMM d')}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 500;">${format(new Date(dateStr), 'EEEE')}</div>
                </td>
                <td colspan="3" style="padding: 14px 12px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; color: #94a3b8; font-style: italic; font-size: 13px; text-align: center; border-right: 1px solid #e2e8f0;">No tasks recorded for this day</td>
              </tr>
            `;
          } else {
            daySessions.forEach((s, sIdx) => {
              const isLastSession = sIdx === daySessions.length - 1;
              const borderBottom = (isLastDate && isLastSession) ? 'none' : '1px solid #e2e8f0';

              htmlContent += `
                <tr style="background-color: ${rowBg};">
                  ${sIdx === 0 ? `
                    <td style="padding: 14px 12px; border-bottom: ${isLastDate ? 'none' : '1px solid #e2e8f0'}; border-right: 1px solid #e2e8f0; vertical-align: top; width: 130px;" rowspan="${daySessions.length}">
                      <div style="font-weight: 800; color: #1e293b; font-size: 15px;">${format(new Date(dateStr), 'MMM d')}</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px; font-weight: 500;">${format(new Date(dateStr), 'EEEE')}</div>
                    </td>
                  ` : ''}
                  <td style="padding: 14px 12px; border-bottom: ${borderBottom}; border-right: 1px solid #e2e8f0; color: #4F46E5; font-weight: 700; font-size: 14px;">${s.subject}</td>
                  <td style="padding: 14px 12px; border-bottom: ${borderBottom}; border-right: 1px solid #e2e8f0; color: #334155; font-size: 13px; font-weight: 500;">${s.chapter}</td>
                  <td style="padding: 14px 12px; border-bottom: ${borderBottom}; border-right: 1px solid #e2e8f0; text-align: center; width: 110px;">
                    <div style="display: inline-block; padding: 6px 10px; border-radius: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; ${s.completed ? 'background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : 'background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'}">
                      ${s.completed ? 'Done' : 'Pending'}
                    </div>
                  </td>
                </tr>
              `;
            });
          }
        });
        
        htmlContent += `
              </tbody>
            </table>
            <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
              <p style="font-size: 10px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Study Planner - Professional Diary Export</p>
              <div style="display: flex; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <div style="width: 8px; height: 8px; border-radius: 2px; background-color: #dcfce7; border: 1px solid #bbf7d0;"></div>
                  <span style="font-size: 9px; color: #64748b; font-weight: 600;">Completed</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                  <div style="width: 8px; height: 8px; border-radius: 2px; background-color: #fee2e2; border: 1px solid #fecaca;"></div>
                  <span style="font-size: 9px; color: #64748b; font-weight: 600;">Pending</span>
                </div>
              </div>
            </div>
          </div>
        `;
        
        tempContainer.innerHTML = htmlContent;
        document.body.appendChild(tempContainer);

        await document.fonts.ready;

        const canvas = await html2canvas(tempContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        
        document.body.removeChild(tempContainer);
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        
        let heightLeft = pdfHeight;
        let position = 0;

        // Add the first page for this chunk
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdfPageHeight;

        // If the chunk overflows the page, add more pages
        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdfPageHeight;
        }
      }

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = `study_diary_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Study Diary',
          url: result.uri,
        });
      } else {
        pdf.save(`study_diary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      }
    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingHomePDF(false);
      setShowHomePrintOptions(false);
    }
  };

  const nextWeek = () => setViewDate(prev => addDays(prev, 7));
  const prevWeek = () => setViewDate(prev => addDays(prev, -7));
  
  const sessionsForDate = useCallback((date: Date) => {
    const targetDate = format(date, 'yyyy-MM-dd');
    return sessions.filter(s => {
      // Handle both old ISO strings and new YYYY-MM-DD strings
      const sessionDate = s.date.includes('T') ? format(new Date(s.date), 'yyyy-MM-dd') : s.date;
      return sessionDate === targetDate;
    });
  }, [sessions]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfMonth(calendarMonth);
    const days = [];
    let current = start;
    
    // Show 6 weeks to keep grid consistent
    for (let i = 0; i < 42; i++) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [calendarMonth]);

  const handleDeleteSession = async (id: string) => {
    if (!user) return;
    await storage.deleteSession(user.id, id);
    await refreshData(user.id);
  };

  const currentDaySessions = useMemo(() => sessionsForDate(selectedDate), [selectedDate, sessionsForDate]);
  const pendingSessions = useMemo(() => currentDaySessions.filter(s => !s.completed), [currentDaySessions]);
  const completedSessions = useMemo(() => currentDaySessions.filter(s => s.completed), [currentDaySessions]);

  const daysWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => {
      const dateStr = s.date.includes('T') ? format(new Date(s.date), 'yyyy-MM-dd') : s.date;
      set.add(dateStr);
    });
    return set;
  }, [sessions]);

  if (isAuthLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-all duration-500",
        settings.dark_mode ? "bg-[#0A0E14]" : "bg-gray-50"
      )}>
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if ((!user && !isGuestMode) || isRecovering) {
    return (
      <AuthPage 
        onGuestAccess={handleGuestUser} 
        darkMode={settings.dark_mode}
        onToggleTheme={() => setSettings(s => ({ ...s, dark_mode: !s.dark_mode }))}
        isRecovering={isRecovering}
        onResetComplete={() => setIsRecovering(false)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-all duration-500",
        settings.dark_mode ? "bg-[#0A0E14]" : "bg-gray-50"
      )}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className={cn(
            "font-bold animate-pulse",
            settings.dark_mode ? "text-gray-500" : "text-gray-400"
          )}>Syncing with Database...</p>
          <button 
            onClick={() => setIsLoading(false)}
            className={cn(
              "mt-4 text-xs underline transition-colors",
              settings.dark_mode ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Skip and use offline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full h-[100dvh] bg-background flex flex-col md:flex-row w-full max-w-full overflow-hidden border-none">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-none md:border-r border-white/5 light:border-gray-200 p-6 fixed h-full z-50 transition-colors">
        <div className="mb-12 px-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Study Routine</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Minimalist Planner</p>
        </div>
        
        <nav className="flex-1 space-y-2">
          <SidebarLink active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon />} label="Diary" />
          <SidebarLink active={activeTab === 'routine'} onClick={() => setActiveTab('routine')} icon={<Calendar />} label="Routine" />
          <SidebarLink active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart2 />} label="Overview" />
          <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon />} label="Settings" />
        </nav>

        <div className="mt-auto">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all md:shadow-lg md:shadow-primary/20"
          >
            <Plus size={18} />
            Add Task
          </motion.button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 relative h-full overflow-y-auto overflow-x-hidden w-full scrollbar-hide border-none scroll-smooth touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-5xl mx-auto w-full pb-32 md:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                layout="position" // Only animate position changes to reduce layout calculations
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="px-5 py-6 md:p-10 space-y-8 overflow-x-hidden border-none"
              >
                  <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl py-4 flex justify-between items-center transition-colors">
                    <div>
                      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Diary</h1>
                      <p className="text-gray-400 mt-1 text-base md:text-lg">{format(selectedDate, 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="relative">
                        <button 
                          onClick={() => setShowHomePrintOptions(!showHomePrintOptions)}
                          className="w-14 h-14 flex items-center justify-center bg-card rounded-full border border-white/5 light:border-gray-200 text-primary hover:bg-white/10 light:hover:bg-gray-100 transition-all"
                        >
                          <Download size={24} />
                        </button>

                        <AnimatePresence>
                          {showHomePrintOptions && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className={cn(
                                "absolute right-0 top-16 z-50 w-48 p-4 rounded-xl border shadow-xl",
                                settings.dark_mode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                              )}
                            >
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 text-indigo-500">
                                  <Download size={16} />
                                  <span className="text-xs font-bold uppercase tracking-wider">Download Diary</span>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Number of Days</label>
                                  <input 
                                    type="number"
                                    value={homePrintDays}
                                    onChange={(e) => setHomePrintDays(e.target.value)}
                                    className={cn(
                                      "w-full px-3 py-2 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                      settings.dark_mode ? "bg-slate-900 text-white border-slate-700" : "bg-slate-100 text-slate-900 border-slate-200"
                                    )}
                                    placeholder="e.g. 7"
                                  />
                                </div>

                                <button
                                  onClick={generateHomePDF}
                                  disabled={isGeneratingHomePDF}
                                  className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                                >
                                  {isGeneratingHomePDF ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                  {isGeneratingHomePDF ? 'Generating...' : 'Done'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <button 
                        onClick={() => setIsFullCalendarOpen(true)}
                        className="w-14 h-14 flex items-center justify-center bg-card rounded-full border border-white/5 light:border-gray-200 text-primary hover:bg-white/10 light:hover:bg-gray-100 transition-all"
                      >
                        <Calendar size={24} />
                      </button>
                    </div>
                  </header>

                {isGuestMode && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertCircle className="text-amber-500" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-bold">Guest Mode Active</p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        Your data is only saved locally. Uninstalling the app will remove your data. 
                        Sign in to sync across devices.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Week Date Picker */}
                <div className="relative border-none space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                      {format(startOfWeek(viewDate, { weekStartsOn: 1 }), 'MMM d')} - {format(addDays(startOfWeek(viewDate, { weekStartsOn: 1 }), 6), 'MMM d')}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={prevWeek} className="p-2 bg-card rounded-xl border border-white/5 light:border-gray-200 text-gray-400 hover:text-white light:hover:text-gray-900 transition-colors">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={nextWeek} className="p-2 bg-card rounded-xl border border-white/5 light:border-gray-200 text-gray-400 hover:text-white light:hover:text-gray-900 transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1 w-full overflow-hidden border-none px-1">
                    {getWeekDays(viewDate).map((day) => {
                      const isActive = isSameDay(day, selectedDate);
                      return (
                        <button
                          key={day.toString()}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "flex-1 flex flex-col items-center py-3 rounded-xl transition-all duration-300",
                            isActive 
                              ? "bg-primary text-white shadow-md shadow-primary/20" 
                              : "bg-card border border-white/5 light:border-gray-200"
                          )}
                        >
                          <span className={cn(
                            "text-[8px] md:text-xs uppercase font-bold mb-0.5",
                            isActive ? "text-white/70" : "text-gray-500"
                          )}>{format(day, 'eee')}</span>
                          <span className={cn(
                            "text-sm md:text-xl font-bold",
                            isActive ? "text-white" : "text-foreground"
                          )}>{format(day, 'd')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Tasks Section */}
                  <section className="space-y-6">
                    <div className="flex flex-col gap-4">
                      {/* Header Row: Tasks and Add Task Button (Strictly Static) */}
                      <div className="relative h-14 w-full">
                        {/* Static Header Elements */}
                        <div className="flex items-center justify-between h-full">
                          <div className="flex items-center shrink-0">
                            <h2 className="text-2xl font-bold">Tasks</h2>
                            <Badge count={pendingSessions.length} color="bg-[#2D1B16] text-[#FF7D52]" />
                          </div>

                          <div className="flex items-center justify-end shrink-0">
                            <button 
                              onClick={() => setIsModalOpen(true)}
                              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 shrink-0 z-20"
                            >
                              <Plus size={18} />
                              Add Task
                            </button>
                          </div>
                        </div>

                        {/* Centered Timer Slot (Absolute) */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
                          {!isTimerExpanded && pendingSessions.length > 0 && (
                            <div className="pointer-events-auto">
                              <Timer 
                                layoutId="timer-component"
                                isExpanded={false}
                                onToggleExpand={() => setIsTimerExpanded(true)}
                                initialMinutes={timerInitialMinutes} 
                                onSetInitialMinutes={setTimerInitialMinutes}
                                taskName={pendingSessions[0].subject}
                                onComplete={() => {
                                  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                                  toggleComplete(pendingSessions[0].id);
                                }}
                                timeLeft={timerTimeLeft}
                                setTimeLeft={setTimerTimeLeft}
                                isActive={isTimerActive}
                                setIsActive={setIsTimerActive}
                                totalSeconds={timerTotalSeconds}
                                setTotalSeconds={setTimerTotalSeconds}
                                darkMode={settings.dark_mode}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded Timer Slot: Below Header */}
                      <AnimatePresence mode="popLayout">
                        {isTimerExpanded && pendingSessions.length > 0 && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="overflow-hidden flex justify-center"
                          >
                            <div className="pb-4">
                              <Timer 
                                layoutId="timer-component"
                                isExpanded={true}
                                onToggleExpand={() => setIsTimerExpanded(false)}
                                initialMinutes={timerInitialMinutes} 
                                onSetInitialMinutes={setTimerInitialMinutes}
                                taskName={pendingSessions[0].subject}
                                onComplete={() => {
                                  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                                  toggleComplete(pendingSessions[0].id);
                                }}
                                timeLeft={timerTimeLeft}
                                setTimeLeft={setTimerTimeLeft}
                                isActive={isTimerActive}
                                setIsActive={setIsTimerActive}
                                totalSeconds={timerTotalSeconds}
                                setTotalSeconds={setTimerTotalSeconds}
                                darkMode={settings.dark_mode}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Task List */}
                      <Reorder.Group 
                        axis="y" 
                        values={pendingSessions} 
                        onReorder={(newOrder) => handleReorder(newOrder, false)}
                        className="space-y-4"
                      >
                        <AnimatePresence mode="sync" initial={false}>
                          {pendingSessions.length === 0 ? (
                            <motion.div 
                              key="empty-pending"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="dashed-border h-32 flex items-center justify-center text-gray-500 font-medium italic"
                            >
                              All tasks completed!
                            </motion.div>
                          ) : (
                            pendingSessions.map((s, index) => (
                              <ReorderableTaskItem 
                                key={s.id + '-' + index}
                                s={s}
                                index={index}
                                onToggle={() => toggleComplete(s.id)}
                                onDelete={() => setTaskToDelete(s.id)}
                                onClick={() => setExpandedTaskId(expandedTaskId === s.id ? null : s.id)}
                                isExpanded={expandedTaskId === s.id || (expandedTaskId === null && index === 0)}
                              />
                            ))
                          )}
                        </AnimatePresence>
                      </Reorder.Group>
                    </div>
                  </section>

                  {/* Completed Section */}
                  <section className="space-y-6">
                    <div className="flex items-center">
                      <h2 className="text-2xl font-bold">Completed</h2>
                      <Badge count={completedSessions.length} color="bg-[#162D1E] text-[#52FF8C]" />
                    </div>
                    <Reorder.Group 
                      axis="y" 
                      values={completedSessions} 
                      onReorder={(newOrder) => handleReorder(newOrder, true)}
                      className="space-y-4"
                    >
                      <AnimatePresence mode="sync" initial={false}>
                        {completedSessions.length === 0 ? (
                          <motion.div 
                            key="empty-completed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="dashed-border h-32 flex items-center justify-center text-gray-500 font-medium italic"
                          >
                            No tasks completed yet.
                          </motion.div>
                        ) : (
                          completedSessions.map((s, index) => (
                            <ReorderableTaskItem 
                              key={s.id + '-' + index}
                              s={s}
                              index={index}
                              onToggle={() => toggleComplete(s.id)}
                              onDelete={() => setTaskToDelete(s.id)}
                              onClick={() => setExpandedTaskId(expandedTaskId === s.id ? null : s.id)}
                              isExpanded={expandedTaskId === s.id}
                            />
                          ))
                        )}
                      </AnimatePresence>
                    </Reorder.Group>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'routine' && (
              <motion.div 
                key="routine"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="px-5 py-6 md:p-10 space-y-8 overflow-x-hidden border-none"
              >
                <RoutinePage 
                  routines={routines}
                  onSaveRoutine={async (routine) => {
                    if (user) {
                      await storage.saveRoutine(user.id, routine);
                      await refreshData(user.id);
                    }
                  }}
                  onDeleteRoutine={async (id) => {
                    if (user) {
                      await storage.deleteRoutine(user.id, id);
                      await refreshData(user.id);
                    }
                  }}
                  onRestoreRoutine={async (id) => {
                    if (user) {
                      await storage.restoreRoutine(user.id, id);
                      await refreshData(user.id);
                    }
                  }}
                  onPermanentlyDeleteRoutine={async (id) => {
                    if (user) {
                      await storage.permanentlyDeleteRoutine(user.id, id);
                      await refreshData(user.id);
                    }
                  }}
                  onAddTask={async (subject, chapter, topics, date, reminder_time) => {
                    if (user) {
                      const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID 
                        ? crypto.randomUUID() 
                        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

                      const session: StudySession = {
                        id: sessionId,
                        user_id: user.id,
                        subject,
                        chapter,
                        topics,
                        color: '#5856D6',
                        icon: 'Book',
                        date,
                        completed: false,
                        reminder_time
                      };
                      
                      await storage.saveSession(user.id, session);
                      await refreshData(user.id);
                      setActiveTab('home');
                    }
                  }}
                  user={user}
                  darkMode={settings.dark_mode}
                />
              </motion.div>
            )}

            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                layout="position"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="p-6 md:p-10 space-y-8 overflow-x-hidden"
              >
                <header>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Overview</h1>
                  <p className="text-gray-400 mt-1 text-lg">Visualize your learning progress</p>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    icon={<Zap size={20} />} 
                    label="TOTAL SESSIONS" 
                    value={sessions.length.toString()} 
                    color="text-indigo-400" 
                    onClick={() => setDetailModalData({ 
                      type: 'stat', 
                      data: { 
                        title: 'Total Sessions', 
                        value: sessions.length.toString(),
                        description: 'Total number of study sessions you have planned and executed since you started using Routine.'
                      } 
                    })}
                  />
                  <StatCard 
                    icon={<Book size={20} />} 
                    label="ACTIVE SUBJECTS" 
                    value={new Set(sessions.map(s => s.subject)).size.toString()} 
                    color="text-pink-400" 
                    onClick={() => setDetailModalData({ 
                      type: 'stat', 
                      data: { 
                        title: 'Active Subjects', 
                        value: new Set(sessions.map(s => s.subject)).size.toString(),
                        description: 'The number of unique subjects you are currently focusing on. Diversity in subjects helps keep your mind fresh!'
                      } 
                    })}
                  />
                  <StatCard 
                    icon={<Target size={20} />} 
                    label="EFFICIENCY" 
                    value={`${efficiencyRate}%`} 
                    color="text-emerald-400" 
                    onClick={() => setDetailModalData({ 
                      type: 'stat', 
                      data: { 
                        title: 'Efficiency Rate', 
                        value: `${efficiencyRate}%`,
                        description: 'Percentage of planned sessions that you have successfully completed. Aim for 80% or higher for optimal results.'
                      } 
                    })}
                  />
                  <StatCard 
                    icon={<Flame size={20} />} 
                    label="STREAK" 
                    value={`${calculateStreak(sessions)} days`} 
                    color="text-orange-400" 
                    onClick={() => setDetailModalData({ 
                      type: 'stat', 
                      data: { 
                        title: 'Study Streak', 
                        value: `${calculateStreak(sessions)} days`,
                        description: 'Consecutive days with at least one completed study session. Keep the flame alive!'
                      } 
                    })}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="hover:bg-white/[0.02] light:hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => setDetailModalData({ type: 'trend', data: { title: 'Activity Trends' } })}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Activity size={18} className="text-primary" />
                        </div>
                        <h3 className="font-bold text-foreground">Activity Trends</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Weekly Total</p>
                        <p className="text-xl font-black text-foreground">{last7DaysSessions.length}</p>
                      </div>
                    </div>
                    <div className="h-64 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={generateChartData(sessions)}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#5856D6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#5856D6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={settings.dark_mode ? "#ffffff05" : "#00000005"} vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: settings.dark_mode ? '#4B5563' : '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                            dy={10}
                          />
                          <YAxis hide />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className={cn(
                                    "border p-3 rounded-xl shadow-2xl backdrop-blur-xl",
                                    settings.dark_mode ? "bg-[#161B22] border-white/10" : "bg-white border-gray-200"
                                  )}>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{payload[0].payload.name}</p>
                                    <p className={cn(
                                      "text-lg font-black",
                                      settings.dark_mode ? "text-white" : "text-gray-900"
                                    )}>{payload[0].value} <span className="text-xs font-normal text-gray-400">Sessions</span></p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#5856D6" 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorCount)"
                            animationDuration={2000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="hover:bg-white/[0.02] light:hover:bg-gray-50 transition-colors relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-pink-400/10 flex items-center justify-center">
                          <PieChartIcon size={18} className="text-pink-400" />
                        </div>
                        <h3 className="font-bold text-foreground">Subject Focus</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Most Focused</p>
                        <p className="text-sm font-bold text-foreground truncate max-w-[100px]">
                          {generatePieData(sessions).sort((a, b) => b.value - a.value)[0]?.name || 'None'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="h-48 relative">
                        {sessions.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={generatePieData(sessions)}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={8}
                                  dataKey="value"
                                  stroke="none"
                                  onClick={(data: any) => setDetailModalData({ 
                                    type: 'subject', 
                                    data: { 
                                      title: data.name, 
                                      count: data.value,
                                      completedCount: data.completedCount
                                    } 
                                  })}
                                  className="cursor-pointer"
                                >
                                  {generatePieData(sessions).map((entry, index) => (
                                    <Cell key={`cell-${index}-${entry.name}`} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <p className="text-3xl font-black text-foreground">{sessions.length}</p>
                              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Total</p>
                            </div>
                          </>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <p className="text-5xl font-bold">0</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Total</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {generatePieData(sessions).slice(0, 4).map((entry, index) => (
                          <div key={`pie-item-${index}-${entry.name}`} className="flex items-center justify-between group/item cursor-pointer" onClick={() => setDetailModalData({ 
                            type: 'subject', 
                            data: { 
                              title: entry.name, 
                              count: entry.value,
                              completedCount: entry.completedCount
                            } 
                          })}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs font-bold text-gray-400 light:text-gray-600 truncate max-w-[80px]">{entry.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-foreground bg-white/5 light:bg-gray-100 px-2 py-0.5 rounded-full">
                              {Math.round((entry.value / sessions.length) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>

                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-emerald-400" />
                      <h3 className="font-bold text-foreground">Recent Activity</h3>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Last 6 Sessions</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.slice(-6).reverse().map((s, index) => (
                      <button 
                        key={s.id + '-' + index} 
                        onClick={() => setDetailModalData({ type: 'activity', data: s })}
                        className="flex items-center gap-4 p-4 bg-white/[0.03] light:bg-gray-50 rounded-2xl border border-white/5 light:border-gray-200 hover:bg-white/[0.08] light:hover:bg-gray-100 transition-all text-left active:scale-95"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                          <IconRenderer name={s.icon} size={24} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate text-foreground">{s.subject}</p>
                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{format(new Date(s.date), 'MMM d • h:mm a')}</p>
                        </div>
                      </button>
                    ))}
                    {sessions.length === 0 && (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <Activity size={32} className="opacity-20" />
                        <p className="italic text-sm">No activity recorded yet.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="p-6 md:p-10 space-y-8 overflow-x-hidden"
              >
                <header className="flex justify-between items-center">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Settings</h1>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={cn(
                        "w-14 h-14 flex items-center justify-center bg-card light:bg-white rounded-full border border-white/5 light:border-gray-200 text-gray-400 hover:text-primary transition-all relative shadow-sm",
                        isSyncing && "animate-spin text-primary"
                      )}
                      title="Sync Data"
                    >
                      <RefreshCw size={24} />
                    </button>
                    <button 
                      onClick={() => setIsTrashOpen(true)}
                      className="w-14 h-14 flex items-center justify-center bg-card light:bg-white rounded-full border border-white/5 light:border-gray-200 text-gray-400 hover:text-primary transition-all relative shadow-sm"
                      title="Recycle Bin"
                    >
                      <Trash2 size={24} />
                      {trash.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
                          {trash.length}
                        </span>
                      )}
                    </button>
                  </div>
                </header>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Settings Sidebar */}
                    <div className="w-full lg:w-72 space-y-3">
                      <button 
                        onClick={() => setActiveSettingsSection('preferences')}
                        className={cn(
                          "w-full p-5 rounded-[32px] flex items-center justify-between transition-all group",
                          activeSettingsSection === 'preferences' 
                            ? "bg-primary text-white shadow-2xl shadow-primary/30" 
                            : "bg-white/5 light:bg-gray-100 text-gray-400 hover:bg-white/10 light:hover:bg-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                            activeSettingsSection === 'preferences' ? "bg-white/20" : "bg-white/5"
                          )}>
                            <SettingsIcon size={24} />
                          </div>
                          <div className="text-left">
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-widest mb-0.5",
                              activeSettingsSection === 'preferences' ? "text-white/60" : "text-gray-500"
                            )}>Preferences</p>
                            <p className="font-bold text-lg">General</p>
                          </div>
                        </div>
                        <ChevronRight size={20} className={cn(
                          "transition-transform",
                          activeSettingsSection === 'preferences' ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                        )} />
                      </button>
                    </div>

                    {/* Settings Content */}
                    <div className="flex-1">
                      <AnimatePresence mode="wait">
                        {activeSettingsSection === 'preferences' && (
                          <motion.div
                          key="preferences-section"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 light:bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                  <Languages size={20} />
                                </div>
                                <span className="font-bold text-foreground">Language</span>
                              </div>
                              <button 
                                onClick={() => setSettings(s => ({ ...s, language: s.language === 'en' ? 'bn' : 'en' }))}
                                className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                              >
                                {settings.language === 'en' ? 'বাংলা' : 'English'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 light:bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                  {settings.dark_mode ? <Moon size={20} /> : <Sun size={20} />}
                                </div>
                                <span className="font-bold text-foreground">Theme</span>
                              </div>
                              <div 
                                onClick={() => setSettings(s => ({ ...s, dark_mode: !s.dark_mode }))}
                                className={cn(
                                  "w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors",
                                  settings.dark_mode ? "bg-primary" : "bg-gray-300"
                                )}
                              >
                                <motion.div 
                                  animate={{ x: settings.dark_mode ? 24 : 0 }}
                                  className="w-4 h-4 bg-white rounded-full shadow-sm" 
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                  <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-foreground">Data Sync</span>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Supabase Cloud</span>
                                </div>
                              </div>
                              <button 
                                onClick={handleManualSync}
                                disabled={isSyncing || isGuestMode}
                                className={cn(
                                  "px-4 py-2 rounded-xl font-bold text-sm transition-all",
                                  isGuestMode 
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                                    : "bg-primary text-white hover:opacity-90 active:scale-95"
                                )}
                              >
                                {isSyncing ? 'Syncing...' : 'Sync Now'}
                              </button>
                            </div>

                            <div className="flex flex-col space-y-4 pt-4 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/5 light:bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                    <Bell size={20} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-foreground">Notifications</span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Smart Reminders</span>
                                  </div>
                                </div>
                                <div 
                                  onClick={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
                                  className={cn(
                                    "w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors",
                                    settings.notifications ? "bg-primary" : "bg-gray-300"
                                  )}
                                >
                                  <motion.div 
                                    animate={{ x: settings.notifications ? 24 : 0 }}
                                    className="w-4 h-4 bg-white rounded-full shadow-sm" 
                                  />
                                </div>
                              </div>


                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
                                  <LogOut size={20} />
                                </div>
                                <span className="font-bold">Account</span>
                              </div>
                              <button 
                                onClick={handleSignOut}
                                className="bg-danger/10 text-danger px-4 py-2 rounded-xl font-bold text-sm hover:bg-danger/20 transition-all flex items-center gap-2"
                              >
                                <LogOut size={14} />
                                Log Out
                              </button>
                            </div>
                          </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-12 text-left opacity-50 space-y-1">
              <p className="text-sm font-medium">Developed by Sadikul I. Saikat</p>
              <p className="text-xs">© 2026 Study Routine All rights reserved.</p>
            </div>
          </motion.div>
        )}
          </AnimatePresence>
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailModalData && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailModalData(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-white/10 rounded-[40px] p-8 md:p-10 space-y-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    {detailModalData.type === 'stat' && <Zap size={24} />}
                    {detailModalData.type === 'subject' && <Book size={24} />}
                    {detailModalData.type === 'activity' && <Activity size={24} />}
                    {detailModalData.type === 'trend' && <BarChart2 size={24} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{detailModalData.data.title || 'Details'}</h2>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{detailModalData.type}</p>
                  </div>
                </div>
                <button onClick={() => setDetailModalData(null)} className="p-2 text-gray-400 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="space-y-6">
                {detailModalData.type === 'trend' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Daily Breakdown (Last 7 Days)</p>
                      <div className="space-y-2">
                        {generateChartData(sessions).map((d, i) => (
                          <div key={`chart-item-${i}-${d.name}`} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span className="text-sm font-bold">{d.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (d.count / 5) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-primary">{d.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center italic">
                      This chart shows your session frequency over the past week. Consistency is key to long-term retention.
                    </p>
                  </div>
                )}

                {detailModalData.type === 'activity' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date</p>
                        <p className="font-bold">{format(new Date(detailModalData.data.date), 'MMMM d, yyyy')}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Time</p>
                        <p className="font-bold">{format(new Date(detailModalData.data.date), 'h:mm a')}</p>
                      </div>
                    </div>
                    {detailModalData.data.deletedAt && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-danger/5 rounded-2xl border border-danger/10">
                          <p className="text-[10px] font-bold text-danger uppercase tracking-widest mb-1">Deleted Date</p>
                          <p className="font-bold">{format(new Date(detailModalData.data.deletedAt), 'MMMM d, yyyy')}</p>
                        </div>
                        <div className="p-4 bg-danger/5 rounded-2xl border border-danger/10">
                          <p className="text-[10px] font-bold text-danger uppercase tracking-widest mb-1">Deleted Time</p>
                          <p className="font-bold">{format(new Date(detailModalData.data.deletedAt), 'h:mm a')}</p>
                        </div>
                      </div>
                    )}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subject & Chapter</p>
                      <p className="font-bold text-lg">{detailModalData.data.subject}</p>
                      <p className="text-gray-400">{detailModalData.data.chapter}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Topics Covered</p>
                      <p className="text-gray-300 leading-relaxed mt-2">{detailModalData.data.topics || 'No specific topics recorded.'}</p>
                    </div>
                    <div className="flex items-center gap-2 px-2">
                      <div className={cn("w-3 h-3 rounded-full", detailModalData.data.completed ? "bg-emerald-500" : "bg-orange-500")} />
                      <span className="text-sm font-bold uppercase tracking-widest text-gray-400">
                        {detailModalData.data.completed ? 'Completed Session' : 'Pending Session'}
                      </span>
                    </div>
                  </div>
                )}

                {detailModalData.type === 'subject' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Sessions</p>
                        <p className="text-2xl font-bold">{detailModalData.data.count}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Completed</p>
                        <p className="text-2xl font-bold text-emerald-400">{detailModalData.data.completedCount}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Efficiency</p>
                        <p className="text-2xl font-bold text-primary">{Math.round((detailModalData.data.completedCount / detailModalData.data.count) * 100)}%</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Recent Chapters</p>
                      <div className="space-y-2">
                        {sessions.filter(s => s.subject === detailModalData.data.title).slice(-3).reverse().map((s, index) => (
                          <div key={s.id + '-' + index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-sm font-medium">{s.chapter}</span>
                            <span className="text-[10px] text-gray-500">{format(new Date(s.date), 'MMM d')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {detailModalData.type === 'stat' && (
                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
                      <p className="text-5xl font-bold mb-2">{detailModalData.data.value}</p>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{detailModalData.data.title}</p>
                    </div>
                    <p className="text-gray-400 text-center leading-relaxed">
                      {detailModalData.data.description || 'This metric tracks your overall performance and consistency in your study journey.'}
                    </p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setDetailModalData(null)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trash Modal */}
      <AnimatePresence>
        {isTrashOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTrashOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-white/10 rounded-[40px] p-8 md:p-10 space-y-8 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center text-danger">
                    <Trash2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Recycle Bin</h2>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Restore or delete permanently</p>
                  </div>
                </div>
                <button onClick={() => setIsTrashOpen(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pr-1 scroll-smooth overscroll-contain">
                {trash.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <Trash2 size={48} className="opacity-20" />
                    <p className="italic font-medium">Your recycle bin is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trash.map((item, index) => (
                      <motion.div 
                        key={item.id + '-' + index} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setDetailModalData({ type: 'activity', data: item })}
                        className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                          <IconRenderer name={item.icon} size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{item.subject}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.chapter}</p>
                          {item.deletedAt && (
                            <p className="text-[9px] text-danger font-bold mt-1 uppercase tracking-tighter">
                              Deleted {format(new Date(item.deletedAt), 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRestoreSession(item.id); }}
                            className="p-2.5 text-emerald-400 bg-emerald-400/5 hover:bg-emerald-400/10 rounded-xl transition-all active:scale-90"
                            title="Restore"
                          >
                            <Undo2 size={20} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handlePermanentDelete(item.id); }}
                            className="p-2.5 text-danger bg-danger/5 hover:bg-danger/10 rounded-xl transition-all active:scale-90"
                            title="Delete Permanently"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsTrashOpen(false)}
                className="w-full py-4 bg-white/5 text-white rounded-2xl font-bold text-sm hover:bg-white/10 transition-all shrink-0"
              >
                Close Bin
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-around items-center z-[100] transform-gpu translate-z-0 pointer-events-auto transition-colors duration-300",
        settings.dark_mode 
          ? "bg-[#0A0E14]/95 border-t border-white/5" 
          : "bg-white/95 border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]"
      )}>
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon />} label="HOME" darkMode={settings.dark_mode} />
        <NavButton active={activeTab === 'routine'} onClick={() => setActiveTab('routine')} icon={<Calendar />} label="ROUTINE" darkMode={settings.dark_mode} />
        <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart2 />} label="OVERVIEW" darkMode={settings.dark_mode} />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon />} label="SETTINGS" darkMode={settings.dark_mode} />
      </nav>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTaskToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xs bg-card border border-white/10 rounded-[28px] p-6 space-y-6 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Move to Recycle Bin?</h3>
                <p className="text-gray-500 text-sm">You can restore it later from settings.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleDeleteSession(taskToDelete);
                    setTaskToDelete(null);
                  }}
                  className="flex-1 py-3 bg-danger text-white rounded-xl font-bold text-sm shadow-lg shadow-danger/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Calendar Modal */}
      <FullCalendarModal 
        isOpen={isFullCalendarOpen}
        onClose={() => setIsFullCalendarOpen(false)}
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        setViewDate={setViewDate}
        calendarDays={calendarDays}
        sessionsForDate={sessionsForDate}
        daysWithSessions={daysWithSessions}
        setDetailModalData={setDetailModalData}
      />

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card rounded-[32px] p-6 md:p-8 space-y-6 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <div className="flex justify-end items-center">
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <SessionForm onSubmit={handleAddSession} darkMode={settings.dark_mode} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

// --- Sub-components ---

interface FullCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarMonth: Date;
  setCalendarMonth: React.Dispatch<React.SetStateAction<Date>>;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  setViewDate: (date: Date) => void;
  calendarDays: Date[];
  sessionsForDate: (date: Date) => StudySession[];
  daysWithSessions: Set<string>;
  setDetailModalData: (data: { type: 'stat' | 'subject' | 'activity' | 'trend'; data: any } | null) => void;
}

function FullCalendarModal({ 
  isOpen, 
  onClose, 
  ...props
}: FullCalendarModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm touch-none"
          />
          <FullCalendarContent onClose={onClose} {...props} />
        </div>
      )}
    </AnimatePresence>
  );
}

function FullCalendarContent({ 
  onClose, 
  calendarMonth, 
  setCalendarMonth, 
  selectedDate, 
  setSelectedDate, 
  setViewDate, 
  calendarDays, 
  sessionsForDate,
  daysWithSessions,
  setDetailModalData
}: Omit<FullCalendarModalProps, 'isOpen'>) {
  const previewListRef = useRef<HTMLDivElement>(null);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  
  const dailySessions = useMemo(() => sessionsForDate(selectedDate), [selectedDate, sessionsForDate]);

  useEffect(() => {
    if (previewListRef.current) {
      previewListRef.current.scrollTop = 0;
    }
  }, [selectedDate]);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="relative w-full max-w-lg bg-card border border-white/10 rounded-t-[40px] md:rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] md:max-h-[85vh] overscroll-none"
    >
      <div className="p-6 md:p-8 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{format(calendarMonth, 'MMMM yyyy')}</h2>
          <div className="flex gap-2 md:gap-3">
            <button 
              onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400"
            >
              <ChevronRight size={24} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 ml-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <motion.div 
          initial={false}
          animate={{ 
            height: isCalendarCollapsed ? 0 : 'auto',
            opacity: isCalendarCollapsed ? 0 : 1,
            marginBottom: isCalendarCollapsed ? 0 : 32,
            scale: isCalendarCollapsed ? 0.95 : 1,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ 
            transformOrigin: 'top center',
            overflow: 'hidden'
          }}
          className="shrink-0"
        >
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={`day-header-${i}`} className="text-center text-[10px] md:text-xs font-bold text-gray-500 py-1 md:py-2">
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, calendarMonth);
              const isSel = isSameDay(day, selectedDate);
              const isTod = isToday(day);
              const hasSess = daysWithSessions.has(format(day, 'yyyy-MM-dd'));

              return (
                <button
                  key={`calendar-day-${i}-${day.toString()}`}
                  onClick={() => {
                    setSelectedDate(day);
                    setViewDate(day);
                  }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center transition-all",
                    !isCurrentMonth && "opacity-20",
                    isSel 
                      ? "bg-danger text-white rounded-full shadow-lg shadow-danger/20 scale-105" 
                      : hasSess 
                        ? "bg-danger/15 text-danger rounded-full" 
                        : "rounded-xl md:rounded-2xl hover:bg-white/5 text-gray-300",
                    isTod && !isSel && "border border-primary/50",
                    isTod && !isSel && !hasSess && "text-primary rounded-xl md:rounded-2xl"
                  )}
                >
                  <span className="text-base md:text-lg font-bold">{format(day, 'd')}</span>
                  {/* Checkmark removed as per user request to replace with red circle for selection */}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Shortcut Preview */}
        <div className="flex-1 flex flex-col min-h-0 pt-2 border-t border-white/10 overflow-hidden relative">
          {/* Pull-up Arrow Handle */}
          <motion.div 
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y < -15) setIsCalendarCollapsed(true);
              if (info.offset.y > 15) setIsCalendarCollapsed(false);
            }}
            className="absolute top-0 left-0 right-0 h-12 flex items-center justify-center -translate-y-1/2 z-20 cursor-ns-resize"
            onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
          >
            <div className="w-20 h-1.5 bg-white/10 rounded-full relative overflow-visible">
              <motion.div
                animate={{ 
                  rotate: isCalendarCollapsed ? 180 : 0,
                  y: isCalendarCollapsed ? 2 : -2
                }}
                transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-primary bg-card rounded-full p-1.5 border border-white/10 shadow-2xl flex items-center justify-center"
              >
                <ChevronDown size={18} strokeWidth={3} />
              </motion.div>
            </div>
          </motion.div>

          <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-4 shrink-0 px-1">
            {format(selectedDate, 'MMMM d')} Activities
          </p>
          <div 
            ref={previewListRef}
            className="flex-1 space-y-3 overflow-y-auto scrollbar-hide pr-1 pb-4 scroll-smooth overscroll-contain"
          >
            {dailySessions.length > 0 ? (
              dailySessions.map((s, index) => (
                <div 
                  key={s.id + '-' + index} 
                  onClick={() => setDetailModalData({ type: 'activity', data: s })}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer hover:bg-white/10",
                    s.completed ? "bg-red-500/5 border border-red-500/20" : "bg-white/5"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.completed ? 'rgba(239, 68, 68, 0.1)' : `${s.color}20`, color: s.completed ? '#EF4444' : s.color }}>
                    <IconRenderer name={s.icon} size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn(
                        "text-xs font-bold truncate",
                        s.completed && "line-through text-red-500 decoration-red-500 decoration-2"
                      )}>{s.subject}</p>
                    </div>
                    <p className={cn(
                      "text-[10px] truncate",
                      s.completed ? "text-red-400/60" : "text-gray-500"
                    )}>{s.chapter}</p>
                  </div>
                  {s.completed && <Zap size={12} className="ml-auto text-red-500 fill-red-500" />}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <Calendar size={32} className="mb-2" />
                <p className="text-xs text-gray-500 italic text-center">No activities for this day</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button 
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 font-bold",
        active 
          ? "bg-primary text-white shadow-lg shadow-primary/20" 
          : "text-gray-400 hover:bg-white/5 hover:text-white light:hover:bg-gray-100 light:hover:text-gray-900"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { size: 22 })}
      <span>{label}</span>
      {active && <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-white light:bg-gray-900 rounded-full" />}
    </motion.button>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon, label, darkMode }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; darkMode: boolean }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 transition-all duration-300",
        active 
          ? "text-white" 
          : (darkMode ? "text-gray-500" : "text-gray-400")
      )}
    >
      <div className={cn(
        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300",
        active 
          ? "bg-primary shadow-lg shadow-primary/20" 
          : (darkMode ? "bg-transparent" : "bg-gray-100")
      )}>
        {React.cloneElement(icon as React.ReactElement, { size: 24, color: active ? 'white' : undefined })}
      </div>
      <span className="text-[9px] font-bold tracking-[0.1em]">{label}</span>
    </motion.button>
  );
}

function StatCard({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "p-4 flex flex-col items-start gap-3 transition-all cursor-pointer active:scale-95",
        "hover:bg-white/5 light:hover:bg-gray-50",
        onClick && "cursor-pointer"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center",
        "bg-white/5 light:bg-gray-100",
        color
      )}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </Card>
  );
}

const TaskItem = React.memo(({ session, onToggle, onDelete, onClick, isExpanded, dragControls }: { session: StudySession; onToggle: () => void; onDelete: () => void; onClick: () => void; isExpanded: boolean; dragControls: any }) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle left clicks or touches
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setIsHolding(true);
    
    // Start a 1-second timer
    timerRef.current = setTimeout(() => {
      // Start the drag
      dragControls.start(e);
      setIsHolding(false);
      // Optional: vibrate to signal drag started
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 1000);
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsHolding(false);
  };

  return (
    <motion.div 
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-4 p-4 rounded-2xl transition-all cursor-pointer select-none",
        "will-change-transform", // GPU acceleration hint
        session.completed ? "bg-white/5 opacity-60" : "bg-card shadow-sm",
      )}
      style={{ 
        transform: 'translateZ(0)' // Force GPU layer
      }}
    >
      <div className="flex items-center gap-4 w-full">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
            session.completed ? "bg-primary border-primary" : "border-white/20 hover:border-primary/50"
          )}
        >
          {session.completed && <Zap size={12} className="text-white fill-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("font-bold text-sm truncate", session.completed && "line-through text-gray-500")}>{session.subject}</p>
          </div>
          <p className="text-xs text-gray-500 truncate">{session.chapter}</p>
        </div>
        <div className="flex items-center shrink-0">
          <motion.div 
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            animate={{ 
              scale: isHolding ? 1.1 : 1,
              boxShadow: isHolding ? "0px 0px 25px rgba(0,0,0,0.3)" : "none"
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing touch-none relative" 
            style={{ backgroundColor: `${session.color}20`, color: session.color }}
          >
            <IconRenderer name={session.icon} size={20} />
            {isHolding && (
              <motion.div 
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
              />
            )}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-white/5 flex justify-between items-end gap-4">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Topics</p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {session.topics || 'No topics specified'}
                </p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors shrink-0"
                title="Delete Task"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const ReorderableTaskItem = ({ s, index, onToggle, onDelete, onClick, isExpanded }: any) => {
  const dragControls = useDragControls();
  return (
    <Reorder.Item 
      key={s.id + '-' + index} 
      value={s}
      dragControls={dragControls}
      dragListener={false}
      dragDirection="y"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0 }}
      whileDrag={{ 
        scale: 1.05, 
        boxShadow: "0px 15px 40px rgba(0,0,0,0.4)",
        zIndex: 50
      }}
      className="relative z-0"
    >
      <TaskItem 
        session={s} 
        onToggle={onToggle} 
        onDelete={onDelete} 
        onClick={onClick}
        isExpanded={isExpanded}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
};

function SessionForm({ onSubmit, darkMode }: { onSubmit: (data: any) => void; darkMode: boolean }) {
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [topics, setTopics] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [selectedColor, setSelectedColor] = useState('#5856D6');
  const [selectedIcon, setSelectedIcon] = useState('Book');

  const colors = ['#5856D6', '#FF2D55', '#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF3B30'];
  const icons = ['Book', 'Music', 'Heart', 'Brain', 'Zap', 'Atom', 'Calculator', 'Activity'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 justify-center">
        {colors.map(c => (
          <button 
            key={c}
            onClick={() => setSelectedColor(c)}
            className={cn(
              "w-7 h-7 rounded-full transition-all duration-300",
              selectedColor === c ? "scale-125 ring-2 ring-white ring-offset-4 ring-offset-card" : "opacity-40 hover:opacity-100"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Subject</label>
          <div className="relative">
            <input 
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-input p-4 pr-4 rounded-input outline-none border border-white/5 focus:border-primary/50 transition-colors"
              placeholder=""
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Chapter / Unit</label>
          <div className="relative">
            <input 
              value={chapter}
              onChange={e => setChapter(e.target.value)}
              className="w-full bg-input p-4 pr-4 rounded-input outline-none border border-white/5 focus:border-primary/50 transition-colors"
              placeholder=""
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className={cn(
            "text-[10px] font-bold uppercase tracking-widest ml-1",
            darkMode ? "text-gray-500" : "text-gray-400"
          )}>Specific Topics</label>
          <div className="relative">
            <textarea 
              value={topics}
              onChange={e => setTopics(e.target.value)}
              className={cn(
                "w-full p-4 pr-4 rounded-input outline-none border transition-colors min-h-[100px] resize-none",
                darkMode ? "bg-input border-white/5 focus:border-primary/50 text-white" : "bg-gray-50 border-gray-200 focus:border-primary/50 text-gray-900"
              )}
              placeholder=""
            />
          </div>
        </div>

        <div className="flex gap-3 items-center mt-2">
          <div className="relative flex-shrink-0 w-32">
            <input 
              type="time"
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              placeholder="set a time"
              className={cn(
                "w-full p-4 rounded-input outline-none border transition-colors text-center",
                darkMode ? "bg-input border-white/5 focus:border-primary/50 text-white" : "bg-gray-50 border-gray-200 focus:border-primary/50 text-gray-900"
              )}
            />
          </div>

          <button 
            onClick={() => {
              if (!subject || !chapter) return;
              
              onSubmit({ 
                subject, 
                chapter, 
                topics, 
                color: selectedColor, 
                icon: selectedIcon,
                reminder_time: reminderTime || undefined
              });
              setSubject('');
              setChapter('');
              setTopics('');
              setReminderTime('');
            }}
            className="flex-1 py-4 bg-primary rounded-2xl font-bold text-sm tracking-widest hover:opacity-90 transition-opacity text-white"
          >
            Add to Study Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function IconRenderer({ name, size }: { name: string; size: number }) {
  const icons: Record<string, any> = { Book, Music, Heart, Brain, Zap, Atom, Calculator, Activity };
  const Icon = icons[name] || Book;
  return <Icon size={size} />;
}

// --- Helpers ---

function generateChartData(sessions: StudySession[]) {
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  return last7Days.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const count = sessions.filter(s => {
      // Use string comparison for yyyy-MM-dd dates to avoid timezone issues
      const sessionDateStr = s.date.includes('T') ? format(new Date(s.date), 'yyyy-MM-dd') : s.date;
      return sessionDateStr === dateStr;
    }).length;
    return {
      name: format(date, 'eee'),
      count: count
    };
  });
}

function generatePieData(sessions: StudySession[]) {
  const subjects = Array.from(new Set(sessions.map(s => s.subject)));
  return subjects.map(sub => {
    const subjectSessions = sessions.filter(s => s.subject === sub);
    return {
      name: sub,
      value: subjectSessions.length,
      completedCount: subjectSessions.filter(s => s.completed).length,
      color: sessions.find(s => s.subject === sub)?.color || '#5856D6'
    };
  });
}

function calculateStreak(sessions: StudySession[]) {
  if (sessions.length === 0) return 0;
  
  const completedDates = Array.from(new Set(
    sessions
      .filter(s => s.completed)
      .map(s => s.date.includes('T') ? format(new Date(s.date), 'yyyy-MM-dd') : s.date)
  )).sort((a, b) => b.localeCompare(a));

  if (completedDates.length === 0) return 0;

  let streak = 0;
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(addDays(now, -1), 'yyyy-MM-dd');
  
  // If the most recent completion is not today or yesterday, the streak is broken
  if (completedDates[0] !== todayStr && completedDates[0] !== yesterdayStr) {
    return 0;
  }

  // Start checking from the most recent completed date
  let checkDate = new Date(completedDates[0] + 'T00:00:00');
  for (let i = 0; i < completedDates.length; i++) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    if (completedDates[i] === dateStr) {
      streak++;
      checkDate = addDays(checkDate, -1);
    } else {
      // If there's a gap in the sequence, the streak ends
      break;
    }
  }
  
  return streak;
}

