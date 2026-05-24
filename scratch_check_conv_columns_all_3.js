const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

const candidates = [
  'user_id1',
  'user_id2',
  'user_a_id',
  'user_b_id',
  'profile_a_id',
  'profile_b_id',
  'member_id_1',
  'member_id_2',
  'user_a',
  'user_b',
  'profile_a',
  'profile_b',
  'requester',
  'helper',
  'creator',
  'recipient',
  'partner_id'
];

async function main() {
  console.log('Testing more candidate columns on conversations...');
  
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
