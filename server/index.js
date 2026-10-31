import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { createServer } from './app.js';

const pokedex = JSON.parse(readFileSync(new URL('../data/pokedex.json', import.meta.url), 'utf8'));
const { listen, close } = createServer({ pokedex });

const port = await listen(process.env.PORT || 3000, '0.0.0.0');

console.log(`เซิร์ฟเวอร์เกมเศรษฐีโปเกม่อนพร้อมแล้ว`);
console.log(`  เครื่องนี้:  http://localhost:${port}`);
for (const addrs of Object.values(networkInterfaces())) {
  for (const a of addrs ?? []) {
    if (a.family === 'IPv4' && !a.internal) console.log(`  ให้เพื่อนเข้า: http://${a.address}:${port}`);
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => close().finally(() => process.exit(0)));
}
