import React, { useState, useEffect, FormEvent, FC } from 'react';
import { Eye, EyeOff, LogIn, UserPlus, Loader2, Key } from 'lucide-react';
import { signIn, signUp, supabase } from '../lib/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
  isPasswordReset?: boolean;
  onBackToLanding?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, isPasswordReset = false, onBackToLanding }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Handle password reset mode
  useEffect(() => {
    if (isPasswordReset) {
      setMessage('Please enter your new password below.');
    }
  }, [isPasswordReset]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Trim whitespace from email to prevent issues
    const trimmedEmail = formData.email.trim().toLowerCase();

    try {
      if (isPasswordReset) {
        // Handle password update
        const { error } = await supabase.auth.updateUser({
          password: formData.password
        });
        if (error) throw error;
        
        alert('Password updated successfully! You are now signed in.');
        onAuthSuccess();
        return;
      }

      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (!formData.fullName.trim()) {
          throw new Error('Full name is required');
        }

        const { error } = await signUp(trimmedEmail, formData.password, formData.fullName);
        if (error) throw error;

        // Account created successfully - try to sign in immediately for development
        try {
          const { error: signInError } = await signIn(trimmedEmail, formData.password);
          if (signInError) {
            // If immediate sign-in fails, show message to check email
            alert('Account created! Please check your email for confirmation, then sign in.');
            setIsSignUp(false);
            resetForm();
          } else {
            // Successfully signed in immediately
            onAuthSuccess();
          }
        } catch (signInError) {
          alert('Account created! Please check your email for confirmation, then sign in.');
          setIsSignUp(false);
          resetForm();
        }
      } else {
        const { error } = await signIn(trimmedEmail, formData.password);
        if (error) {
          // Provide more helpful error messages
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email or password is incorrect. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            throw new Error('Please check your email and click the confirmation link before signing in.');
          } else {
            throw error;
          }
        }
        
        onAuthSuccess();
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      setError('Please enter your email address first');
      return;
    }

    setResetLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        formData.email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}?type=recovery&confirmed=true`
        }
      );
      
      if (error) throw error;
      
      setMessage('Password reset email sent! Check your inbox and follow the instructions.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      confirmPassword: ''
    });
    setError(null);
    setMessage(null);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="/image.png" 
            alt="FlowerCost Pro" 
            className="h-36 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isPasswordReset ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {isPasswordReset
              ? 'Enter your new password below'
              : isSignUp 
              ? 'Start managing your flower shop profits' 
              : 'Sign in to your FlowerCost Pro account'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isPasswordReset && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          {!isPasswordReset && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your email"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isPasswordReset ? 'New Password' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={isPasswordReset ? "Enter your new password" : "Enter your password"}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {(isSignUp || isPasswordReset) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                {isPasswordReset ? 'Update Password' : isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        {!isSignUp && !isPasswordReset && (
          <div className="mt-4 text-center">
            <button
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
            >
              {resetLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              Forgot your password?
            </button>
          </div>
        )}

        {!isPasswordReset && (
          <div className="mt-6 text-center">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="text-gray-600 hover:text-gray-700 font-medium mr-4"
              >
                ← Back to Home
              </button>
            )}
            <button
              onClick={toggleMode}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        )}

        {isSignUp && !isPasswordReset && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
              Your data is encrypted and secure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;