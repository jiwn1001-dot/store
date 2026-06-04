import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ocgxvqwxwzrsvozchxdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ3h2cXd4d3pyc3ZvemNoeGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTQ3NDAsImV4cCI6MjA5NDI3MDc0MH0.Q9Gdf9EjUU41XqxSMUiTHJMWtijwjtHz5C0YJ3bZXx0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
