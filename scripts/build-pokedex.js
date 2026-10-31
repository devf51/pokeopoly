// สคริปต์ Node เท่านั้น: ดึงข้อมูล Gen 1 จาก PokéAPI แล้วเขียน data/pokedex.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const TOTAL = 151;
const BATCH = 10;
const NAME_OVERRIDES = { 29: 'Nidoran♀', 32: 'Nidoran♂', 83: "Farfetch'd", 122: 'Mr. Mime' };

function displayName(id, apiName) {
  if (NAME_OVERRIDES[id]) return NAME_OVERRIDES[id];
  return apiName.charAt(0).toUpperCase() + apiName.slice(1);
}

async function fetchOne(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`PokéAPI ตอบ ${res.status} สำหรับ id ${id}`);
  const d = await res.json();
  return {
    id,
    name: displayName(id, d.name),
    types: d.types.map(t => t.type.name),
    bst: d.stats.reduce((sum, s) => sum + s.base_stat, 0),
    sprite: d.sprites.front_default,
  };
}

const data = [];
for (let start = 1; start <= TOTAL; start += BATCH) {
  const ids = [];
  for (let id = start; id < start + BATCH && id <= TOTAL; id++) ids.push(id);
  data.push(...(await Promise.all(ids.map(fetchOne))));
}
data.sort((a, b) => a.id - b.id);

const out = fileURLToPath(new URL('../data/pokedex.json', import.meta.url));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 1));
console.log(`เขียน ${data.length} รายการไปที่ ${out}`);
