const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

const candidates = [
  'id',
  'created_at',
  'participant1_id',
  'participant2_id',
  'user_1_id',
  'user_2_id',
  'user1_id',
  'user2_id',
  'requester_id',
  'helper_id',
  'request_id',
  'help_request_id',
  'status',
  'profile_1_id',
  'profile_2_id',
  'user_ids',
  'users',
  'name',
  'title',
  'type'
];

async function main() {
  console.log('Testing each candidate column on conversations...');
  
  for (const col of candidates) {
    const payload = {
      id: '00000000-0000-0000-0000-000000000000',
    };
    if (col !== 'id') {
      payload[col] = (col === 'user_ids' || col === 'users') ? ['00000000-0000-0000-0000-000000000000'] : '00000000-0000-0000-0000-000000000000';
    }
    
    const { error } = await supabase
      .from('conversations')
      .insert(payload);
      
    if (error && error.message.includes(`'${col}' column`)) {
      // Column doesn't exist
      console.log(`- ${col}: DOES NOT exist`);
    } else {
      // Column exists!
      console.log(`- ${col}: EXISTS! (Result: ${error ? error.message : 'SUCCESS'})`);
    }
  }
}

main().catch(console.error);
