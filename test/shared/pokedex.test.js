import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPools, zoneOfDex } from '../../shared/pokedex.js';

const pokedex = JSON.parse(readFileSync(new URL('../../data/pokedex.json', import.meta.url)));

test('pokedex has 151 well-formed entries', () => {
  assert.equal(pokedex.length, 151);
  pokedex.forEach((p, i) => {
    assert.equal(p.id, i + 1);
    assert.ok(p.types.length >= 1 && p.types.length <= 2);
    assert.ok(p.bst > 0);
    assert.match(p.sprite, /^https:\/\//);
  });
  assert.equal(pokedex[24].name, 'Pikachu');
  assert.equal(pokedex[121].name, 'Mr. Mime');
});

test('pools split 146 non-legendaries 30/29/29/29/29 by BST', () => {
  const pools = buildPools(pokedex);
  assert.deepEqual([1, 2, 3, 4, 5].map(z => pools[z].length), [30, 29, 29, 29, 29]);
  assert.deepEqual(pools.legendary, [144, 145, 146, 150, 151]);
  const bst = id => pokedex[id - 1].bst;
  for (let z = 1; z < 5; z++)
    assert.ok(Math.max(...pools[z].map(bst)) <= Math.min(...pools[z + 1].map(bst)));
  assert.equal(zoneOfDex(pools, 10), 1);           // Caterpie
  assert.equal(zoneOfDex(pools, 149), 5);          // Dragonite
  assert.equal(zoneOfDex(pools, 150), 'legendary');
});

test('pools are disjoint, cover all 151 ids, and break BST ties by id', () => {
  const pools = buildPools(pokedex);
  const all = [1, 2, 3, 4, 5, 'legendary'].flatMap(z => pools[z]);
  assert.equal(new Set(all).size, 151);
  assert.equal(all.length, 151);
  const bst = id => pokedex[id - 1].bst;
  for (let z = 1; z <= 5; z++)
    for (let i = 1; i < pools[z].length; i++) {
      const [a, b] = [pools[z][i - 1], pools[z][i]];
      assert.ok(bst(a) < bst(b) || (bst(a) === bst(b) && a < b));
    }
});

test('zoneOfDex rejects unknown dex ids', () => {
  const pools = buildPools(pokedex);
  assert.throws(() => zoneOfDex(pools, 999));
});
