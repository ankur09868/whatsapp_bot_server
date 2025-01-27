import fs from "fs"
const filePath = './nurenai-cef4f2574608.json';
const base64 = fs.readFileSync(filePath).toString('base64');

fs.writeFileSync('./service_account_base64.txt', base64);
console.log('Base64 encoding completed!');
