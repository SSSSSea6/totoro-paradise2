// 生成 20,000 个 3.2 公里的兑换码，输出 CSV（可直接导入 Supabase）和纯文本列表
// 运行：node scripts/generate_free_run_codes_3_2km.js

import fs from 'fs';
import crypto from 'crypto';

const COUNT = 20000;
const AMOUNT = 3.2;

const csvLines = ['code,amount,is_used,used_by,used_at'];
const txtLines = [];

for (let i = 0; i < COUNT; i++) {
  const code = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 字符
  csvLines.push(`${code},${AMOUNT},false,,`);
  txtLines.push(code);
}

fs.writeFileSync('free_run_codes_3_2km.csv', `${csvLines.join('\n')}\n`, 'utf-8');
fs.writeFileSync('free_run_codes_3_2km.txt', `${txtLines.join('\n')}\n`, 'utf-8');

console.log(`生成完毕：${COUNT} 条，单价 ${AMOUNT} km`);
