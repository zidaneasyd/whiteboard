(function initWhiteboardCore(globalScope) {
  'use strict';

  const VERSION = '1.0.0-rc.1';
  const MAX_RECENT = 7;
  const MAX_HISTORY = 60;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 4;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  function makeId(prefix = 'item') {
    if (globalScope.crypto?.randomUUID) return `${prefix}-${globalScope.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeCamera(camera) {
    return {
      x: finite(camera?.x),
      y: finite(camera?.y),
      scale: clamp(finite(camera?.scale, 1), MIN_ZOOM, MAX_ZOOM)
    };
  }

  function uniqueBoardName(boards, requested = 'Unnamed board', ignoredId = null) {
    const base = String(requested || 'Unnamed board').trim().slice(0, 64) || 'Unnamed board';
    const used = new Set((boards || [])
      .filter(board => board?.id !== ignoredId)
      .map(board => String(board?.name || '').trim().toLocaleLowerCase('id-ID')));
    if (!used.has(base.toLocaleLowerCase('id-ID'))) return base;
    let suffix = 2;
    while (used.has(`${base} ${suffix}`.toLocaleLowerCase('id-ID'))) suffix += 1;
    return `${base} ${suffix}`;
  }

  function orderedSelection(selectionOrder, selectedIds, cards, automatic = false) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    if (automatic) return (cards || []).filter(card => selected.has(card.id)).map(card => card.id);
    const ordered = [...new Set(selectionOrder || [])].filter(id => selected.has(id));
    for (const card of cards || []) if (selected.has(card.id) && !ordered.includes(card.id)) ordered.push(card.id);
    return ordered;
  }

  function toggleSelectionLinks(connections, orderedIds) {
    const ids = [...new Set(orderedIds || [])];
    if (ids.length < 2) return { connections: clone(connections || []), removed: false, changed: false };
    const selected = new Set(ids);
    const source = connections || [];
    const hasInternal = source.some(item => selected.has(item.from) && selected.has(item.to));
    if (hasInternal) {
      const next = source.filter(item => !(selected.has(item.from) && selected.has(item.to)));
      return { connections: clone(next), removed: true, changed: next.length !== source.length };
    }
    const pairs = new Set(source.map(item => `${item.from}>${item.to}`));
    const next = clone(source);
    for (let index = 1; index < ids.length; index += 1) {
      const from = ids[index - 1];
      const to = ids[index];
      if (from === to || pairs.has(`${from}>${to}`) || pairs.has(`${to}>${from}`)) continue;
      next.push({ id: makeId('connection'), from, to, label: '' });
      pairs.add(`${from}>${to}`);
    }
    return { connections: next, removed: false, changed: next.length !== source.length };
  }

  function duplicateCards(cards, connections, selectedIds, dx = 24, dy = 24) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const chosen = (cards || []).filter(card => selected.has(card.id));
    const idMap = new Map();
    const groupMap = new Map();
    let nextNumericId = (cards || []).reduce((highest, card) => Math.max(highest, finite(card.id) + 1), 1);
    const added = chosen.map(source => {
      const id = typeof source.id === 'number' ? nextNumericId++ : makeId('card');
      idMap.set(source.id, id);
      if (source.groupId && !groupMap.has(source.groupId)) groupMap.set(source.groupId, makeId('group'));
      return {
        ...clone(source), id,
        x: finite(source.x) + finite(dx),
        y: finite(source.y) + finite(dy),
        groupId: source.groupId ? groupMap.get(source.groupId) : null
      };
    });
    const links = (connections || [])
      .filter(link => idMap.has(link.from) && idMap.has(link.to))
      .map(link => ({ ...clone(link), id: makeId('connection'), from: idMap.get(link.from), to: idMap.get(link.to) }));
    return { cards: added, connections: links, ids: added.map(card => card.id), nextNumericId };
  }

  function historySnapshot(board) {
    const cards = (board?.cards || []).map(card => {
      const copy = { ...card };
      // Media bytes are immutable. The app keeps them by reference between history states.
      return copy;
    });
    return { version: 4, boardId: board?.id || null, cards, connections: clone(board?.connections || []) };
  }

  function boardBounds(cards) {
    if (!cards?.length) return null;
    const metrics = cards.map(card => {
      const scale = Math.max(0.01, finite(card.scale, 1));
      const width = Math.max(1, finite(card.width, card.richText ? 320 : 112)) * scale;
      const height = Math.max(1, finite(card.height, card.richText ? 72 : 48)) * scale;
      const left = finite(card.x);
      const top = finite(card.y);
      return { left, top, right: left + width, bottom: top + height };
    });
    return {
      left: Math.min(...metrics.map(item => item.left)),
      top: Math.min(...metrics.map(item => item.top)),
      right: Math.max(...metrics.map(item => item.right)),
      bottom: Math.max(...metrics.map(item => item.bottom))
    };
  }

  function recentAfterSave(recentIds, boardId, existingIds) {
    const available = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
    return [boardId, ...(recentIds || []).filter(id => id !== boardId && available.has(id))].slice(0, MAX_RECENT);
  }

  const api = {
    VERSION, MAX_RECENT, MAX_HISTORY, MIN_ZOOM, MAX_ZOOM,
    clamp, clone, finite, makeId, normalizeCamera, uniqueBoardName,
    orderedSelection, toggleSelectionLinks, duplicateCards, historySnapshot,
    boardBounds, recentAfterSave
  };

  globalScope.WhiteboardCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
