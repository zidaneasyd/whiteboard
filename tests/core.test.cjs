const assert = require('node:assert/strict');
const core = require('../assets/js/core.js');

const cards = [
  { id: 1, x: 0, y: 0, width: 100, height: 50, color: '#3978f6' },
  { id: 2, x: 140, y: 0, width: 100, height: 50, color: '#ef4444' },
  { id: 3, x: 280, y: 0, width: 100, height: 50, color: '#10b981' }
];

assert.equal(core.clamp(5, 0.1, 4), 4);
assert.equal(core.clamp(0, 0.1, 4), 0.1);
assert.equal(core.uniqueBoardName([{ id: 'a', name: 'Unnamed board' }], 'Unnamed board'), 'Unnamed board 2');

const linked = core.toggleSelectionLinks([], [3, 1, 2]);
assert.deepEqual(linked.connections.map(item => [item.from, item.to]), [[3, 1], [1, 2]]);
const unlinked = core.toggleSelectionLinks(linked.connections, [3, 1, 2]);
assert.equal(unlinked.connections.length, 0);

const duplicate = core.duplicateCards(cards, [], new Set([1, 3]), 24, 24);
assert.equal(duplicate.cards.length, 2);
assert.deepEqual(duplicate.cards.map(card => [card.x, card.y]), [[24, 24], [304, 24]]);
assert.equal(new Set(duplicate.ids).size, 2);

const bounds = core.boardBounds(cards);
assert.deepEqual(bounds, { left: 0, top: 0, right: 380, bottom: 50 });
assert.deepEqual(core.recentAfterSave(['b', 'a'], 'c', new Set(['a', 'b', 'c'])), ['c', 'b', 'a']);
console.log('core.test: ok');
