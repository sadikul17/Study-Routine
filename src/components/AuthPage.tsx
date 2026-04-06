import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  ArrowRight, 
  User as UserIcon,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Smartphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuthPageProps {
  onGuestAccess: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  isRecovering?: boolean;
  onResetComplete?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ 
  onGuestAccess, 
  darkMode, 
  onToggleTheme,
  isRecovering = false,
  onResetComplete
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'otp'>('email');
  const [isResetting, setIsResetting] = useState(false);

  const handleForgotPassword = async () => {
    if (!supabase.auth) {
      setError("Supabase is not correctly configured. Please check your environment variables.");
      return;
    }
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw error;
      setSuccess('A 6-digit OTP has been sent to your email.');
      setResetStep('otp');
      setIsResetting(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Verify the OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'recovery'
      });
      if (verifyError) throw verifyError;

      // Step 2: Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;

      setSuccess('Password changed successfully! You can now login.');
      setTimeout(() => {
        setIsResetting(false);
        setResetStep('email');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase.auth) {
      setError("Supabase is not correctly configured. Please check your environment variables.");
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vehufqgxkdvvobvzcvpa.supabase.co';
      if (Capacitor.isNativePlatform() && supabaseUrl.includes('localhost')) {
        setError("Supabase URL is set to 'localhost'. On a real Android device, this will fail. Please use your machine's local IP address or a public Supabase URL.");
        setIsLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: email.trim().toLowerCase(), 
          password 
        });
        if (error) throw error;
      } else {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }
        // For Android/iOS apps, we need to ensure the redirect URL is correct
        // Capacitor apps on Android usually use http://localhost
        const redirectTo = Capacitor.isNativePlatform() ? 'http://localhost' : window.location.origin;
        const { error } = await supabase.auth.signUp({ 
          email: email.trim().toLowerCase(), 
          password,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        if (error) throw error;
        setSuccess('Account created! Please check your email for verification.');
      }
    } catch (err: any) {
      console.error('Auth error details:', err);
      let message = err.message;
      if (message === 'Failed to fetch') {
        message = 'Network error. Please check your internet connection and ensure Supabase URL is reachable from your mobile device.';
      } else if (message === 'Invalid login credentials') {
        message = 'Invalid email or password. Please check your credentials. If you haven\'t created an account yet, click the "Sign Up" button below.';
      } else if (message === 'Email not confirmed') {
        message = 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.';
      }
      setError(message || 'An unexpected error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setSuccess('Password updated successfully! Redirecting...');
      
      // Wait a moment for the user to see the success message
      setTimeout(() => {
        if (onResetComplete) onResetComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-[100dvh] flex items-center justify-center p-4 overflow-y-auto relative transition-colors duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      darkMode ? "bg-[#0A0E14] text-white" : "bg-gray-50 text-gray-900"
    )}>
      {/* Background Glows */}
      <div className={cn(
        "absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse",
        darkMode ? "bg-primary/20" : "bg-primary/10"
      )} />
      <div className={cn(
        "absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse",
        darkMode ? "bg-blue-500/10" : "bg-blue-500/5"
      )} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={cn(
              "inline-flex items-center justify-center w-16 h-16 rounded-2xl border mb-4",
              darkMode ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10"
            )}
          >
            <ShieldCheck className="text-primary" size={32} />
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Study Routine</h1>
          <p className={darkMode ? "text-gray-400" : "text-gray-500"}>Your minimalist study companion</p>
        </div>

        <div className={cn(
          "border rounded-[32px] p-6 md:p-8 shadow-2xl backdrop-blur-xl transition-all duration-300",
          darkMode ? "bg-[#141414] border-white/5" : "bg-white border-gray-100"
        )}>
          {isRecovering ? (
            <form onSubmit={handleResetPassword} className="space-y-3 md:space-y-4">
              <div className="space-y-1.5 md:space-y-2">
                <label className={cn(
                  "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className={cn(
                      "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-all",
                      darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                      darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className={cn(
                  "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className={cn(
                      "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-all",
                      darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                    required
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                      darkMode 
                        ? "text-red-400 bg-red-400/10 border-red-400/20" 
                        : "text-red-600 bg-red-50 border-red-100"
                    )}
                  >
                    <AlertCircle size={12} />
                    {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                      darkMode 
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
                        : "text-emerald-600 bg-emerald-50 border-emerald-100"
                    )}
                  >
                    <KeyRound size={12} />
                    {success}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-3.5 md:py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Update Password
                    <ShieldCheck size={18} />
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  if (onResetComplete) onResetComplete();
                  setIsLogin(true);
                }}
                className={cn(
                  "w-full py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                  darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                )}
              >
                Back to Login
              </button>
            </form>
          ) : isResetting ? (
            <form onSubmit={handleVerifyOtpAndReset} className="space-y-3 md:space-y-4">
              <div className="space-y-1.5 md:space-y-2">
                <label className={cn(
                  "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>Enter 6-Digit OTP</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={cn(
                      "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-4 text-sm tracking-[0.5em] font-mono focus:outline-none focus:border-primary/50 transition-all",
                      darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className={cn(
                  "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className={cn(
                      "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-all",
                      darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className={cn(
                  "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={cn(
                      "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-all",
                      darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                    required
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                      darkMode 
                        ? "text-red-400 bg-red-400/10 border-red-400/20" 
                        : "text-red-600 bg-red-50 border-red-100"
                    )}
                  >
                    <AlertCircle size={12} />
                    {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                      darkMode 
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
                        : "text-emerald-600 bg-emerald-50 border-emerald-100"
                    )}
                  >
                    <KeyRound size={12} />
                    {success}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-3.5 md:py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify & Reset
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => setIsResetting(false)}
                className={cn(
                  "w-full py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                  darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                )}
              >
                Back to Login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-3 md:space-y-4">
            <div className="space-y-1.5 md:space-y-2">
              <label className={cn(
                "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                darkMode ? "text-gray-500" : "text-gray-400"
              )}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all",
                    darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                  )}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <label className={cn(
                "text-[10px] md:text-xs font-bold uppercase tracking-widest ml-1",
                darkMode ? "text-gray-500" : "text-gray-400"
              )}>Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full border rounded-2xl py-3 md:py-4 pl-11 md:pl-12 pr-12 text-sm focus:outline-none focus:border-primary/50 transition-all",
                    darkMode ? "bg-black/40 border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                    darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                    darkMode 
                      ? "text-red-400 bg-red-400/10 border-red-400/20" 
                      : "text-red-600 bg-red-50 border-red-100"
                  )}
                >
                  <AlertCircle size={12} />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "flex items-center gap-2 text-[10px] md:text-xs p-2.5 md:p-3 rounded-xl border",
                    darkMode 
                      ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
                      : "text-emerald-600 bg-emerald-50 border-emerald-100"
                  )}
                >
                  <KeyRound size={12} />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-2">
              {isLogin && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 py-3.5 md:py-4 rounded-2xl font-bold text-[11px] md:text-sm transition-all border flex items-center justify-center gap-2 disabled:opacity-50",
                    darkMode 
                      ? "bg-white/5 text-gray-400 hover:bg-white/10 border-white/5" 
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
                  )}
                >
                  <KeyRound size={16} />
                  Forgot?
                </button>
              )}
              <button 
                type="submit"
                disabled={isLoading}
                className={cn(
                  "bg-primary text-white py-3.5 md:py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20",
                  isLogin ? "flex-[2]" : "w-full"
                )}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="relative my-6 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className={cn(
                "w-full border-t",
                darkMode ? "border-white/5" : "border-gray-100"
              )}></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className={cn(
                "px-4 font-bold tracking-widest transition-colors",
                darkMode ? "bg-[#141414] text-gray-500" : "bg-white text-gray-400"
              )}>Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className={cn(
                "flex items-center justify-center gap-2 py-3.5 md:py-4 rounded-2xl font-bold text-[11px] md:text-sm transition-all border",
                darkMode 
                  ? "bg-[#1C1C1C] text-white hover:bg-[#252525] border-white/5" 
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
              )}
            >
              {isLogin ? <UserPlus size={16} /> : <LogIn size={16} />}
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
            <button 
              onClick={onGuestAccess}
              className={cn(
                "flex items-center justify-center gap-2 py-3.5 md:py-4 rounded-2xl font-bold text-[11px] md:text-sm transition-all border",
                darkMode 
                  ? "bg-[#1C1C1C] text-white hover:bg-[#252525] border-white/5" 
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
              )}
            >
              <UserIcon size={16} />
              Guest
            </button>
          </div>
          </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
