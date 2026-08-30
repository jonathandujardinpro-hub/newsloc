import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ffxpposishqquxshfnxj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmeHBwb3Npc2hxcXV4c2hmbnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk2MDAsImV4cCI6MjA2MDM4NTYwMH0.G_LSMqBQqjCgPR4RsBelDK-qdxOPOBmzeFBzA1NhVao";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
