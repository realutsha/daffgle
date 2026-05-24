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
      ...columns
    });
  return error ? error.message : 'SUCCESS!';
}

async function main() {
  console.log('Testing columns on messages...');
  
  console.log('Test with request_id:', await test({ request_id: '00000000-0000-0000-0000-000000000000' }));
  console.log('Test with text:', await test({ text: 'hello' }));
  console.log('Test with message:', await test({ message: 'hello' }));
  console.log('Test with body:', await test({ body: 'hello' }));
}

main().catch(console.error);
