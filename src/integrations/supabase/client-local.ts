// Cliente Supabase para desenvolvimento local
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// URLs do Supabase local (padrão do CLI)
const SUPABASE_URL = "http://localhost:54321";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ1NzY5MjAwLCJleHAiOjE5NjExMjkyMDB9.RZhQX0t86GfHvEy0JYWLyOkHdIbdF_vhJ9Rc7GmCIc4";

console.log('🏠 Usando Supabase LOCAL:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});