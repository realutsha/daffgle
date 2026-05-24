const fs = require('fs');
const path = require('path');

function findInFiles(dir, terms) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        findInFiles(filePath, terms);
      }
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        terms.forEach(term => {
          if (content.includes(term)) {
            console.log(`\nFound term "${term}" in ${filePath}:`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.includes(term)) {
                console.log(`  ${idx + 1}: ${line.trim()}`);
              }
            });
          }
        });
      }
    }
  });
}

findInFiles('c:\\DaffgleProject\\daffgle\\src', ['chat_id', 'request_id', 'helper_id', 'requester_id']);
