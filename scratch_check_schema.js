const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function main() {
  console.log('Fetching columns from messages table...');
  // We fetch a single message from messages table
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching messages schema:', error);
  } else {
    console.log('Actual messages columns:', messages.length > 0 ? Object.keys(messages[0]) : 'No records returned. Let\'s fetch from pg_catalog or check other fields.');
    console.log('Sample message:', messages[0]);
  }
}

main().catch(console.error);
