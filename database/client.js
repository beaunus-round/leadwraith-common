const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabase;

function getSupabaseClient() {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: { persistSession: false }
      }
    );
  }
  return supabase;
}

module.exports = { getSupabaseClient };