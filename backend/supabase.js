const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

module.exports = supabase;
