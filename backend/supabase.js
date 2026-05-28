const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ FATAL: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset di environment variables!');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅ ada' : '❌ MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅ ada' : '❌ MISSING');
}

const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_KEY || 'placeholder-key'
);

module.exports = supabase;
