const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

const candidateTables = [
  'participants',
  'members',
  'conversation_participants',
  'conversation_members',
  'chat_members',
  'chat_participants',
  'messages'
];

async function main() {
  console.log('Checking candidate connection tables...');
  
  for (const t of candidateTables) {
    const { error } = await supabase
      .from(t)
      .select('*')
      .limit(1);
      
    if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log(`- ${t}: DOES NOT exist`);
    } else {
      console.log(`- ${t}: EXISTS (Result: ${error ? error.message : 'SUCCESS'})`);
    }
  }
}

main().catch(console.error);
