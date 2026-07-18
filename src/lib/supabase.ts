import { createClient } from '@supabase/supabase-js';

const supabaseUrl =  "https://gzuvwqosslryjcldzoyl.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dXZ3cW9zc2xyeWpjbGR6b3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTMwNjksImV4cCI6MjA5NzM2OTA2OX0.1g_8dY-QPXAODMEIMGZiO2ztYbKGBWlRJ7HZ8AKlpu8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
