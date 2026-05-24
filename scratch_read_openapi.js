const https = require('https');

const supabaseUrl = 'https://bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const options = {
  hostname: 'bqxtknjkibjlxwnsaxcl.supabase.co',
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Accept': 'application/openapi+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const schema = JSON.parse(data);
      console.log('--- PostgREST OpenAPI Schema Loaded ---');
      if (schema.definitions && schema.definitions.messages) {
        console.log('Columns of "messages":', Object.keys(schema.definitions.messages.properties));
        console.log('Full details:', schema.definitions.messages.properties);
      } else {
        console.log('Messages table not found in definitions! Available tables:', Object.keys(schema.definitions || {}));
      }
    } catch (err) {
      console.error('Parsing failed:', err);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e);
});

req.end();
