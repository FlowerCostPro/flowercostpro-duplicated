import { supabase } from './lib/supabase.js';

// Test Supabase connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase connection error:', error);
    } else {
      console.log('Supabase connection successful');
      console.log('Current session:', data.session ? 'Logged in' : 'Not logged in');
    }
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testConnection();