const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function test(columns) {
  const { error } = await supabase
    .from('messages')
    .insert({
      sender_id: '00000000-0000-0000-0000-000000000000',
      message: 'test message',
      ...columns
    });
  return error ? error.message : 'SUCCESS!';
}

async function main() {
  console.log('Testing recipient columns with "message" bodies...');
  
  console.log('Test with receiver_id:', await test({ receiver_id: '00000000-0000-0000-0000-000000000000' }));
  console.log('Test with recipient_id:', await test({ recipient_id: '00000000-0000-0000-0000-000000000000' }));
  console.log('Test with help_request_id:', await test({ help_request_id: '00000000-0000-0000-0000-000000000000' }));
}

main().catch(console.error);
