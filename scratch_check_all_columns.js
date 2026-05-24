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
  'sender_id',
  'receiver_id',
  'recipient_id',
  'chat_id',
  'request_id',
  'help_request_id',
  'conversation_id',
  'room_id',
  'channel_id',
  'seen',
  'status',
  'created_at',
  'updated_at',
  'message',
  'content',
  'text',
  'body',
  'to_id',
  'from_id',
  'user_id'
];

async function main() {
  console.log('Testing each candidate column individually...');
  
  for (const col of candidates) {
    const payload = {
      sender_id: '00000000-0000-0000-0000-000000000000',
    };
    if (col !== 'sender_id') {
      payload[col] = (col === 'seen') ? false : (col === 'message' || col === 'content' || col === 'text' || col === 'body') ? 'test' : '00000000-0000-0000-0000-000000000000';
    }
    
    const { error } = await supabase
      .from('messages')
      .insert(payload);
      
    if (error && error.message.includes(`'${col}' column`)) {
      // Doesn't exist
      console.log(`- ${col}: DOES NOT exist`);
    } else {
      // Exists! (either success or RLS violation, but not missing column error!)
      console.log(`- ${col}: EXISTS! (Result: ${error ? error.message : 'SUCCESS'})`);
    }
  }
}

main().catch(console.error);
