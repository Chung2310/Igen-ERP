import fs from 'fs';
import path from 'path';

const filePath = 'd:/Igen Tech/Igen-ERP/src/pages/ChatTab.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace showToast(something, "success") with toast.success(something)
// and so on
const pattern = /showToast\(([\s\S]+?),\s*['"](success|error|warning|info)['"]\)/g;

content = content.replace(pattern, (match, message, type) => {
  return `toast.${type}(${message.trim()})`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully refactored showToast calls in ChatTab.tsx!');
