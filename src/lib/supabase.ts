import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fksookblinnojgjhocrt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_N6ZOyc3DDZVCwh3mfJdvrw_vq2TDGw0';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
