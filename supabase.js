import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm";

const SUPABASE_URL = "https://csyglkpwckewxwvqzjon.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dx6iMjc76WOw2YRXVE3GgQ_6kV9JAvz";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Add request
export async function addRequest(data) {
  const { data: result, error } = await supabase
    .from("requests")
    .insert([{
      name: data.name || "Anonymous",
      location: data.location || "Unknown",
      need: data.need || "General",
      urgency: data.urgency || "low"
    }]);
  
  if (error) throw error;
  return result;
}

// Get all requests
export async function getRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data;
}

// Subscribe to real-time updates
export function subscribeToRequests(callback) {
  return supabase
    .from("requests")
    .on("*", (payload) => callback(payload.new))
    .subscribe();
}

// Register/Save user
export async function registerUser(userData) {
  const { data: result, error } = await supabase
    .from("users")
    .insert([{
      name: userData.name,
      phone: userData.phone,
      email: userData.email,
      role: userData.role,
      area: userData.area,
      skills: userData.skills || [],
      password: userData.password
    }]);
  
  if (error) throw error;
  return result;
}

// Get user by phone
export async function getUserByPhone(phone) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone", phone)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Get user by email
export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}