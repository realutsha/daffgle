const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

const candidates = [
  'user_id',
  'profile_id',
  'creator_id',
  'user1',
  'user2',
  'profile1',
  'profile2',
  'member1_id',
  'member2_id',
  'member1',
  'member2',
  'user_1',
  'user_2',
  'sender',
  'receiver',
  'room_id',
  'help_request_id'
];

async function main() {
  console.log('Testing each candidate column on conversations...');
  
  for (const col of candidates) {
    const payload = {
      id: '00000000-0000-0000-0000-000000000000',
    };
    payload[col] = '00000000-0000-0000-0000-000000000000';
    
    const { error } = await supabase
      .from('conversations')
      .insert(payload);
      
    if (error && error.message.includes(`'${col}' column`)) {
      console.log(`- ${col}: DOES NOT exist`);
    } else {
      console.log(`- ${col}: EXISTS! (Result: ${error ? error.message : 'SUCCESS'})`);
    }
  }
}

main().catch(console.error);
