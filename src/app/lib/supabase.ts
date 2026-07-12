import { createClient } from '@supabase/supabase-js';

// Hardcoding the variables directly to bypass the 'process' error
const supabaseUrl = "https://miqyijdbfwsdxwpdizcc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzcyNzgsImV4cCI6MjA5ODkxMzI3OH0.n2uExa8DtZbBthwxd8cDtlLIEZISWetYlnqhZ71uOTE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);