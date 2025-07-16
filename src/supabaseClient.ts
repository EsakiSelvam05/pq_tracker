import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pvnbkejjhrwilehsvvkr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bmJrZWpqaHJ3aWxlaHN2dmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMTE1OTMsImV4cCI6MjA2NDU4NzU5M30.P_mz5TBcZtfnQ6AMeGGT-pBs3l-DSOOc20-pzbpUpY4
";

export const supabase = createClient(supabaseUrl, supabaseKey);
