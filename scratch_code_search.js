const fs = require('fs');
const path = require('path');

function findInFiles(dir, regex) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        findInFiles(filePath, regex);
      }
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (regex.test(content)) {
          console.log(`\n--- Match in ${filePath} ---`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              console.log(`${idx + 1}: ${line.trim()}`);
              // Print surrounding lines
              for (let i = Math.max(0, idx - 4); i < Math.min(lines.length, idx + 8); i++) {
                console.log(`   [${i + 1}] ${lines[i]}`);
              }
            }
          });
        }
      }
    }
  });
}

console.log('Searching for "messages" queries in codebase...');
findInFiles('c:\\DaffgleProject\\daffgle\\src', /from\(\s*['"]messages['"]\s*\)/i);
