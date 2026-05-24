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
  'requester_id',
  'helper_id',
  'request_id',
  'help_request_id',
  'status',
  'chat_id',
  'user1_id',
  'user2_id',
  'sender_id',
  'receiver_id'
];

async function main() {
  console.log('Testing each candidate column on conversations...');
  
  for (const col of candidates) {
    const payload = {
      id: '00000000-0000-0000-0000-000000000000',
    };
    if (col !== 'id') {
      payload[col] = '00000000-0000-0000-0000-000000000000';
    }
    
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
