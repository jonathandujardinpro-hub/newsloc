import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ffxpposishqquxshfnxj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmeHBwb3Npc2hxcXV4c2hmbnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMDQ5NjEsImV4cCI6MjEwMjc4MDk2MX0.Z-yti3sWGWlFikgBDRY-GLCAj2_X7ImHDeyiYbsr70A";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
