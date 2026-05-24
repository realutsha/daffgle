const https = require('https');

const supabaseUrl = 'bqxtknjkibjlxwnsaxcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHRrbmpraWJqbHh3bnNheGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTQ3MTYsImV4cCI6MjA5NDg3MDcxNn0.6YR3avZ2XHmCYvGzYR2lpYvLJg_Q_g53JoJ6m2Y0ato';

const options = {
  hostname: supabaseUrl,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
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
      console.log('--- PostgREST OpenAPI Schema Loaded with Auth ---');
      if (schema.definitions) {
        console.log('Available definitions:', Object.keys(schema.definitions));
        if (schema.definitions.messages) {
          console.log('\nColumns of "messages":', Object.keys(schema.definitions.messages.properties));
          console.log('\nDetails of "messages":', schema.definitions.messages.properties);
        } else {
          console.log('"messages" definitions not found. Checking if there is a similar table.');
        }
      } else {
        console.log('No definitions in response. Keys:', Object.keys(schema));
        console.log('Response body preview:', data.substring(0, 500));
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
