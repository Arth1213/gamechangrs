const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlayerLookup, resolvePlayerId } = require('../src/load/repository');

test('database fallback cannot undo an unresolved ambiguous commentary identity', () => {
  const lookup = buildPlayerLookup([
    { playerId: 1, sourcePlayerId: 'one', displayName: 'Arnav Jhamb' },
    { playerId: 2, sourcePlayerId: 'two', displayName: 'Adnit Jhamb' },
  ], [
    { sourcePlayerId: 'one', displayName: 'Arnav Jhamb', aliases: ['A Jhamb'] },
    { sourcePlayerId: 'two', displayName: 'Adnit Jhamb', aliases: ['A Jhamb'] },
  ]);
  assert.equal(resolvePlayerId(lookup, '', 'A Jhamb'), null);
  assert.equal(resolvePlayerId(lookup, 'two', 'A Jhamb'), 2);
  assert.equal(resolvePlayerId(lookup, '', 'Arnav Jhamb'), 1);
});
