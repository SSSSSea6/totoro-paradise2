// Utility script to bulk-generate redemption codes for Supabase import.
// Run with `node generate_codes.js` and upload the generated CSV to the `redemption_codes` table.

const fs = require('fs');
const crypto = require('crypto');

const batches = [
  { count: 20000, amount: 1 },
  { count: 20000, amount: 2 },
  { count: 20000, amount: 5 },
  { count: 20000, amount: 10 },
  { count: 20000, amount: 30 },
];

let csvContent = 'code,amount,is_used\n';

batches.forEach((batch) => {
  for (let i = 0; i < batch.count; i++) {
    const code = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 chars
    csvContent += `${code},${batch.amount},false\n`;
  }
});

fs.writeFileSync('redemption_codes.csv', csvContent, { encoding: 'utf-8' });
console.log('Generated 100,000 codes to redemption_codes.csv');
