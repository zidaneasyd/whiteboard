    (() => {
      'use strict';

      const Core = window.WhiteboardCore;
      const Store = window.WhiteboardStorage;
      if (!Core || !Store) throw new Error('Modul inti Whiteboard gagal dimuat.');

      const viewport = document.getElementById('viewport');
      const world = document.getElementById('world');
      const zoomIndicator = document.getElementById('zoomIndicator');
      const versionButton = document.getElementById('versionButton');
      const versionModal = document.getElementById('versionModal');
      const scrim = document.getElementById('scrim');
      const closeVersionModalButton = document.getElementById('closeVersionModal');
      const exportModal = document.getElementById('exportModal');
      const closeExportModalButton = document.getElementById('closeExportModal');
      const cancelExportButton = document.getElementById('cancelExport');
      const confirmExportButton = document.getElementById('confirmExport');
      const exportName = document.getElementById('exportName');
      const dropOverlay = document.getElementById('dropOverlay');
      const colorBar = document.getElementById('colorBar');
      const multiSelectionFrame = document.getElementById('multiSelectionFrame');
      const boardOverviewModal = document.getElementById('boardOverviewModal');
      const closeBoardOverviewButton = document.getElementById('closeBoardOverview');
      const boardOverviewGrid = document.getElementById('boardOverviewGrid');
      const allBoardsModal = document.getElementById('allBoardsModal');
      const allBoardsList = document.getElementById('allBoardsList');
      const allBoardsPreview = document.getElementById('allBoardsPreview');
      const closeAllBoardsButton = document.getElementById('closeAllBoards');
      const newBoardModal = document.getElementById('newBoardModal');
      const newBoardName = document.getElementById('newBoardName');
      const confirmNewBoard = document.getElementById('confirmNewBoard');
      const closeBoardWarningModal = document.getElementById('closeBoardWarningModal');
      const settingsButton = document.getElementById('settingsButton');
      const settingsModal = document.getElementById('settingsModal');
      const closeSettingsButton = document.getElementById('closeSettings');
      const selectionBox = document.getElementById('selectionBox');
      const cardCount = document.getElementById('cardCount');
      const selectedCount = document.getElementById('selectedCount');
      const layerInfo = document.getElementById('layerInfo');
      const groupInfo = document.getElementById('groupInfo');
      const cursorTool = document.getElementById('cursorTool');
      const connectorTool = document.getElementById('connectorTool');
      const addCardTool = document.getElementById('addCardTool');
      const pickerTool = document.getElementById('pickerTool');
      const handTool = document.getElementById('handTool');
      const toolRail = document.getElementById('toolRail');
      const contextMenu = document.getElementById('contextMenu');
      const boardCardMenu = document.getElementById('boardCardMenu');
      const textFormatBar = document.getElementById('textFormatBar');
      const connectionLayer = document.getElementById('connectionLayer');
      const boardSelect = document.getElementById('boardSelect');
      const boardName = document.getElementById('boardName');
      const newBoardButton = document.getElementById('newBoard');
      const exportBoardButton = document.getElementById('exportBoard');
      const importBoardButton = document.getElementById('importBoard');
      const importFile = document.getElementById('importFile');
      const saveBoardButton = document.getElementById('saveBoard');
      const importMediaButton = document.getElementById('importMedia');
      const mediaFile = document.getElementById('mediaFile');
      const activeBoardTitle = document.getElementById('activeBoardTitle');
      const openBoardsMenu = document.getElementById('openBoardsMenu');
      const renameBoardMenu = document.getElementById('renameBoardMenu');
      const snapToggleMenu = document.getElementById('snapToggleMenu');
      const importBoardFromOverview = document.getElementById('importBoardFromOverview');
      const dragMotionToggle = document.getElementById('dragMotionToggle');
      const saveToast = document.getElementById('saveToast');
      const mobileZoomOut = document.getElementById('mobileZoomOut');
      const mobileZoomIn = document.getElementById('mobileZoomIn');
      const mobileFit = document.getElementById('mobileFit');
      const documentModal = document.getElementById('documentModal');
      const documentTitle = document.getElementById('documentTitle');
      const documentContent = document.getElementById('documentContent');
      const closeDocumentModalButton = document.getElementById('closeDocumentModal');
      const STORAGE_KEY = 'whiteboard-app-v0.2';
      const LEGACY_STORAGE_KEY = 'whiteboard-kartu-v0.1';
      const SNAP_STORAGE_KEY = 'whiteboard-snap-enabled';
      const MOTION_STORAGE_KEY = 'whiteboard-drag-motion';
      const readLocal = key => { try { return window.localStorage.getItem(key); } catch { return null; } };
      const writeLocal = (key, value) => { try { window.localStorage.setItem(key, value); } catch (_) {} };

      let camera = { x: 0, y: 0, scale: 1 };
      let boards = [];
      let recentIds = [];
      let currentBoardId = null;
      let cards = [];
      let connections = [];
      let selectedIds = new Set();
      let selectionOrder = [];
      let alignmentAnchorId = null;
      let selectedConnectionId = null;
      let editingId = null;
      let drag = null;
      let pan = null;
      let marquee = null;
      let nextId = 1;
      let activeTool = 'cursor';
      let pendingConnectionId = null;
      const boardHistories = new Map();
      let clipboardData = null;
      let internalClipboardToken = '';
      let preparingInternalCopy = false;
      let undoStack = [];
      let redoStack = [];
      let lastSnapshot = '';
      let lastCardAction = null;
      let suppressNextContextMenu = false;
      let dragDepth = 0;
      let snapEnabled = readLocal(SNAP_STORAGE_KEY) !== 'false';
      let motionFrame = 0;
      let resize = null;
      let overviewSelectedBoardId = null;
      let boardMenuTargetId = null;
      let importMode = 'board-list';
      let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      let dragMotionEnabled = readLocal(MOTION_STORAGE_KEY) !== 'false';
      let dirty = false;
      let saveToastTimer = 0;
      let persistedStateSnapshot = '';
      const historyAssetCache = new Map();
      const closedBoardIds = new Set();
      let pendingCloseBoardId = null;
      let pendingNextBoardId = null;

      function scheduleMotionRender() {
        if (motionFrame) return;
        motionFrame = requestAnimationFrame(() => {
          motionFrame = 0;
          renderConnections();
          updateMultiSelectionFrame();
        });
      }

      function closeHeaderMenus() {
        document.querySelectorAll('.app-menu.open').forEach(menu => menu.classList.remove('open'));
      }

      function updateSnapControl() {
        const check = snapToggleMenu.querySelector('.menu-check');
        const state = snapToggleMenu.querySelector('kbd');
        check.textContent = snapEnabled ? '✓' : '';
        state.textContent = snapEnabled ? 'Aktif' : 'Mati';
      }

      function updateMotionSetting() {
        document.body.classList.toggle('motion-enabled', dragMotionEnabled);
        dragMotionToggle.checked = dragMotionEnabled;
        document.getElementById('animationMenu')?.querySelector('kbd') && (document.getElementById('animationMenu').querySelector('kbd').textContent = dragMotionEnabled ? 'Aktif' : 'Nonaktif');
      }

      function escapeText(value) {
        return String(value ?? '').replace(/\r\n?/g, '\n');
      }

      function normalizeColor(value, fallback) {
        if (value === 'transparent') return value;
        return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
      }

      function colorWithAlpha(hex, alpha) {
        const clean = (hex === 'transparent' ? '#6b7280' : normalizeColor(hex, '#3978f6')).slice(1);
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      // Ikon antarmuka memakai geometri Lucide dan ditanam lokal agar tetap bekerja offline.
      const iconPaths = {
        folder: '<path d="m3 7 2-2h5l2 2h9v12H3Z"/><path d="M3 9h18"/>',
        file: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
        plus: '<path d="M12 5v14M5 12h14"/>', pencil: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10Z"/><path d="m13.5 6.5 3.5 3.5"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
        download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"/>', upload: '<path d="M12 16V4m0 0 4 4m-4-4L8 8M5 20h14"/>',
        undo: '<path d="m9 7-5 5 5 5"/><path d="M4 12h9a7 7 0 0 1 7 7"/>', redo: '<path d="m15 7 5 5-5 5"/><path d="M20 12h-9a7 7 0 0 0-7 7"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
        duplicate: '<rect x="4" y="7" width="11" height="11" rx="2"/><rect x="9" y="3" width="11" height="11" rx="2"/><path d="M14.5 6v5M12 8.5h5"/>',
        repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
        group: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/>',
        ungroup: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/><path d="M10 7h4m-2-2 2 2-2 2M14 17h-4m2-2-2 2 2 2"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
        scan: '<path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3"/>',
        magnet: '<path d="M6 15V8a6 6 0 0 1 12 0v7"/><path d="M6 15h4v4H6zM14 15h4v4h-4z"/>', keyboard: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M8 13h8"/>',
        front: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>', back: '<rect x="5" y="5" width="11" height="11" rx="2"/><path d="M8 16v3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-3"/>',
        alignLeft: '<path d="M4 4v16M8 7h10M8 12h7M8 17h10"/>', alignTop: '<path d="M4 4h16M7 8v10M12 8v7M17 8v10"/>',
        pointer: '<path d="m5 3 14 9-7 2-3 7Z"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
        hand: '<path d="M7 11V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-3a2 2 0 0 1 4 0v7c0 5-3 8-8 8-3 0-5-2-7-5l-2-3a2 2 0 0 1 3-2l2 2"/>',
        eyedropper: '<path d="m19 3 2 2-9.5 9.5-3-3Z"/><path d="m9 13-5 5v2h2l5-5"/>',
        scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.5 8.5 11 7M8.5 15.5l11-7"/>',
        clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6"/>',
        zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/>',
        zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7.5 10.5h6"/>',
        selectAll: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
        settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>', save: '<path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
        more: '<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>'
      };

      function lucideIcon(name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = iconPaths[name] || iconPaths.plus;
        svg.setAttribute('aria-hidden', 'true');
        return svg;
      }

      function installMenuIcons() {
        const icons = { openBoardsMenu:'folder', newBoard:'plus', renameBoardMenu:'pencil', saveBoard:'save', importMedia:'image', exportBoard:'download', importBoard:'upload', openDeviceMenu:'folder', closeBoardMenu:'x', undoMenu:'undo', redoMenu:'redo', duplicateMenu:'duplicate', groupMenu:'group', ungroupMenu:'ungroup', cutMenu:'scissors', copyMenu:'copy', pasteMenu:'clipboard', deleteMenu:'trash', selectAllMenu:'selectAll', fitMenu:'scan', zoomInMenu:'zoomIn', zoomOutMenu:'zoomOut', animationMenu:'settings', snapToggleMenu:'magnet', settingsButton:'keyboard', toggleToolbarMenu:'pointer', togglePaletteMenu:'eyedropper', toggleHistoryMenu:'clipboard', toggleBoardStripMenu:'folder' };
        Object.entries(icons).forEach(([id, name]) => document.getElementById(id)?.prepend(lucideIcon(name)));
        addCardTool.replaceChildren(lucideIcon('plus'));
        cursorTool.replaceChildren(lucideIcon('pointer'));
        connectorTool.replaceChildren(lucideIcon('link'));
        pickerTool.replaceChildren(lucideIcon('eyedropper'));
        handTool.replaceChildren(lucideIcon('hand'));
        document.querySelectorAll('.close-button').forEach(button => button.replaceChildren(lucideIcon('x')));
        document.querySelector('.drop-icon')?.replaceChildren(lucideIcon('upload'));
        const quickIcons={quickUndo:'undo',quickRedo:'redo',quickCut:'scissors',quickCopy:'copy',quickPaste:'clipboard',quickDuplicate:'duplicate',quickRepeat:'repeat',quickDelete:'trash',quickGroup:'group',quickUngroup:'ungroup',quickSelectAll:'selectAll',quickZoomIn:'zoomIn',quickZoomOut:'zoomOut',quickFit:'scan'};
        Object.entries(quickIcons).forEach(([id,name])=>document.getElementById(id)?.replaceChildren(lucideIcon(name)));
      }

      function applyCardStyle(el, card) {
        const color = card.color === 'transparent' ? 'transparent' : normalizeColor(card.color, '#3978f6');
        const textColor = color === 'transparent' && (!card.textColor || card.textColor === '#ffffff') ? '#242a26' : normalizeColor(card.textColor, '#ffffff');
        el.style.backgroundColor = color;
        el.style.color = textColor;
        const isWhite = color.toLowerCase() === '#ffffff';
        el.style.borderColor = color === 'transparent' ? 'rgba(36,42,38,.28)' : isWhite ? '#9ca3af' : 'rgba(255, 255, 255, .82)';
        el.style.setProperty('--card-glow', isWhite ? 'rgba(107, 114, 128, .34)' : colorWithAlpha(color, .34));
        el.style.setProperty('--card-glow-soft', isWhite ? 'rgba(107, 114, 128, .18)' : colorWithAlpha(color, .18));
      }

      function makeId(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      }

      function createBoard(name = 'Board baru', initialCards = [], initialConnections = []) {
        return { id: makeId('board'), name, cards: initialCards, connections: initialConnections, camera: { x: 0, y: 0, scale: 1 }, savedAt: null };
      }

      function currentBoard() {
        return boards.find(board => board.id === currentBoardId);
      }

      function syncCurrentBoard() {
        const board = currentBoard();
        if (!board) return;
        board.cards = cards;
        board.connections = connections;
        board.camera = { ...camera };
      }

      function serializeState() {
        syncCurrentBoard();
        const persistedBoards = boards.filter(board => board.savedAt);
        return JSON.stringify({ version: 4, currentBoardId: persistedBoards.some(board => board.id === currentBoardId) ? currentBoardId : persistedBoards[0]?.id || null, recentIds: recentIds.filter(id => persistedBoards.some(board => board.id === id)).slice(0, 7), boards: persistedBoards });
      }

      function updatePersistedSnapshot(upsert = null, removeId = null) {
        let state = { version: 5, boards: [], recentIds: [] };
        try { state = JSON.parse(persistedStateSnapshot || '{}'); } catch (_) {}
        const byId = new Map((state.boards || []).map(board => [board.id, board]));
        if (removeId) byId.delete(removeId);
        if (upsert?.id) byId.set(upsert.id, Core.clone(upsert));
        const ids = new Set(byId.keys());
        persistedStateSnapshot = JSON.stringify({
          version: 5,
          currentBoardId: ids.has(currentBoardId) ? currentBoardId : null,
          recentIds: recentIds.filter(id => ids.has(id)).slice(0, Core.MAX_RECENT),
          boards: [...byId.values()]
        });
      }

      function serializeHistoryState() {
        syncCurrentBoard();
        const historyCards = cards.map(card => {
          if (!['image','svg','audio','video'].includes(card.type)) return { ...card };
          const assetKey = `${currentBoardId}:${card.id}`;
          historyAssetCache.set(assetKey, { data: card.data || '', cover: card.cover || '' });
          const copy = { ...card };
          delete copy.data;
          delete copy.cover;
          copy.__assetKey = assetKey;
          return copy;
        });
        return JSON.stringify({ version: 4, boardId: currentBoardId, cards: historyCards, connections });
      }

      function storageMeta() {
        const savedIds = new Set(boards.filter(board => board.savedAt).map(board => board.id));
        return {
          version: 5,
          currentBoardId: savedIds.has(currentBoardId) ? currentBoardId : null,
          recentIds: recentIds.filter(id => savedIds.has(id)).slice(0, Core.MAX_RECENT),
          updatedAt: Date.now()
        };
      }

      function loadCurrentBoard() {
        const board = currentBoard();
        if (!board) { currentBoardId = null; cards = []; connections = []; selectedIds.clear(); selectionOrder = []; alignmentAnchorId = null; pendingConnectionId = null; selectedConnectionId = null; camera = {x:0,y:0,scale:1}; return; }
        currentBoardId = board.id;
        cards = Array.isArray(board.cards) ? board.cards : [];
        connections = Array.isArray(board.connections) ? board.connections : [];
        camera = board.camera && Number.isFinite(board.camera.scale) ? { ...board.camera } : { x: 0, y: 0, scale: 1 };
        nextId = cards.reduce((highest, card) => {
          const numeric = Number(card.id);
          return Number.isFinite(numeric) ? Math.max(highest, numeric + 1) : highest;
        }, 1);
        selectedIds.clear();
        selectionOrder = [];
        alignmentAnchorId = null;
        pendingConnectionId = null;
        selectedConnectionId = null;
      }

      async function loadState() {
        try {
          const stored = await Store.loadAll();
          let saved = stored.boards.length ? { boards: stored.boards, ...stored.meta } : null;
          if (!saved) {
            const fallback = readLocal(STORAGE_KEY);
            saved = fallback ? JSON.parse(fallback) : null;
            if (saved?.boards?.length) {
              saved.boards = saved.boards.map((board, index) => ({ ...board, savedAt: board.savedAt || Date.now() - index }));
              await Store.replaceAll(saved.boards, {
                version: 5,
                currentBoardId: saved.currentBoardId || null,
                recentIds: Array.isArray(saved.recentIds) ? saved.recentIds.slice(0, Core.MAX_RECENT) : []
              });
            }
          }
          if (saved && Array.isArray(saved.boards)) {
            boards = saved.boards;
            boards.forEach((board, index) => { if (!board.savedAt) board.savedAt = Date.now() - index; });
            recentIds = Array.isArray(saved.recentIds) ? saved.recentIds.filter(id => boards.some(board => board.id === id)).slice(0, Core.MAX_RECENT) : boards.slice(0, Core.MAX_RECENT).map(board => board.id);
            currentBoardId = saved.currentBoardId && boards.some(board => board.id === saved.currentBoardId) ? saved.currentBoardId : null;
          } else {
            const legacy = JSON.parse(readLocal(LEGACY_STORAGE_KEY));
            const legacyCards = legacy && Array.isArray(legacy.cards) ? legacy.cards : [];
            boards = legacyCards.length ? [createBoard('Board 1', legacyCards, [])] : [];
            boards.forEach(board => { board.savedAt = Date.now(); });
            recentIds = boards.map(board => board.id);
            currentBoardId = null;
            if (boards.length) await Store.replaceAll(boards, { version: 5, currentBoardId: null, recentIds });
          }
        } catch (error) {
          console.warn('Data tersimpan tidak dapat dimuat', error);
          boards = []; currentBoardId = null;
        }
        loadCurrentBoard();
        lastSnapshot = serializeHistoryState();
        persistedStateSnapshot = serializeState();
      }

      function saveState(recordHistory = true) {
        syncCurrentBoard();
        const historySnapshot = serializeHistoryState();
        const changed = Boolean(lastSnapshot && historySnapshot !== lastSnapshot);
        if (recordHistory && changed) {
          undoStack.push(lastSnapshot);
          if (undoStack.length > Core.MAX_HISTORY) undoStack.shift();
          redoStack = [];
        }
        if (recordHistory && changed) dirty = true;
        lastSnapshot = historySnapshot;
        updateStatus();
        updateBoardControls();
      }

      async function saveBoardNow() {
        finishEdit(true);
        const board = currentBoard();
        if (!board) return false;
        syncCurrentBoard();
        const previousSavedAt = board.savedAt;
        const previousRecent = [...recentIds];
        board.savedAt = Date.now();
        const savedIds = new Set(boards.filter(item => item.savedAt).map(item => item.id));
        recentIds = Core.recentAfterSave(recentIds, board.id, savedIds);
        try {
          await Store.saveBoard(Core.clone(board), storageMeta());
        } catch (error) {
          board.savedAt = previousSavedAt;
          recentIds = previousRecent;
          console.warn('Penyimpanan IndexedDB gagal', error);
          window.alert('Board belum dapat disimpan. Periksa ruang penyimpanan browser lalu coba lagi.');
          return false;
        }
        updatePersistedSnapshot(board);
        dirty = false;
        activeBoardTitle.textContent = `${currentBoard()?.name || 'Board'} · tersimpan`;
        showSaveToast();
        window.setTimeout(updateBoardControls, 1100);
        return true;
      }

      function restorePersistedState() {
        if (!persistedStateSnapshot) return;
        try {
          const state = JSON.parse(persistedStateSnapshot);
          boards = Array.isArray(state.boards) ? state.boards : [];
          recentIds = Array.isArray(state.recentIds) ? state.recentIds.slice(0, 7) : [];
          currentBoardId = state.currentBoardId && boards.some(board => board.id === state.currentBoardId) ? state.currentBoardId : null;
          loadCurrentBoard();
          undoStack = []; redoStack = []; dirty = false;
          lastSnapshot = serializeHistoryState();
        } catch (_) {}
      }

      function showSaveToast(message = 'Board tersimpan') {
        window.clearTimeout(saveToastTimer);
        saveToast.textContent = message;
        saveToast.classList.remove('show');
        requestAnimationFrame(() => saveToast.classList.add('show'));
        saveToastTimer = window.setTimeout(() => saveToast.classList.remove('show'), 1700);
      }

      function applySnapshot(snapshot) {
        pendingConnectionId = null;
        const state = JSON.parse(snapshot);
        if (state.boardId !== currentBoardId || !Array.isArray(state.cards)) return;
        cards = state.cards.map(card => {
          if (!card.__assetKey) return card;
          const asset = historyAssetCache.get(card.__assetKey);
          const restored = { ...card };
          delete restored.__assetKey;
          return asset ? { ...restored, data: asset.data, cover: asset.cover } : restored;
        });
        connections = Array.isArray(state.connections) ? state.connections : [];
        const board = currentBoard();
        if (board) { board.cards = cards; board.connections = connections; }
        nextId = cards.reduce((highest, card) => {
          const numeric = Number(card.id);
          return Number.isFinite(numeric) ? Math.max(highest, numeric + 1) : highest;
        }, 1);
        selectedIds.clear();
        selectionOrder = [];
        alignmentAnchorId = null;
        selectedConnectionId = null;
        lastSnapshot = snapshot;
        dirty = true;
        renderAll();
      }

      function undo() {
        if (!undoStack.length) return;
        redoStack.push(serializeHistoryState());
        applySnapshot(undoStack.pop());
      }

      function redo() {
        if (!redoStack.length) return;
        undoStack.push(serializeHistoryState());
        applySnapshot(redoStack.pop());
      }

      function updateStatus() {
        cardCount.textContent = cards.length;
        selectedCount.textContent = selectedIds.size;
        syncLayers();
        if (selectedIds.size === 1) {
          const id = [...selectedIds][0];
          const index = cards.findIndex(card => card.id === id);
          const units=layerUnits(); const active=cards[index]; const unit=units.findIndex(c=>active?.groupId ? c.groupId===active.groupId : c.id===id);
          layerInfo.textContent = unit>=0 ? `${unit+1}/${units.length}` : '—';
        } else {
          const active=cards.filter(c=>selectedIds.has(c.id));const units=layerUnits();
          layerInfo.textContent = active.length && active[0].groupId && active.every(c=>c.groupId===active[0].groupId) ? `${units.findIndex(c=>c.groupId===active[0].groupId)+1}/${units.length}` : '—';
        }
        const activeGroups = [...new Set(cards.filter(card => selectedIds.has(card.id) && card.groupId).map(card => card.groupId))];
        if (activeGroups.length === 1) {
          const total = cards.filter(card => card.groupId === activeGroups[0]).length;
          groupInfo.textContent = `${total} kartu`;
        } else groupInfo.textContent = '—';
      }

      function screenToWorld(clientX, clientY) {
        return { x: (clientX - camera.x) / camera.scale, y: (clientY - camera.y) / camera.scale };
      }

      function updateGridBackground(x = camera.x, y = camera.y, scale = camera.scale) {
        const size = 24 * scale;
        const offsetX = ((x % size) + size) % size;
        const offsetY = ((y % size) + size) % size;
        viewport.style.backgroundSize = `${size}px ${size}px`;
        viewport.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
      }

      function updateCamera() {
        updateGridBackground();
        zoomIndicator.textContent = `${Math.round(camera.scale * 100)}%`;
        world.querySelectorAll('.card').forEach(el => {
          const card = cards.find(item => item.id === Number(el.dataset.id));
          if (card) positionCard(el, card);
        });
        syncLayers();
        renderConnections();
        updateMultiSelectionFrame();
        if (editingId !== null && cards.find(card => card.id === editingId)?.richText) showTextFormatBar(cardElement(editingId));
      }

      function zoomAt(clientX, clientY, factor) {
        const before = screenToWorld(clientX, clientY);
        const newScale = Math.min(4, Math.max(.1, camera.scale * factor));
        camera.scale = newScale;
        camera.x = clientX - before.x * newScale;
        camera.y = clientY - before.y * newScale;
        updateCamera();
      }

      function zoomFromPointer(direction) {
        const factor=direction==='in'?1.2:1/1.2;
        zoomAt(lastPointer.x,lastPointer.y,factor);
        const feedback=document.createElement('div');feedback.className='cursor-feedback';feedback.style.left=`${lastPointer.x}px`;feedback.style.top=`${lastPointer.y}px`;feedback.append(lucideIcon(direction==='in'?'zoomIn':'zoomOut'));document.body.append(feedback);setTimeout(()=>feedback.remove(),450);
      }

      function toggleSurface(element,menu) {
        element.classList.toggle('surface-hidden');
        menu.querySelector('kbd').textContent=element.classList.contains('surface-hidden')?'Nonaktif':'Aktif';
      }

      function fitAllCards() {
        if (!cards.length) return;
        const metrics = cards.map(card => {
          const rect = cardElement(card.id)?.getBoundingClientRect();
          return { card, width: rect ? rect.width / camera.scale : 112, height: rect ? rect.height / camera.scale : 48 };
        });
        const minX = Math.min(...metrics.map(item => item.card.x));
        const minY = Math.min(...metrics.map(item => item.card.y));
        const maxX = Math.max(...metrics.map(item => item.card.x + item.width));
        const maxY = Math.max(...metrics.map(item => item.card.y + item.height));
        const boardWidth = Math.max(1, maxX - minX);
        const boardHeight = Math.max(1, maxY - minY);
        const scale = Math.min(4, Math.max(.1, Math.min((window.innerWidth - 160) / boardWidth, (window.innerHeight - 160) / boardHeight)));
        camera.scale = scale;
        camera.x = window.innerWidth / 2 - ((minX + maxX) / 2) * scale;
        camera.y = window.innerHeight / 2 - ((minY + maxY) / 2) * scale;
        updateCamera();
      }

      function positionCard(el, card) {
        const rich=card.richText && !isMediaCard(card);
        const cardScale = Math.max(.04, Number(card.scale) || 1);
        el.style.zoom=rich?String(camera.scale):'';
        el.style.setProperty('--zoom', rich?1:camera.scale);
        el.style.setProperty('--card-scale',cardScale);
        el.style.transform = `scale(${cardScale})`;
        const resizeHandle=el.querySelector('.card-resize');
        if(resizeHandle)resizeHandle.style.transform=`scale(${1/cardScale})`;
        const stage=el.querySelector('.media-stage'); if(stage)stage.style.transform='scale('+camera.scale+')';
        el.style.left = `${(camera.x + card.x * camera.scale)/(rich?camera.scale:1)}px`;
        el.style.top = `${(camera.y + card.y * camera.scale)/(rich?camera.scale:1)}px`;
        if (['image','video','audio','svg'].includes(card.type)) {
          el.style.setProperty('--media-width', `${card.width * camera.scale}px`);
          el.style.setProperty('--media-height', `${card.height * camera.scale}px`);
        }
      }

      function syncResizeHandle(el, card) {
        const handle=el?.querySelector('.card-resize');
        if(handle)handle.style.transform=`scale(${1/Math.max(.04,Number(card.scale)||1)})`;
      }

      function cardElement(id) {
        return world.querySelector(`.card[data-id="${id}"]`);
      }

      function renderConnections() {
        if (pan) return;
        connectionLayer.replaceChildren();
        connections = connections.filter(connection => cards.some(card => card.id === connection.from) && cards.some(card => card.id === connection.to));
        if (selectedConnectionId && !connections.some(connection => connection.id === selectedConnectionId)) selectedConnectionId = null;
        connections.forEach(connection => {
          const from = cardElement(connection.from);
          const to = cardElement(connection.to);
          if (!from || !to) return;
          const a = from.getBoundingClientRect();
          const b = to.getBoundingClientRect();
          const pixel = Math.max(1, window.devicePixelRatio || 1);
          const crisp = value => Math.round(value * pixel) / pixel;
          const coordinates = { x1: crisp(a.left + a.width / 2), y1: crisp(a.top + a.height / 2), x2: crisp(b.left + b.width / 2), y2: crisp(b.top + b.height / 2) };
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.classList.add('connection-line');
          if (selectedConnectionId === connection.id) line.classList.add('selected');
          Object.entries(coordinates).forEach(([key, value]) => line.setAttribute(key, value));
          const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          hit.classList.add('connection-hit');
          Object.entries(coordinates).forEach(([key, value]) => hit.setAttribute(key, value));
          hit.addEventListener('pointerdown', event => event.stopPropagation());
          hit.addEventListener('click', event => {
            event.stopPropagation();
            selectedConnectionId = connection.id;
            selectedIds.clear();
            syncSelection();
            renderConnections();
          });
          const mx = (coordinates.x1 + coordinates.x2) / 2, my = (coordinates.y1 + coordinates.y2) / 2;
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          labelBg.setAttribute('x', mx - 34); labelBg.setAttribute('y', my - 11); labelBg.setAttribute('width', 68); labelBg.setAttribute('height', 22); labelBg.setAttribute('rx', 4); labelBg.classList.add('connection-label');
          const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          labelText.setAttribute('x', mx); labelText.setAttribute('y', my + 3.5); labelText.setAttribute('text-anchor', 'middle'); labelText.classList.add('connection-label-text'); labelText.textContent = connection.label || 'Beri nama';
          const labelHit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          labelHit.setAttribute('x', mx - 38); labelHit.setAttribute('y', my - 15); labelHit.setAttribute('width', 76); labelHit.setAttribute('height', 30); labelHit.classList.add('connection-label-hit');
          labelHit.addEventListener('click', event => {
            event.stopPropagation(); document.querySelector('.relation-editor')?.remove();
            const input = document.createElement('input'); input.className = 'relation-editor'; input.value = connection.label || ''; input.placeholder = 'Nama hubungan…'; input.style.left = `${mx}px`; input.style.top = `${my}px`; document.body.append(input); input.focus(); input.select();
            const commit = () => { if (!input.isConnected) return; connection.label = input.value.trim(); input.remove(); saveState(); renderConnections(); };
            input.addEventListener('blur', commit); input.addEventListener('keydown', keyEvent => { if (keyEvent.key === 'Enter') { keyEvent.preventDefault(); commit(); } if (keyEvent.key === 'Escape') input.remove(); });
          });
          const labelWidth = Math.max(40, (connection.label || 'Beri nama').length * 6 + 16);
          labelBg.setAttribute('x', -labelWidth/2); labelBg.setAttribute('y', -11); labelBg.setAttribute('width', labelWidth);
          labelText.setAttribute('x', 0); labelText.setAttribute('y', 3.5);
          labelHit.setAttribute('x', -labelWidth/2-4); labelHit.setAttribute('y', -15); labelHit.setAttribute('width', labelWidth+8);
          label.setAttribute('transform', `translate(${mx} ${my}) scale(${camera.scale})`);
          labelHit.addEventListener('pointerdown', event => event.stopPropagation());
          label.append(labelBg, labelText, labelHit);
          connectionLayer.append(line, hit, label);
        });
      }

      function renderAll() {
        world.querySelectorAll('.card').forEach(card => card.remove());
        cards.forEach(renderCard);
        updateCamera();
        syncSelection();
        updateBoardControls();
      }

      function syncSelection() {
        world.querySelectorAll('.card').forEach(el => {
          const id = Number(el.dataset.id);
          el.classList.toggle('selected', selectedIds.has(id));
          el.classList.toggle('multi-selected', selectedIds.size > 1 && selectedIds.has(id));
          el.classList.toggle('active-selection', selectedIds.size > 1 && alignmentAnchorId === id);
          const card = cards.find(item => item.id === id);
          const groupIsFullySelected = Boolean(card?.groupId) && cards.filter(item => item.groupId === card.groupId).every(item => selectedIds.has(item.id));
          el.classList.toggle('group-active', groupIsFullySelected && selectedIds.has(id));
          el.classList.toggle('connect-source', pendingConnectionId === id);
        });
        pickerTool.disabled = selectedIds.size !== 1;
        updateStatus();
        updateMultiSelectionFrame();
      }

      function updateMultiSelectionFrame() {
        if (selectedIds.size < 2) {
          multiSelectionFrame.style.display = 'none';
          return;
        }
        const rects = [...selectedIds].map(id => cardElement(id)?.getBoundingClientRect()).filter(Boolean);
        if (rects.length < 2) {
          multiSelectionFrame.style.display = 'none';
          return;
        }
        const padding = 0;
        const left = Math.min(...rects.map(rect => rect.left)) - padding;
        const top = Math.min(...rects.map(rect => rect.top)) - padding;
        const right = Math.max(...rects.map(rect => rect.right)) + padding;
        const bottom = Math.max(...rects.map(rect => rect.bottom)) + padding;
        Object.assign(multiSelectionFrame.style, { display: 'block', left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      }

      function setActiveTool(tool) {
        activeTool = tool;
        pendingConnectionId = null;
        selectedConnectionId = null;
        cursorTool.classList.toggle('active', tool === 'cursor');
        connectorTool.classList.toggle('active', tool === 'connector');
        handTool.classList.toggle('active', tool === 'hand');
        cursorTool.setAttribute('aria-pressed', String(tool === 'cursor'));
        connectorTool.setAttribute('aria-pressed', String(tool === 'connector'));
        handTool.setAttribute('aria-pressed', String(tool === 'hand'));
        viewport.style.cursor = tool === 'connector' ? 'crosshair' : tool === 'hand' ? 'grab' : '';
        syncSelection();
      }

      function handleConnection(id) {
        if (pendingConnectionId === null) {
          pendingConnectionId = id;
          setSelected(id);
          pendingConnectionId = id;
          syncSelection();
          return;
        }
        if (pendingConnectionId !== id) {
          const existing = connections.find(item => (item.from === pendingConnectionId && item.to === id) || (item.from === id && item.to === pendingConnectionId));
          if (existing) connections = connections.filter(item => item.id !== existing.id);
          else connections.push({ id: makeId('connection'), from: pendingConnectionId, to: id });
          selectedConnectionId = null;
          saveState();
        }
        pendingConnectionId = null;
        setSelected(id);
        pendingConnectionId = null;
        renderConnections();
      }

      function setSelected(id, additive = false) {
        selectedConnectionId = null;
        if (id === null) {
          selectedIds.clear();
          selectionOrder = [];
          alignmentAnchorId = null;
        } else {
          const card = cards.find(item => item.id === id);
          const related = card?.groupId ? cards.filter(item => item.groupId === card.groupId).map(item => item.id) : [id];
          if (additive) {
            const remove = related.every(itemId => selectedIds.has(itemId));
            related.forEach(itemId => remove ? selectedIds.delete(itemId) : selectedIds.add(itemId));
            if (remove) selectionOrder = selectionOrder.filter(itemId => !related.includes(itemId));
            else selectionOrder = [...selectionOrder.filter(itemId => !related.includes(itemId)), ...related.filter(itemId => itemId !== id), id];
          } else {
            selectedIds = new Set(related);
            selectionOrder = [...related.filter(itemId => itemId !== id), id];
          }
          alignmentAnchorId = selectionOrder.at(-1) ?? null;
        }
        syncSelection();
      }

      function expandGroupedSelection() {
        const groupIds = new Set(cards.filter(card => selectedIds.has(card.id) && card.groupId).map(card => card.groupId));
        cards.forEach(card => { if (card.groupId && groupIds.has(card.groupId)) selectedIds.add(card.id); });
      }

      function createCardElement(card) {
        const el = document.createElement('article');
        el.className = `card${['image','video','audio','svg'].includes(card.type) ? ' media-card' : ''}${card.type === 'document' ? ' document-card' : ''}${card.kind === 'pasted-text' ? ' text-card' : ''}`;
        el.dataset.id = card.id;
        positionCard(el, card);
        if (card.type === 'image' || card.type === 'svg') {
          el.setAttribute('aria-label', `Gambar ${card.name || ''}`.trim());
          const image = document.createElement('img');
          image.src = card.data;
          image.alt = card.name || 'Media board';
          el.append(image);
        } else if (card.type === 'video' || card.type === 'audio') {
          // The passive media player is installed below. Avoid constructing a second
          // native control here because it would preload every file twice.
        } else if (card.type === 'document') {
          el.setAttribute('aria-label', `Dokumen ${card.name || ''}`.trim());
          el.append(lucideIcon('file'));
          const label = document.createElement('span'); label.textContent = card.name || 'Dokumen'; el.append(label);
        } else {
          applyCardStyle(el, card);
          if (card.textSize) el.style.setProperty('--text-size', `${card.textSize}px`);
          el.setAttribute('aria-label', 'Kartu catatan');
          const text = document.createElement('div');
          text.className = 'card-text';
          if (card.richText && card.html) text.innerHTML = sanitizeRichHtml(card.html);
          else text.textContent = card.text;
          el.appendChild(text);
        }

        if (isMediaCard(card)) {
          const handle = document.createElement('button');
          handle.type = 'button';
          handle.className = 'card-resize';
          handle.setAttribute('aria-label', 'Ubah ukuran media');
          handle.addEventListener('pointerdown', startCardResize);
          el.append(handle);
          syncResizeHandle(el,card);
        }

        if (['audio','video'].includes(card.type)) installMediaPlayer(el, card);
        el.addEventListener('pointerdown', startDrag);
        el.addEventListener('dblclick', event => {
          if (activeTool !== 'cursor') return;
          event.preventDefault();
          event.stopPropagation();
          if (card.type === 'document') openDocumentViewer(card);
          else if (!isMediaCard(card)) beginEdit(card.id);
        });
        world.appendChild(el);
        return el;
      }

      function renderCard(card) {
        return createCardElement(card);
      }

      function startCardResize(event) {
        event.preventDefault();
        event.stopPropagation();
        const el = event.currentTarget.closest('.card');
        const card = cards.find(item => item.id === Number(el.dataset.id));
        if (!card) return;
        setSelected(card.id);
        const rect = el.getBoundingClientRect();
        const startScale = Math.max(.04, Number(card.scale) || 1);
        resize = { pointerId: event.pointerId, card, el, startX: event.clientX, startScale, baseVisualWidth: rect.width / Math.max(.01, camera.scale * startScale) };
        window.addEventListener('pointermove', moveCardResize);
        window.addEventListener('pointerup', endCardResize);
        window.addEventListener('pointercancel', endCardResize);
      }

      function moveCardResize(event) {
        if (!resize || event.pointerId !== resize.pointerId) return;
        const visualWidth = Math.max(6, resize.baseVisualWidth * camera.scale * resize.startScale + event.clientX - resize.startX);
        resize.card.scale = Math.max(.04, visualWidth / Math.max(.01, resize.baseVisualWidth * camera.scale));
        positionCard(resize.el, resize.card);
        scheduleMotionRender();
      }

      function endCardResize(event) {
        if (!resize || event.pointerId !== resize.pointerId) return;
        window.removeEventListener('pointermove', moveCardResize);
        window.removeEventListener('pointerup', endCardResize);
        window.removeEventListener('pointercancel', endCardResize);
        resize = null;
        saveState();
      }

      function readMediaFile(file) {
        return new Promise((resolve, reject) => {
          if (!file || !file.type.startsWith('image/')) return reject(new Error('File bukan gambar yang didukung.'));
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error || new Error('Gambar tidak dapat dibaca.'));
          reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('Format gambar tidak dapat dibuka.'));
            image.onload = () => {
              const width = Math.min(420, Math.max(160, image.naturalWidth));
              resolve({ width, height: width * image.naturalHeight / image.naturalWidth, data: reader.result, name: file.name || 'Screenshot' });
            };
            image.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function readAudioMetadata(file) {
        // ID3 headers and cover art are at the beginning of common audio files;
        // avoid reading a full recording just to build the card preview.
        const buffer = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const result = { title: file.name.replace(/\.[^.]+$/, ''), cover: '' };
        if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0,3)) !== 'ID3') return result;
        const size = (bytes[6]<<21)|(bytes[7]<<14)|(bytes[8]<<7)|bytes[9];
        let offset = 10;
        const decode = data => new TextDecoder(data[0] === 3 ? 'utf-8' : 'iso-8859-1').decode(data.slice(1)).replace(/\0/g,'').trim();
        while (offset + 10 <= Math.min(bytes.length, size + 10)) {
          const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
          const frameSize = (bytes[offset+4]<<24)|(bytes[offset+5]<<16)|(bytes[offset+6]<<8)|bytes[offset+7];
          if (!frameSize || !/^\w{4}$/.test(id)) break;
          const data = bytes.slice(offset + 10, offset + 10 + frameSize);
          if (id === 'TIT2') result.title = decode(data) || result.title;
          if (id === 'APIC' && data.length > 8) {
            let p = 1; while (p < data.length && data[p] !== 0) p++;
            const mime = new TextDecoder().decode(data.slice(1,p)) || 'image/jpeg'; p += 2;
            const doubleNull = data[0] === 1 || data[0] === 2;
            while (p < data.length - 1 && (doubleNull ? !(data[p]===0 && data[p+1]===0) : data[p]!==0)) p += doubleNull ? 2 : 1;
            p += doubleNull ? 2 : 1;
            if (p < data.length) result.cover = await new Promise(resolve => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob([data.slice(p)],{type:mime})); });
          }
          offset += 10 + frameSize;
        }
        return result;
      }

      const textFilePattern = /\.(txt|md|markdown|csv|log|xml|html|css|js|ts|py)$/i;
      const audioFilePattern = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i;
      const videoFilePattern = /\.(mp4|webm|ogv|mov|m4v)$/i;
      async function importDocumentFile(file, clientX = window.innerWidth/2, clientY = window.innerHeight/2) {
        if (!currentBoard()) return openBoardOverview();
        const targetBoardId = currentBoardId;
        if (file.size > 2 * 1024 * 1024) throw new Error('Dokumen terlalu besar. Batas kartu dokumen adalah 2 MB.');
        const point = screenToWorld(clientX, clientY);
        const content = await file.text();
        if (targetBoardId !== currentBoardId) return;
        const card = { id:nextId++, type:'document', x:point.x-54, y:point.y-46, width:108, height:92, name:file.name, mime:file.type||'text/plain', content, groupId:null };
        cards.push(card); renderCard(card); setSelected(card.id); saveState();
      }

      function openDocumentViewer(card) {
        documentTitle.textContent = card.name || 'Dokumen';
        documentContent.textContent = card.content || '';
        documentModal.classList.add('open'); documentModal.setAttribute('aria-hidden','false'); updateScrim();
      }

      function readVideoDimensions(data) {
        return new Promise(resolve => {
          const video=document.createElement('video'); video.preload='metadata'; video.muted=true;
          let settled = false;
          const timeout = window.setTimeout(() => done({width:320,height:180}), 5000);
          const done = size => { if (settled) return; settled = true; window.clearTimeout(timeout); video.removeAttribute('src'); video.load(); resolve(size); };
          video.onloadedmetadata=()=>done({width:video.videoWidth||320,height:video.videoHeight||180});
          video.onerror=()=>done({width:320,height:180});
          video.src=data;
        });
      }

      async function importMediaFile(file, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
        try {
          if (!file || !currentBoard()) return openBoardOverview();
          const targetBoardId = currentBoardId;
          if (textFilePattern.test(file.name)) return importDocumentFile(file, clientX, clientY);
          if (file.type.startsWith('audio/') || file.type.startsWith('video/') || audioFilePattern.test(file.name) || videoFilePattern.test(file.name)) {
            const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            const point = screenToWorld(clientX, clientY); const type = file.type.startsWith('audio/') || audioFilePattern.test(file.name) ? 'audio' : 'video';
            const metadata = type === 'audio' ? await readAudioMetadata(file).catch(()=>({title:file.name.replace(/\.[^.]+$/,''),cover:''})) : null;
            const videoSize = type === 'video' ? await readVideoDimensions(data) : null;
            if (targetBoardId !== currentBoardId) return;
            const width = type === 'audio' ? 180 : Math.min(420, Math.max(220, videoSize.width));
            const height = type === 'audio' ? 180 : Math.round(width * videoSize.height / videoSize.width) + 40;
            const card = { id: nextId++, type, x: point.x-width/2, y: point.y-height/2, width, height, data, name: metadata?.title || file.name, cover: metadata?.cover || '', mime:file.type, groupId: null };
            cards.push(card); renderCard(card); setSelected(card.id); saveState(); return;
          }
          if (!currentBoard()) return openBoardOverview();
          const media = await readMediaFile(file);
          if (targetBoardId !== currentBoardId) return;
          const point = screenToWorld(clientX, clientY);
          const card = { id: nextId++, type: 'image', x: point.x - media.width / 2, y: point.y - media.height / 2, ...media, groupId: null };
          cards.push(card);
          renderCard(card);
          setSelected(card.id);
          saveState();
        } catch (error) {
          window.alert(error.message || 'Gambar tidak dapat diimpor.');
        }
      }

      function createCard(clientX, clientY, initialText = '', openEditor = true) {
        if (!currentBoard()) return openBoardOverview();
        finishEdit(true);
        const point = screenToWorld(clientX, clientY);
        const card = { id: nextId++, x: point.x - 56, y: point.y - 24, text: initialText, color: '#3978f6', textColor: '#ffffff' };
        cards.push(card);
        renderCard(card);
        setSelected(card.id);
        if (openEditor) beginEdit(card.id); else saveState();
      }

      function openColorPicker() {
        if (selectedIds.size !== 1) return;
        if (!window.EyeDropper) { window.alert('Color picker belum tersedia di browser ini.'); return; }
        new EyeDropper().open().then(({sRGBHex})=>{ if(selectedIds.size===1){applyColorToSelection(sRGBHex,'card');rememberColor(sRGBHex);} }).catch(()=>{});
      }

      function sanitizeRichHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        template.content.querySelectorAll('script,style,iframe,object,embed,link,meta,img,svg,video,audio,form,input,button,select,textarea,canvas,template').forEach(node => node.remove());
        const allowed = new Set(['DIV','P','BR','SPAN','B','STRONG','I','EM','U','S','UL','OL','LI','H1','H2','H3','BLOCKQUOTE','PRE','CODE']);
        template.content.querySelectorAll('*').forEach(node => {
          if (!allowed.has(node.tagName)) node.replaceWith(...node.childNodes);
        });
        template.content.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attribute => {
          if (!['style'].includes(attribute.name)) node.removeAttribute(attribute.name);
          else { const align = node.style.textAlign; node.removeAttribute('style'); if (['left','center','right'].includes(align)) node.style.textAlign = align; }
        }));
        return template.innerHTML;
      }

      function createPastedTextCard(value, clientX = lastPointer.x, clientY = lastPointer.y, richHtml = '') {
        const textValue = escapeText(value).trim();
        if (!textValue) return;
        finishEdit(true);
        const point = screenToWorld(clientX, clientY);
        const textSize = textValue.length > 700 ? 12 : textValue.length > 300 ? 13 : textValue.length > 120 ? 14 : 16;
        const card = { id: nextId++, kind: 'pasted-text', richText: true, x: point.x - 160, y: point.y - 45, text: textValue, html: '', textSize, color: '#ffffff', textColor: '#20242b', groupId: null };
        const holder = document.createElement('div');
        holder.textContent = textValue;
        card.html = richHtml ? sanitizeRichHtml(richHtml) : holder.innerHTML.replace(/\n/g, '<br>');
        cards.push(card);
        renderCard(card);
        setSelected(card.id);
        saveState();
      }

      function beginEdit(id) {
        if (editingId !== null && editingId !== id) finishEdit(true);
        const el = cardElement(id);
        if (!el) return;
        const targetCard = cards.find(card => card.id === id);
        if (targetCard?.type === 'document') { openDocumentViewer(targetCard); return; }
        if (isMediaCard(targetCard)) return;
        setSelected(id);
        editingId = id;
        el.classList.add('editing');
        const text = el.querySelector('.card-text');
        const card = cards.find(item => item.id === id);
        text.contentEditable = card?.richText ? 'true' : 'plaintext-only';
        if (text.contentEditable !== 'plaintext-only' && !card?.richText) text.contentEditable = 'true';
        text.setAttribute('role', 'textbox');
        text.setAttribute('aria-multiline', 'true');
        text.addEventListener('keydown', handleEditKeydown);
        text.addEventListener('blur', handleEditBlur);
        text.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(text);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (card?.richText) showTextFormatBar(el);
      }

      function insertNewline() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode('\n\u200B');
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      function handleEditKeydown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          event.stopPropagation();
          const editor = event.currentTarget;
          if (editor.isContentEditable) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          } else if (typeof editor.select === 'function') {
            editor.select();
          }
          return;
        }
        if ((event.key === 'Enter' && !event.shiftKey) || ((event.ctrlKey || event.metaKey) && event.code === 'Space')) {
          event.preventDefault();
          event.stopPropagation();
          finishEdit(true);
        } else if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          insertNewline();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finishEdit(true);
        }
      }

      function handleEditBlur() {
        const blurredId = editingId;
        window.setTimeout(() => {
          if (editingId === blurredId && !pan && !document.activeElement?.closest('.text-format-bar')) finishEdit(true);
        }, 0);
      }

      function finishEdit(save) {
        if (editingId === null) return;
        const id = editingId;
        const el = cardElement(id);
        editingId = null;
        if (!el) return;
        const textEl = el.querySelector('.card-text');
        textEl.removeEventListener('keydown', handleEditKeydown);
        textEl.removeEventListener('blur', handleEditBlur);
        textEl.contentEditable = 'false';
        textEl.removeAttribute('role');
        textEl.removeAttribute('aria-multiline');
        el.classList.remove('editing');
        hideTextFormatBar();

        if (save) {
          const card = cards.find(item => item.id === id);
          const value = escapeText(textEl.innerText).replace(/\u200B/g, '').replace(/\n{3,}/g, '\n\n').trim();
          if (!value) {
            cards = cards.filter(item => item.id !== id);
            el.remove();
            selectedIds.delete(id);
          } else {
            card.text = value;
            if (card.richText) {
              card.html = sanitizeRichHtml(textEl.innerHTML);
              textEl.innerHTML = card.html;
            } else textEl.textContent = value;
          }
          updateCamera();
          saveState();
        }
      }

      function showTextFormatBar(cardEl) {
        const rect = cardEl.getBoundingClientRect();
        textFormatBar.classList.add('open');
        const bar = textFormatBar.getBoundingClientRect();
        textFormatBar.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - bar.width / 2, window.innerWidth - bar.width - 8))}px`;
        textFormatBar.style.top = `${Math.max(58, rect.top - bar.height - 8)}px`;
      }

      function hideTextFormatBar() {
        textFormatBar.classList.remove('open');
      }


      function switchCardTextMode(mode) {
        if (selectedIds.size !== 1) return;
        const id = [...selectedIds][0];
        const card = cards.find(item => item.id === id);
        if (!card || isMediaCard(card)) return;
        const element = cardElement(id)?.querySelector('.card-text');
        const plain = element?.innerText ?? card.text ?? '';
        if (mode === 'rich' && !card.richText) {
          const holder = document.createElement('div'); holder.textContent = plain;
          card.richText = true; card.kind = 'pasted-text'; card.html = holder.innerHTML.replace(/\n/g, '<br>');
          card.text = plain; card.textSize = card.textSize || 15; card.color = '#ffffff'; card.textColor = '#20242b';
        } else if (mode === 'plain' && card.richText) {
          card.richText = false; card.html = ''; card.text = plain; delete card.kind; delete card.textSize;
          card.color = '#3978f6'; card.textColor = '#ffffff';
        } else return;
        cardElement(id)?.remove(); renderCard(card); setSelected(id); saveState();
      }

      function applyTextFormat(command) {
        if (editingId === null) return;
        const card = cards.find(item => item.id === editingId);
        if (!card?.richText) return;
        if (command === 'larger' || command === 'smaller') {
          card.textSize = Math.max(9, Math.min(36, Number(card.textSize || 15) + (command === 'larger' ? 1 : -1)));
          const el = cardElement(card.id);
          el?.style.setProperty('--text-size', `${card.textSize}px`);
        } else document.execCommand(command, false, null);
        card.html = sanitizeRichHtml(cardElement(card.id)?.querySelector('.card-text')?.innerHTML || '');
        dirty = true;
        showTextFormatBar(cardElement(card.id));
      }

      function createDragGhosts() {
        if (!drag || drag.ghosts.length) return;
        drag.ghosts = drag.items.map(item => {
          const source = cardElement(item.card.id);
          const ghost = source.cloneNode(true);
          ghost.removeAttribute('data-id');
          ghost.removeAttribute('aria-label');
          ghost.classList.remove('selected', 'multi-selected', 'dragging', 'editing');
          ghost.classList.add('drag-ghost');
          ghost.style.zIndex = '-1';
          positionCard(ghost, { ...item.card, x: item.x, y: item.y });
          world.appendChild(ghost);
          return ghost;
        });
      }

      function removeDragGhosts(targetDrag = drag) {
        targetDrag?.ghosts?.forEach(ghost => ghost.remove());
        if (targetDrag) targetDrag.ghosts = [];
      }

      function convertActiveDragToDuplicate(event) {
        if (!drag?.moved) return false;
        event?.preventDefault();
        event?.stopPropagation();
        const activeDrag = drag;
        const sourceIds = new Set(activeDrag.items.map(item => item.card.id));
        const idMap = new Map();
        const groupMap = new Map();
        const added = activeDrag.items.map(item => {
          const destination = { x: item.card.x, y: item.card.y };
          item.card.x = item.x;
          item.card.y = item.y;
          positionCard(cardElement(item.card.id), item.card);
          cardElement(item.card.id)?.classList.remove('dragging');
          if (item.card.groupId && !groupMap.has(item.card.groupId)) groupMap.set(item.card.groupId, makeId('group'));
          const card = { ...item.card, id: nextId++, x: destination.x, y: destination.y, groupId: item.card.groupId ? groupMap.get(item.card.groupId) : null };
          idMap.set(item.card.id, card.id);
          cards.push(card);
          renderCard(card);
          return card;
        });
        connections.filter(item => sourceIds.has(item.from) && sourceIds.has(item.to)).forEach(source => {
          connections.push({ ...source, id: makeId('connection'), from: idMap.get(source.from), to: idMap.get(source.to) });
        });
        removeDragGhosts(activeDrag);
        window.removeEventListener('pointermove', moveDrag);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
        drag = null;
        selectedIds = new Set(added.map(card => card.id));
        syncSelection();
        renderConnections();
        lastCardAction = { type: 'duplicateMove', dx: activeDrag.lastDx, dy: activeDrag.lastDy };
        suppressNextContextMenu = true;
        window.setTimeout(() => { suppressNextContextMenu = false; }, 500);
        saveState();
        return true;
      }

      function startDrag(event) {
        if (event.target.closest('button, audio, video, input, progress')) return;
        if (activeTool === 'hand') return;
        if (event.button !== 0 || editingId !== null) return;
        const el = event.currentTarget;
        const id = Number(el.dataset.id);
        const card = cards.find(item => item.id === id);
        if (!card) return;
        if (activeTool === 'connector') {
          event.preventDefault();
          handleConnection(id);
          return;
        }
        const shiftWasSelected = event.shiftKey && selectedIds.has(id);
        if (event.shiftKey) {
          // Shift extends a selection while keeping an already selected card
          // draggable. A plain shift-click still toggles through the click
          // path, while a drag never loses its active item.
          if (!selectedIds.has(id)) setSelected(id, true);
        } else if (!selectedIds.has(id)) {
          setSelected(id);
        }
        const items = cards.filter(item => selectedIds.has(item.id)).map(item => {
          const rect = cardElement(item.id)?.getBoundingClientRect();
          return { card: item, x: item.x, y: item.y, width: (rect?.width || 112) / camera.scale, height: (rect?.height || 56) / camera.scale };
        });
        const movingIds = new Set(items.map(item => item.card.id));
        const snapTargets = cards.filter(item => !movingIds.has(item.id)).map(item => {
          const rect = cardElement(item.id)?.getBoundingClientRect();
          const width = (rect?.width || 112) / camera.scale;
          const height = (rect?.height || 56) / camera.scale;
          return { x: [item.x, item.x + width / 2, item.x + width], y: [item.y, item.y + height / 2, item.y + height] };
        });
        drag = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, items, snapTargets, moved: false, lastDx: 0, lastDy: 0, ghosts: [], axis: null, shiftWasSelected };
        window.addEventListener('pointermove', moveDrag);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
      }

      function applyMagneticSnap(activeDrag, dx, dy, lockX, lockY) {
        if (!snapEnabled) return { dx, dy };
        const left = Math.min(...activeDrag.items.map(item => item.x));
        const right = Math.max(...activeDrag.items.map(item => item.x + item.width));
        const top = Math.min(...activeDrag.items.map(item => item.y));
        const bottom = Math.max(...activeDrag.items.map(item => item.y + item.height));
        const movingX = [left + dx, (left + right) / 2 + dx, right + dx];
        const movingY = [top + dy, (top + bottom) / 2 + dy, bottom + dy];
        const threshold = 20 / camera.scale;
        let bestX = threshold + 1;
        let bestY = threshold + 1;
        if (!lockX) activeDrag.snapTargets.forEach(target => movingX.forEach(anchor => target.x.forEach(value => {
          const delta = value - anchor;
          if (Math.abs(delta) < Math.abs(bestX)) bestX = delta;
        })));
        if (!lockY) activeDrag.snapTargets.forEach(target => movingY.forEach(anchor => target.y.forEach(value => {
          const delta = value - anchor;
          if (Math.abs(delta) < Math.abs(bestY)) bestY = delta;
        })));
        if (!lockX) movingX.forEach(anchor => {
          const delta = Math.round(anchor / 24) * 24 - anchor;
          if (Math.abs(delta) < Math.abs(bestX)) bestX = delta;
        });
        if (!lockY) movingY.forEach(anchor => {
          const delta = Math.round(anchor / 24) * 24 - anchor;
          if (Math.abs(delta) < Math.abs(bestY)) bestY = delta;
        });
        if (Math.abs(bestX) <= threshold) dx += bestX;
        if (Math.abs(bestY) <= threshold) dy += bestY;
        return { dx, dy };
      }

      function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        let dx = (event.clientX - drag.startX) / camera.scale;
        let dy = (event.clientY - drag.startY) / camera.scale;
        let lockX = false;
        let lockY = false;
        if (event.shiftKey) {
          if (!drag.axis && Math.hypot(dx, dy) > 3) drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          if (drag.axis === 'x') { dy = 0; lockY = true; }
          else if (drag.axis === 'y') { dx = 0; lockX = true; }
        } else {
          drag.axis = null;
        }
        ({ dx, dy } = applyMagneticSnap(drag, dx, dy, lockX, lockY));
        if (Math.hypot(dx, dy) > 2) drag.moved = true;
        if (!drag.moved) return;
        createDragGhosts();
        drag.lastDx = dx;
        drag.lastDy = dy;
        drag.items.forEach(item => {
          const el = cardElement(item.card.id);
          item.card.x = item.x + dx;
          item.card.y = item.y + dy;
          el.classList.add('dragging');
          positionCard(el, item.card);
        });
        scheduleMotionRender();
      }

      function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const completedDrag = drag;
        drag.items.forEach(item => cardElement(item.card.id)?.classList.remove('dragging'));
        window.removeEventListener('pointermove', moveDrag);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
        if (completedDrag.moved) {
          lastCardAction = { type: 'move', dx: completedDrag.lastDx, dy: completedDrag.lastDy };
          saveState();
        } else if (completedDrag.shiftWasSelected) {
          setSelected(completedDrag.id, true);
        }
        removeDragGhosts(completedDrag);
        drag = null;
        renderConnections();
        updateMultiSelectionFrame();
      }

      function startPan(event, forced = false) {
        if (!forced && event.button !== 1) return;
        event.preventDefault();
        pan = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y, dx: 0, dy: 0 };
        viewport.style.cursor = 'grabbing';
        window.addEventListener('pointermove', movePan);
        window.addEventListener('pointerup', endPan);
        window.addEventListener('pointercancel', endPan);
      }

      function movePan(event) {
        if (!pan || event.pointerId !== pan.pointerId) return;
        const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
        const latest = samples[samples.length - 1] || event;
        pan.dx = Math.round(latest.clientX - pan.startX);
        pan.dy = Math.round(latest.clientY - pan.startY);
        world.style.transform = `translate(${pan.dx}px, ${pan.dy}px)`;
        multiSelectionFrame.style.transform = `translate(${pan.dx}px, ${pan.dy}px)`;
        updateGridBackground(pan.cameraX + pan.dx, pan.cameraY + pan.dy);
      }

      function endPan(event) {
        if (!pan || event.pointerId !== pan.pointerId) return;
        camera.x = pan.cameraX + pan.dx;
        camera.y = pan.cameraY + pan.dy;
        pan = null;
        world.style.transform = '';
        multiSelectionFrame.style.transform = '';
        updateCamera();
        viewport.style.cursor = activeTool === 'hand' ? 'grab' : activeTool === 'connector' ? 'crosshair' : '';
        window.removeEventListener('pointermove', movePan);
        window.removeEventListener('pointerup', endPan);
        window.removeEventListener('pointercancel', endPan);
      }

      function selectAllCards() {
        selectedIds = new Set(cards.map(card => card.id));
        selectionOrder = cards.map(card => card.id);
        alignmentAnchorId = cards.at(-1)?.id ?? null;
        syncSelection();
      }

      function deleteSelectedCards() {
        if (selectedConnectionId !== null) {
          connections = connections.filter(connection => connection.id !== selectedConnectionId);
          selectedConnectionId = null;
          renderConnections();
          saveState();
          return;
        }
        if (!selectedIds.size) return;
        lastCardAction = { type: 'delete' };
        cards = cards.filter(card => {
          if (!selectedIds.has(card.id)) return true;
          cardElement(card.id)?.remove();
          return false;
        });
        connections = connections.filter(connection => !selectedIds.has(connection.from) && !selectedIds.has(connection.to));
        selectedIds.clear();
        selectionOrder = [];
        alignmentAnchorId = null;
        renderConnections();
        syncSelection();
        saveState();
      }

      function moveSelectedToLayer(position) {
        if (!selectedIds.size) return;
        const active = cards.filter(card => selectedIds.has(card.id));
        const inactive = cards.filter(card => !selectedIds.has(card.id));
        cards = position === 'top' ? [...inactive, ...active] : [...active, ...inactive];
        cards.forEach(card => {
          const el = cardElement(card.id);
          if (el) world.appendChild(el);
        });
        renderConnections();
        lastCardAction = { type: 'layer', position };
        saveState();
      }

      function alignSelected(edge) {
        const active = cards.filter(card => selectedIds.has(card.id));
        if (active.length < 2) return;
        const metrics = active.map(card => {
          const rect = cardElement(card.id).getBoundingClientRect();
          return { card, width: rect.width / camera.scale, height: rect.height / camera.scale };
        });
        const unitMap = new Map();
        metrics.forEach(metric => {
          const key = metric.card.groupId ? `group:${metric.card.groupId}` : `card:${metric.card.id}`;
          if (!unitMap.has(key)) unitMap.set(key, []);
          unitMap.get(key).push(metric);
        });
        const units = [...unitMap.values()].map(items => ({
          items,
          left: Math.min(...items.map(item => item.card.x)),
          top: Math.min(...items.map(item => item.card.y)),
          right: Math.max(...items.map(item => item.card.x + item.width)),
          bottom: Math.max(...items.map(item => item.card.y + item.height))
        }));
        if (units.length < 2) return;
        const anchorUnit = units.find(unit => unit.items.some(item => item.card.id === alignmentAnchorId)) || units.reduce((best, unit) => {
          const layer = Math.max(...unit.items.map(item => cards.indexOf(item.card)));
          return !best || layer > best.layer ? { unit, layer } : best;
        }, null).unit;
        units.forEach(unit => {
          let dx = 0;
          let dy = 0;
          if (edge === 'top') dy = anchorUnit.top - unit.top;
          else if (edge === 'bottom') dy = anchorUnit.bottom - unit.bottom;
          else if (edge === 'left') dx = anchorUnit.left - unit.left;
          else if (edge === 'right') dx = anchorUnit.right - unit.right;
          else if (edge === 'centerX') dx = (anchorUnit.left + anchorUnit.right - unit.left - unit.right) / 2;
          else if (edge === 'centerY') dy = (anchorUnit.top + anchorUnit.bottom - unit.top - unit.bottom) / 2;
          unit.items.forEach(item => { item.card.x += dx; item.card.y += dy; });
        });
        updateCamera();
        lastCardAction = { type: 'align', edge };
        saveState();
      }

      function applyColorToSelection(color, target) {
        const active = cards.filter(card => selectedIds.has(card.id) && !isMediaCard(card) && card.type !== 'document');
        if (!active.length) return;
        rememberColor(color);
        const normalized = color === 'transparent' && target === 'card' ? 'transparent' : normalizeColor(color, target === 'text' ? '#ffffff' : '#3978f6');
        active.forEach(card => {
          if (target === 'text') card.textColor = normalized;
          else card.color = normalized;
          const el = cardElement(card.id);
          if (el) applyCardStyle(el, card);
        });
        lastCardAction = { type: 'color', target, color: normalized };
        saveState();
      }

      function copySelectedCards(writeSystemClipboard = true) {
        const active = cards.filter(card => selectedIds.has(card.id));
        if (!active.length) return false;
        const metrics=active.map(card=>{const rect=cardElement(card.id)?.getBoundingClientRect();return {card,width:rect?rect.width/camera.scale:(card.width||112),height:rect?rect.height/camera.scale:(card.height||48)};});
        const bounds={left:Math.min(...metrics.map(x=>x.card.x)),top:Math.min(...metrics.map(x=>x.card.y)),right:Math.max(...metrics.map(x=>x.card.x+x.width)),bottom:Math.max(...metrics.map(x=>x.card.y+x.height))};
        clipboardData = {
          cards: active.map(card => ({ ...card, sourceId: card.id })),
          connections: connections.filter(item => selectedIds.has(item.from) && selectedIds.has(item.to)).map(item => ({ ...item })), bounds
        };
        if(writeSystemClipboard){internalClipboardToken=makeId('clipboard');preparingInternalCopy=true;document.execCommand('copy');preparingInternalCopy=false;}
        return true;
      }

      function pasteCards() {
        if (!clipboardData || !clipboardData.cards.length) return;
        const point=screenToWorld(lastPointer.x,lastPointer.y), bounds=clipboardData.bounds || {left:0,top:0,right:0,bottom:0};
        const offsetX=point.x-(bounds.left+bounds.right)/2, offsetY=point.y-(bounds.top+bounds.bottom)/2;
        const idMap = new Map();
        const groupMap = new Map();
        const added = clipboardData.cards.map(source => {
          const id = nextId++;
          idMap.set(source.sourceId, id);
          if (source.groupId && !groupMap.has(source.groupId)) groupMap.set(source.groupId, makeId('group'));
          return { ...source, id, x: source.x + offsetX, y: source.y + offsetY, groupId: source.groupId ? groupMap.get(source.groupId) : null };
        });
        added.forEach(card => { cards.push(card); renderCard(card); });
        clipboardData.connections.forEach(source => {
          const from = idMap.get(source.from);
          const to = idMap.get(source.to);
          if (from && to) connections.push({ ...source, id: makeId('connection'), from, to });
        });
        selectedIds = new Set(added.map(card => card.id));
        syncSelection();
        renderConnections();
        saveState();
        lastCardAction = { type: 'paste' };
      }

      async function pasteFromClipboard() {
        try {
          if (!navigator.clipboard?.read) return pasteCards();
          if (!window.confirm('Browser akan meminta izin membaca clipboard. Lanjutkan paste?')) return;
          const items=await navigator.clipboard.read();
          for(const item of items){
            if(item.types.includes('text/html')){const html=await (await item.getType('text/html')).text();if(clipboardData?.cards?.length&&html.includes(`whiteboard:${internalClipboardToken}`))return pasteCards();}
            const imageType=item.types.find(type=>type.startsWith('image/'));if(imageType){const blob=await item.getType(imageType);return importMediaFile(new File([blob],`clipboard.${imageType.split('/')[1]||'png'}`,{type:imageType}),lastPointer.x,lastPointer.y);}
            if(item.types.includes('text/plain')){const text=(await (await item.getType('text/plain')).text()).trim();if(text)return createPastedTextCard(text,lastPointer.x,lastPointer.y,'');}
          }
          pasteCards();
        } catch { pasteCards(); }
      }

      function cutSelectedCards() {
        if (copySelectedCards()) deleteSelectedCards();
      }

      function duplicateSelectedCards() {
        if (!selectedIds.size) return;
        duplicateSelectionAtOffset(24, 24);
        lastCardAction = { type: 'duplicateMove', dx: 24, dy: 24 };
      }

      function duplicateSelectionAtOffset(dx, dy) {
        const sourceCards = cards.filter(card => selectedIds.has(card.id));
        if (!sourceCards.length) return;
        const sourceIds = new Set(sourceCards.map(card => card.id));
        const idMap = new Map();
        const groupMap = new Map();
        const added = sourceCards.map(source => {
          if (source.groupId && !groupMap.has(source.groupId)) groupMap.set(source.groupId, makeId('group'));
          const card = { ...source, id: nextId++, x: source.x + dx, y: source.y + dy, groupId: source.groupId ? groupMap.get(source.groupId) : null };
          idMap.set(source.id, card.id);
          cards.push(card);
          renderCard(card);
          return card;
        });
        connections.filter(item => sourceIds.has(item.from) && sourceIds.has(item.to)).forEach(source => {
          connections.push({ ...source, id: makeId('connection'), from: idMap.get(source.from), to: idMap.get(source.to) });
        });
        selectedIds = new Set(added.map(card => card.id));
        syncSelection();
        renderConnections();
        saveState();
      }

      function moveSelectionBy(dx, dy) {
        const active = cards.filter(card => selectedIds.has(card.id));
        if (!active.length) return;
        active.forEach(card => { card.x += dx; card.y += dy; });
        updateCamera();
        saveState();
      }

      function repeatLastCardAction() {
        if (!lastCardAction) return;
        const action = { ...lastCardAction };
        if (action.type === 'move') moveSelectionBy(action.dx, action.dy);
        else if (action.type === 'duplicateMove') {
          duplicateSelectionAtOffset(action.dx, action.dy);
        } else if (action.type === 'duplicate') duplicateSelectedCards();
        else if (action.type === 'paste') pasteCards();
        else if (action.type === 'color') applyColorToSelection(action.color, action.target);
        else if (action.type === 'align') alignSelected(action.edge);
        else if (action.type === 'layer') moveSelectedToLayer(action.position);
        else if (action.type === 'delete') deleteSelectedCards();
        lastCardAction = action;
      }

      function updateBoardControls() {
        renderBoardTabs();
        const active = currentBoard();
        const selectedValue = boardSelect.value;
        boardSelect.replaceChildren();
        boards.forEach(board => {
          const option = document.createElement('option');
          option.value = board.id;
          option.textContent = board.name;
          boardSelect.appendChild(option);
        });
        boardSelect.value = active ? active.id : selectedValue;
        if (document.activeElement !== boardName) boardName.value = active?.name || '';
        activeBoardTitle.textContent = active ? `${active.name}${dirty ? ' • belum disimpan' : ''}` : 'Tanpa board';
      }

      function switchBoard(id) {
        if (id === currentBoardId || !boards.some(board => board.id === id)) return;
        if (dirty) {
          if (!window.confirm('Perubahan board aktif belum disimpan dan akan hilang. Tetap beralih?')) return false;
          discardCurrentDraft();
          if (!boards.some(board => board.id === id)) return false;
        }
        finishEdit(true);
        syncCurrentBoard();
        boardHistories.set(currentBoardId,{undo:[...undoStack],redo:[...redoStack]});
        currentBoardId = id;
        closedBoardIds.delete(id);
        loadCurrentBoard();
        const history=boardHistories.get(id);
        undoStack = history?.undo || [];
        redoStack = history?.redo || [];
        lastCardAction=null;
        dirty = false;
        lastSnapshot = serializeHistoryState();
        renderAll();
        document.body.classList.remove('home-mode');
        return true;
      }

      function addBoard(name) {
        if (dirty) {
          if (!window.confirm('Perubahan board aktif belum disimpan dan akan hilang. Buat board baru?')) return null;
          discardCurrentDraft();
        }
        finishEdit(true);
        syncCurrentBoard();
        boardHistories.set(currentBoardId,{undo:[...undoStack],redo:[...redoStack]});
        const board = createBoard(Core.uniqueBoardName(boards, name || `Unnamed board ${boards.length + 1}`));
        boards.push(board);
        currentBoardId = board.id;
        loadCurrentBoard();
        undoStack = [];
        redoStack = [];
        lastSnapshot = serializeHistoryState();
        dirty = true;
        saveState(false);
        renderAll();
        document.body.classList.remove('home-mode');
        return board;
      }

      function nextUnnamedBoardName() {
        let index = 1;
        const names = new Set(boards.map(board => board.name));
        while (names.has(`Unnamed board ${index}`)) index += 1;
        return `Unnamed board ${index}`;
      }

      function requestNewBoard() {
        newBoardName.value = nextUnnamedBoardName();
        newBoardModal.classList.add('open');
        newBoardModal.setAttribute('aria-hidden', 'false');
        updateScrim();
        requestAnimationFrame(() => { newBoardName.focus(); newBoardName.select(); });
      }

      function closeNewBoardDialog() {
        newBoardModal.classList.remove('open');
        newBoardModal.setAttribute('aria-hidden', 'true');
        updateScrim();
      }

      function confirmNewBoardCreation() {
        const board = addBoard(newBoardName.value.trim() || nextUnnamedBoardName());
        if (!board) return;
        closeNewBoardDialog();
        closeBoardOverview(true);
      }

      function discardCurrentDraft() {
        if (!currentBoardId || !persistedStateSnapshot) return;
        try {
          const state = JSON.parse(persistedStateSnapshot);
          const stored = state.boards?.find(board => board.id === currentBoardId);
          const index = boards.findIndex(board => board.id === currentBoardId);
          if (stored && index >= 0) boards[index] = stored;
          else if (!stored && index >= 0) boards.splice(index, 1);
          dirty = false;
          loadCurrentBoard();
          lastSnapshot = serializeHistoryState();
        } catch (_) {}
      }

      function renameCurrentBoard() {
        const board = currentBoard();
        if (!board) return;
        const value = boardName.value.trim();
        if (!value || value === board.name) {
          boardName.value = board.name;
          return;
        }
        board.name = value;
        dirty = true;
        updateBoardControls();
      }

      function promptRenameCurrentBoard() {
        const board = currentBoard();
        if (!board) return;
        const value = window.prompt('Nama board', board.name);
        if (!value?.trim()) return;
        boardName.value = value.trim();
        renameCurrentBoard();
      }

      function exportCurrentBoard(requestedName) {
        syncCurrentBoard();
        const board = currentBoard();
        if (!board) return;
        exportBoardData(board, requestedName);
      }

      function exportBoardData(board, requestedName) {
        const payload = JSON.stringify({ type: 'whiteboard-board', version: 1, board }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = String(requestedName || board.name).replace(/\.json$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'board';
        link.download = `${safeName}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }

      function exportBoardPdf(board, requestedName) {
        const items = board.cards || [];
        if (!items.length) return window.alert('Board kosong belum memiliki konten untuk diekspor ke PDF.');
        const padding = 48;
        const minX = Math.min(...items.map(card => Number(card.x) || 0));
        const minY = Math.min(...items.map(card => Number(card.y) || 0));
        const maxX = Math.max(...items.map(card => (Number(card.x) || 0) + (Number(card.width) || 120) * (Number(card.scale) || 1)));
        const maxY = Math.max(...items.map(card => (Number(card.y) || 0) + (Number(card.height) || 50) * (Number(card.scale) || 1)));
        const width = Math.ceil(maxX - minX + padding * 2), height = Math.ceil(maxY - minY + padding * 2);
        const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
        const cardsHtml = items.map(card => {
          const scale = Number(card.scale) || 1, x = (Number(card.x)||0)-minX+padding, y=(Number(card.y)||0)-minY+padding;
          const w=(Number(card.width)||120)*scale, h=(Number(card.height)||50)*scale;
          if (card.type === 'image' || card.type === 'svg') return `<div class="pdf-card media" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><img src="${esc(card.data)}"></div>`;
          if (card.type) return `<div class="pdf-card file" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${esc(card.name || card.type)}</div>`;
          return `<div class="pdf-card" style="left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:${card.color==='transparent'?'transparent':esc(card.color||'#3978f6')};color:${esc(card.textColor||'#fff')};font-size:${Math.max(7,12*scale)}px">${card.richText ? sanitizeRichHtml(card.html||'') : esc(card.text).replace(/\n/g,'<br>')}</div>`;
        }).join('');
        const lines = (board.connections || []).map(line => { const a=items.find(card=>card.id===line.from), b=items.find(card=>card.id===line.to); if(!a||!b)return ''; const ax=(a.x-minX+padding)+(a.width||120)*(a.scale||1)/2, ay=(a.y-minY+padding)+(a.height||50)*(a.scale||1)/2, bx=(b.x-minX+padding)+(b.width||120)*(b.scale||1)/2, by=(b.y-minY+padding)+(b.height||50)*(b.scale||1)/2; return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><text x="${(ax+bx)/2}" y="${(ay+by)/2-5}">${esc(line.label||'')}</text>`; }).join('');
        const printWindow = window.open('', '_blank');
        if (!printWindow) return window.alert('Izinkan pop-up untuk mengekspor PDF.');
        printWindow.opener = null;
        printWindow.document.write(`<!doctype html><html><head><title>${esc(requestedName||board.name)}</title><style>@page{size:${width}px ${height}px;margin:0}*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:Arial,sans-serif}.sheet{position:relative;width:100%;height:100%;background:#fff}.links{position:absolute;inset:0;width:100%;height:100%}.links line{stroke:#76a4ff;stroke-width:2}.links text{fill:#245dc9;font-size:10px;text-anchor:middle}.pdf-card{position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;padding:10px;border:1px solid rgba(255,255,255,.8);border-radius:6px;text-align:center;overflow:hidden;box-shadow:0 2px 7px rgba(30,41,59,.12)}.media{padding:0;background:#fff}.media img{width:100%;height:100%;object-fit:contain}.file{background:#f1f5f9;color:#334155}</style></head><body><main class="sheet"><svg class="links">${lines}</svg>${cardsHtml}</main><script>onload=()=>setTimeout(()=>print(),250)<\/script></body></html>`);
        printWindow.document.close();
      }

      function normalizeImportedBoard(source, startId) {
        if (!source || !Array.isArray(source.cards)) throw new Error('Format board tidak valid');
        let idCursor = startId;
        const importedIdMap = new Map();
        const importedGroupMap = new Map();
        const importedCards = source.cards.filter(card => Number.isFinite(card.x) && Number.isFinite(card.y)).map(card => {
          const id = idCursor++;
          importedIdMap.set(Number(card.id), id);
          if (card.groupId && !importedGroupMap.has(card.groupId)) importedGroupMap.set(card.groupId, makeId('group'));
          const groupId = card.groupId ? importedGroupMap.get(card.groupId) : null;
          const scale = Math.max(.04, Number(card.scale) || 1);
          if (['image','audio','video','svg'].includes(card.type) && typeof card.data === 'string') return { id, type: card.type, x: card.x, y: card.y, width: Number(card.width) || 240, height: Number(card.height) || 160, data: card.data, name: String(card.name || 'Media'), cover: typeof card.cover==='string'?card.cover:'', mime:String(card.mime||''), groupId, scale };
          if (card.type === 'document') return { id, type:'document', x:card.x, y:card.y, width:108, height:92, name:String(card.name||'Dokumen'), mime:String(card.mime||'text/plain'), content:String(card.content||''), groupId, scale };
          return { id, x: card.x, y: card.y, text: escapeText(card.text), html: card.richText ? sanitizeRichHtml(card.html || '') : '', richText: Boolean(card.richText), kind: card.kind === 'pasted-text' ? 'pasted-text' : undefined, textSize: Number(card.textSize) || undefined, color: normalizeColor(card.color, '#3978f6'), textColor: normalizeColor(card.textColor, '#ffffff'), groupId, scale };
        });
        const importedConnections = Array.isArray(source.connections) ? source.connections.filter(item => importedIdMap.has(Number(item.from)) && importedIdMap.has(Number(item.to))).map(item => ({ id: makeId('connection'), from: importedIdMap.get(Number(item.from)), to: importedIdMap.get(Number(item.to)), label: String(item.label || '') })) : [];
        return { cards: importedCards, connections: importedConnections, nextId: idCursor };
      }

      async function importBoardFile(file, mode = importMode) {
        if (!file) return;
        try {
          if (mode === 'board-list' && dirty) {
            if (!window.confirm('Perubahan board aktif belum disimpan dan akan hilang. Tetap impor board?')) return;
            discardCurrentDraft();
          }
          if (/^(image|audio|video)\//.test(file.type)) {
            if (mode === 'board-list') {
              let media, type='image';
              if (file.type.startsWith('image/')) media=await readMediaFile(file);
              else { type=file.type.startsWith('audio/')?'audio':'video';const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});media={data,name:file.name,width:320,height:type==='audio'?110:246}; }
              const card = { id: 1, type, x: 0, y: 0, ...media, groupId: null };
              const board = createBoard(file.name.replace(/\.[^.]+$/, '') || 'Board gambar', [card], []);
              boards.push(board); currentBoardId = board.id; loadCurrentBoard(); dirty = true; lastSnapshot = serializeHistoryState(); renderAll(); closeBoardOverview(true); document.body.classList.remove('home-mode');
            } else await importMediaFile(file, lastPointer.x, lastPointer.y);
            return;
          }
          const payload = JSON.parse(await file.text());
          const source = payload?.type === 'whiteboard-board' ? payload.board : payload;
          if (mode === 'board-list') {
            const imported = normalizeImportedBoard(source, 1);
            const board = createBoard(`${source.name || 'Board impor'}`, imported.cards, imported.connections);
            board.camera = source.camera && Number.isFinite(source.camera.scale) ? source.camera : { x: 0, y: 0, scale: 1 };
            boards.push(board); currentBoardId = board.id; loadCurrentBoard(); dirty = true; lastSnapshot = serializeHistoryState(); renderAll(); closeBoardOverview(true); document.body.classList.remove('home-mode');
          } else {
            const imported = normalizeImportedBoard(source, nextId);
            if (!imported.cards.length) throw new Error('Board impor tidak memiliki konten untuk ditambahkan.');
            nextId = imported.nextId;
            const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
            const minX = Math.min(...imported.cards.map(card => card.x));
            const minY = Math.min(...imported.cards.map(card => card.y));
            const dx = center.x - minX - 120;
            const dy = center.y - minY - 80;
            imported.cards.forEach(card => { card.x += dx; card.y += dy; cards.push(card); renderCard(card); });
            connections.push(...imported.connections);
            selectedIds = new Set(imported.cards.map(card => card.id));
            alignmentAnchorId = imported.cards.at(-1)?.id ?? null;
            syncSelection();
            renderConnections();
            saveState();
          }
        } catch (error) {
          window.alert(error.message || 'File tidak dapat diimpor.');
        } finally {
          importMode = 'board-list';
          importFile.value = '';
        }
      }

      function startMarquee(event) {
        if (event.button !== 0) return;
        const base = event.shiftKey ? new Set(selectedIds) : new Set();
        marquee = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, base, moved: false };
        if (!event.shiftKey) setSelected(null);
        window.addEventListener('pointermove', moveMarquee);
        window.addEventListener('pointerup', endMarquee);
        window.addEventListener('pointercancel', endMarquee);
      }

      function moveMarquee(event) {
        if (!marquee || event.pointerId !== marquee.pointerId) return;
        const left = Math.min(marquee.startX, event.clientX);
        const top = Math.min(marquee.startY, event.clientY);
        const right = Math.max(marquee.startX, event.clientX);
        const bottom = Math.max(marquee.startY, event.clientY);
        if (Math.hypot(event.clientX - marquee.startX, event.clientY - marquee.startY) > 3) marquee.moved = true;
        if (!marquee.moved) return;
        Object.assign(selectionBox.style, { display: 'block', left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
        const previousOrder = selectionOrder.filter(id=>selectedIds.has(id));
        selectedIds = new Set(marquee.base);
        cards.forEach(card => {
          const rect = cardElement(card.id).getBoundingClientRect();
          if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) selectedIds.add(card.id);
        });
        expandGroupedSelection();
        selectionOrder = [...new Set([...previousOrder.filter(id=>selectedIds.has(id)),...selectedIds])];
        syncSelection();
      }

      function endMarquee(event) {
        if (!marquee || event.pointerId !== marquee.pointerId) return;
        selectionOrder = [...new Set([...selectionOrder.filter(id=>selectedIds.has(id)),...selectedIds])];
        alignmentAnchorId = [...cards].reverse().find(card => selectedIds.has(card.id))?.id ?? null;
        syncSelection();
        marquee = null;
        selectionBox.style.display = 'none';
        window.removeEventListener('pointermove', moveMarquee);
        window.removeEventListener('pointerup', endMarquee);
        window.removeEventListener('pointercancel', endMarquee);
      }

      function openContextMenu(event) {
        event.preventDefault();
        if (drag?.moved) {
          convertActiveDragToDuplicate(event);
          return;
        }
        if (suppressNextContextMenu) {
          suppressNextContextMenu = false;
          return;
        }
        showContextMenu(event.target, event.clientX, event.clientY);
      }

      function showContextMenu(target, clientX, clientY) {
        const card = target?.closest?.('.card');
        if (card) {
          const id = Number(card.dataset.id);
          if (!selectedIds.has(id)) setSelected(id);
        }
        const selectedCard = card && selectedIds.size === 1 ? cards.find(item => item.id === [...selectedIds][0]) : null;
        const richAction = contextMenu.querySelector('[data-action="to-rich"]');
        const plainAction = contextMenu.querySelector('[data-action="to-plain"]');
        const canSwitch = selectedCard && !isMediaCard(selectedCard) && selectedCard.type !== 'document';
        richAction.style.display = canSwitch && !selectedCard.richText ? '' : 'none';
        plainAction.style.display = canSwitch && selectedCard.richText ? '' : 'none';
        contextMenu.classList.add('open');
        contextMenu.setAttribute('aria-hidden', 'false');
        const rect = contextMenu.getBoundingClientRect();
        const left = Math.min(clientX, window.innerWidth - rect.width - 8);
        const top = Math.min(clientY, window.innerHeight - rect.height - 8);
        contextMenu.style.left = `${Math.max(8, left)}px`;
        contextMenu.style.top = `${Math.max(8, top)}px`;
      }

      function closeContextMenu() {
        contextMenu.classList.remove('open');
        contextMenu.setAttribute('aria-hidden', 'true');
      }

      function runContextAction(action) {
        if (action === 'edit' && selectedIds.size === 1) beginEdit([...selectedIds][0]);
        else if (action === 'to-rich') switchCardTextMode('rich');
        else if (action === 'to-plain') switchCardTextMode('plain');
        else if (action === 'duplicate') duplicateSelectedCards();
        else if (action === 'cut') cutSelectedCards();
        else if (action === 'copy') copySelectedCards();
        else if (action === 'paste') pasteCards();
        else if (action === 'front') moveSelectedToLayer('top');
        else if (action === 'back') moveSelectedToLayer('bottom');
        else if (action === 'select-all') selectAllCards();
        else if (action === 'undo') undo();
        else if (action === 'delete') deleteSelectedCards();
        closeContextMenu();
      }

      function updateScrim() {
        const open = versionModal.classList.contains('open') || exportModal.classList.contains('open') || settingsModal.classList.contains('open') || documentModal.classList.contains('open') || allBoardsModal.classList.contains('open') || newBoardModal.classList.contains('open') || closeBoardWarningModal.classList.contains('open');
        scrim.classList.toggle('open', open);
      }

      function openVersionHistory() {
        versionModal.classList.add('open');
        versionModal.setAttribute('aria-hidden', 'false');
        versionButton.setAttribute('aria-expanded', 'true');
        updateScrim();
        closeVersionModalButton.focus();
      }

      function closeVersionHistory() {
        versionModal.classList.remove('open');
        versionModal.setAttribute('aria-hidden', 'true');
        versionButton.setAttribute('aria-expanded', 'false');
        updateScrim();
      }

      function openExportDialog() {
        const board = currentBoard();
        if (!board) return;
        exportName.value = board.name;
        exportModal.classList.add('open');
        exportModal.setAttribute('aria-hidden', 'false');
        updateScrim();
        exportName.focus();
        exportName.select();
      }

      function closeExportDialog() {
        exportModal.classList.remove('open');
        exportModal.setAttribute('aria-hidden', 'true');
        updateScrim();
      }

      function renderBoardOverview() {
        boardOverviewGrid.replaceChildren();
        const newCard = document.createElement('button');
        newCard.type = 'button';
        newCard.className = 'board-card board-new-card';
        newCard.append(lucideIcon('plus'));
        const newLabel = document.createElement('strong');
        newLabel.textContent = 'New board';
        newCard.append(newLabel);
        newCard.addEventListener('click', requestNewBoard);
        boardOverviewGrid.appendChild(newCard);
        const ordered = recentIds.map(id => boards.find(board => board.id === id)).filter(board => board?.savedAt).slice(0, 7);
        ordered.forEach(board => {
          const card = document.createElement('article');
          card.tabIndex = 0;
          card.dataset.boardId = board.id;
          card.className = 'board-card';
          card.innerHTML = `<div class="board-thumbnail" aria-hidden="true"></div><strong></strong><span></span>`;
          renderBoardThumbnail(card.querySelector('.board-thumbnail'), board);
          card.querySelector('strong').textContent = board.name;
          card.querySelector('span').textContent = `${board.cards?.length || 0} kartu · ${board.connections?.length || 0} garis`;
          const menuButton = document.createElement('button');
          menuButton.type = 'button';
          menuButton.className = 'board-card-menu-button';
          menuButton.setAttribute('aria-label', `Menu ${board.name}`);
          menuButton.append(lucideIcon('more'));
          menuButton.addEventListener('click', event => { event.stopPropagation(); selectOverviewBoard(board.id); openBoardCardMenu(board.id, menuButton); });
          card.append(menuButton);
          card.addEventListener('click', event => { if (!event.target.closest('.board-card-menu-button')) openOverviewBoard(board.id); });
          card.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.target.closest('.board-card-menu-button')) openOverviewBoard(board.id); });
          boardOverviewGrid.appendChild(card);
        });
      }

      function renderBoardThumbnail(preview, board) {
        preview.replaceChildren();
        const boardCards = board.cards || [];
        const minX = boardCards.length ? Math.min(...boardCards.map(item => Number(item.x) || 0)) : 0;
        const minY = boardCards.length ? Math.min(...boardCards.map(item => Number(item.y) || 0)) : 0;
        const maxX = boardCards.length ? Math.max(...boardCards.map(item => (Number(item.x) || 0) + (Number(item.width) || 100) * (Number(item.scale)||1))) : 1;
        const maxY = boardCards.length ? Math.max(...boardCards.map(item => (Number(item.y) || 0) + (Number(item.height) || 50) * (Number(item.scale)||1))) : 1;
        const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
        boardCards.forEach(item => { const mini = document.createElement('i'); mini.className='board-thumbnail-card'; const s=Number(item.scale)||1; mini.style.left=`${4 + ((item.x-minX)/spanX)*92}%`; mini.style.top=`${4 + ((item.y-minY)/spanY)*90}%`; mini.style.width=`${Math.max(1.5, Math.min(92, (((item.width || 96)*s)/spanX)*92))}%`; mini.style.height=`${Math.max(1.5, Math.min(90, (((item.height || 40)*s)/spanY)*90))}%`; mini.style.background=item.type ? '#eef2f7' : (item.color || '#3978f6'); preview.append(mini); });
      }

      function selectOverviewBoard(id) {
        overviewSelectedBoardId = id;
        boardOverviewGrid.querySelectorAll('[data-board-id]').forEach(card => card.classList.toggle('focused', card.dataset.boardId === id));
      }

      function openOverviewBoard(id = overviewSelectedBoardId) {
        if (!boards.some(board => board.id === id)) return;
        closedBoardIds.delete(id);
        if (id !== currentBoardId && switchBoard(id) === false) return;
        renderAll();
        closeAllBoards();
        closeBoardOverview(true);
      }

      function renderAllBoards(selectedId = overviewSelectedBoardId) {
        const savedBoards = boards.filter(board => board.savedAt).sort((a,b) => a.name.localeCompare(b.name, 'id', { sensitivity:'base' }));
        allBoardsList.replaceChildren();
        if (!savedBoards.length) {
          allBoardsList.innerHTML = '<div class="preview-empty">Belum ada board tersimpan.</div>';
          allBoardsPreview.innerHTML = '<div class="preview-empty"><div><p>Simpan board dengan Ctrl+S agar muncul di sini.</p><button id="emptyAllBoardsNew" class="modal-action primary" type="button">Buat board baru</button></div></div>';
          document.getElementById('emptyAllBoardsNew').addEventListener('click', () => { closeAllBoards(true); requestNewBoard(); });
          return;
        }
        savedBoards.forEach(board => {
          const button = document.createElement('button'); button.type='button'; button.className=`all-board-item${selectedId===board.id?' active':''}`; button.textContent=board.name;
          button.addEventListener('click', () => { overviewSelectedBoardId=board.id; renderAllBoards(board.id); });
          button.addEventListener('dblclick', () => openOverviewBoard(board.id));
          allBoardsList.append(button);
        });
        const selected = savedBoards.find(board => board.id === selectedId);
        if (!selected) { allBoardsPreview.innerHTML='<div class="preview-empty">Pilih nama board untuk melihat pratinjau.</div>'; return; }
        allBoardsPreview.innerHTML='<div class="board-thumbnail" aria-hidden="true"></div><h3></h3><p></p><p></p>';
        renderBoardThumbnail(allBoardsPreview.querySelector('.board-thumbnail'), selected);
        allBoardsPreview.querySelector('h3').textContent=selected.name;
        allBoardsPreview.querySelectorAll('p')[0].textContent=`${selected.cards?.length||0} kartu · ${selected.connections?.length||0} garis`;
        allBoardsPreview.querySelectorAll('p')[1].textContent=`Terakhir disimpan ${new Date(selected.savedAt).toLocaleString('id-ID')}`;
      }

      function openAllBoards() {
        overviewSelectedBoardId = null; renderAllBoards();
        allBoardsModal.classList.add('open'); allBoardsModal.setAttribute('aria-hidden','false'); updateScrim();
      }

      function closeAllBoards(force = false) {
        if (!force && !boards.some(board => board.savedAt)) return;
        allBoardsModal.classList.remove('open'); allBoardsModal.setAttribute('aria-hidden','true'); updateScrim();
      }

      function openBoardCardMenu(id, anchor) {
        boardMenuTargetId = id;
        boardCardMenu.classList.add('open');
        boardCardMenu.setAttribute('aria-hidden', 'false');
        const anchorRect = anchor.getBoundingClientRect();
        const menuRect = boardCardMenu.getBoundingClientRect();
        boardCardMenu.style.left = `${Math.max(8, Math.min(anchorRect.right - menuRect.width, window.innerWidth - menuRect.width - 8))}px`;
        boardCardMenu.style.top = `${Math.max(8, Math.min(anchorRect.bottom + 5, window.innerHeight - menuRect.height - 8))}px`;
      }

      function closeBoardCardMenu() {
        boardCardMenu.classList.remove('open');
        boardCardMenu.setAttribute('aria-hidden', 'true');
      }

      async function runBoardCardAction(action) {
        const board = boards.find(item => item.id === boardMenuTargetId);
        if (!board) return closeBoardCardMenu();
        if (action === 'open') openOverviewBoard(board.id);
        else if (action === 'rename') {
          const value = window.prompt('Nama board', board.name);
          if (value?.trim()) {
            const previousName = board.name;
            board.name = Core.uniqueBoardName(boards, value, board.id);
            let storedBoard = board;
            if (dirty && board.id === currentBoardId) {
              try {
                const snapshot = JSON.parse(persistedStateSnapshot || '{}');
                const previous = snapshot.boards?.find(item => item.id === board.id);
                if (previous) storedBoard = { ...previous, name: board.name };
              } catch (_) {}
            }
            if (!await persistBoardCollection({ upsert: storedBoard })) board.name = previousName;
            renderBoardOverview(); updateBoardControls();
          }
        } else if (action === 'duplicate') {
          const copy = typeof structuredClone === 'function' ? structuredClone(board) : JSON.parse(JSON.stringify(board));
          copy.id = makeId('board');
          copy.name = Core.uniqueBoardName(boards, `${board.name} salinan`);
          copy.savedAt = Date.now();
          boards.push(copy);
          recentIds = Core.recentAfterSave(recentIds, copy.id, new Set(boards.filter(item => item.savedAt).map(item => item.id)));
          overviewSelectedBoardId = copy.id;
          if (!await persistBoardCollection({ upsert: copy })) {
            boards = boards.filter(item => item.id !== copy.id);
            recentIds = recentIds.filter(id => id !== copy.id);
          } else showSaveToast('Salinan board tersimpan');
          renderBoardOverview();
        } else if (action === 'export') exportBoardData(board, board.name);
        else if (action === 'delete') await deleteOverviewBoard(board.id);
        closeBoardCardMenu();
      }

      async function persistBoardCollection({ upsert = null, removeId = null } = {}) {
        syncCurrentBoard();
        try {
          if (removeId) await Store.deleteBoard(removeId, storageMeta());
          else if (upsert) await Store.saveBoard(Core.clone(upsert), storageMeta());
          else await Store.saveMeta(storageMeta());
          updatePersistedSnapshot(upsert, removeId);
          return true;
        } catch (error) {
          console.warn('Perubahan pustaka board gagal disimpan', error);
          window.alert('Perubahan belum dapat disimpan ke penyimpanan browser.');
          return false;
        }
      }

      async function deleteOverviewBoard(requestedId = overviewSelectedBoardId) {
        const board = boards.find(item => item.id === requestedId);
        if (!board) return;
        if (!window.confirm(`Hapus board tersimpan “${board.name}” beserta seluruh isinya? Tindakan ini tidak dapat dibatalkan.`)) return;
        const previousBoards = [...boards];
        const previousRecent = [...recentIds];
        const previousCurrentId = currentBoardId;
        const deletingActive = currentBoardId === board.id;
        boards = boards.filter(item => item.id !== board.id);
        recentIds = recentIds.filter(id => id !== board.id);
        closedBoardIds.delete(board.id);
        if (deletingActive) currentBoardId = null;
        overviewSelectedBoardId = currentBoardId;
        if (deletingActive) { loadCurrentBoard(); dirty = false; }
        if (!await persistBoardCollection({ removeId: board.id })) {
          boards = previousBoards;
          recentIds = previousRecent;
          currentBoardId = previousCurrentId;
          if (deletingActive) loadCurrentBoard();
          return;
        }
        renderAll();
        renderBoardOverview();
        renderAllBoards();
      }

      function openBoardOverview() {
        renderBoardOverview();
        document.body.classList.add('home-mode');
        activeBoardTitle.textContent = 'Recent board';
        ['saveBoard','exportBoard','importBoard','closeBoardMenu','renameBoardMenu','importMedia'].forEach(id => { const element=document.getElementById(id); if(element)element.disabled=true; });
        document.querySelectorAll('.editor-menus .app-menu:not(:first-child) .menu-trigger').forEach(button => button.disabled=true);
        boardOverviewModal.classList.add('open');
        boardOverviewModal.setAttribute('aria-hidden', 'false');
        updateScrim();
        boardOverviewGrid.querySelector('button')?.focus();
      }

      function closeBoardOverview(force = false) {
        if (!currentBoard()) return;
        closeBoardCardMenu();
        boardOverviewModal.classList.remove('open');
        boardOverviewModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('home-mode');
        ['saveBoard','exportBoard','importBoard','closeBoardMenu','renameBoardMenu','importMedia'].forEach(id => { const element=document.getElementById(id); if(element)element.disabled=false; });
        document.querySelectorAll('.editor-menus .app-menu .menu-trigger').forEach(button => button.disabled=false);
        updateScrim();
      }

      function closeCurrentBoardToHome() {
        if (!currentBoard() || document.body.classList.contains('home-mode')) return;
        finishEdit(true);
        const visibleBoards = boards.filter(board => !closedBoardIds.has(board.id));
        const currentIndex = visibleBoards.findIndex(board => board.id === currentBoardId);
        pendingCloseBoardId = currentBoardId;
        pendingNextBoardId = visibleBoards.length > 1 ? visibleBoards[(currentIndex + 1) % visibleBoards.length].id : null;
        const isDraft = !currentBoard()?.savedAt;
        document.getElementById('discardCloseBoard').textContent = isDraft ? 'Hapus draft' : 'Tutup tanpa menyimpan';
        document.getElementById('closeBoardWarningText').textContent = isDraft ? 'Board ini belum pernah disimpan. Simpan sekarang atau hapus draft sebelum membuka board berikutnya.' : 'Secara default perubahan akan disimpan, lalu board berikutnya dibuka.';
        closeBoardWarningModal.classList.add('open');
        closeBoardWarningModal.setAttribute('aria-hidden','false');
        updateScrim();
        document.getElementById('saveCloseBoard').focus();
      }

      function cancelCloseBoardWarning() { closeBoardWarningModal.classList.remove('open'); closeBoardWarningModal.setAttribute('aria-hidden','true'); updateScrim(); }

      function completeBoardClose() {
        const closingId = pendingCloseBoardId;
        if (boards.some(board => board.id === closingId)) closedBoardIds.add(closingId);
        closeBoardWarningModal.classList.remove('open'); closeBoardWarningModal.setAttribute('aria-hidden','true');
        pendingCloseBoardId = null;
        const nextId = pendingNextBoardId && boards.some(board => board.id === pendingNextBoardId) ? pendingNextBoardId : boards.find(board => !closedBoardIds.has(board.id))?.id;
        pendingNextBoardId = null;
        if (nextId) {
          currentBoardId = nextId; closedBoardIds.delete(nextId); loadCurrentBoard(); dirty=false; undoStack=[]; redoStack=[]; lastSnapshot=serializeHistoryState(); renderAll(); document.body.classList.remove('home-mode'); updateScrim();
        } else {
          renderAll(); openBoardOverview(); updateScrim();
        }
      }

      function discardAndCloseBoard() { if (dirty) discardCurrentDraft(); completeBoardClose(); }

      async function saveAndCloseBoard() { if (await saveBoardNow()) completeBoardClose(); }

      function openSettings() {
        settingsModal.classList.add('open');
        settingsModal.setAttribute('aria-hidden', 'false');
        updateScrim();
        closeSettingsButton.focus();
      }

      function closeSettings() {
        settingsModal.classList.remove('open');
        settingsModal.setAttribute('aria-hidden', 'true');
        updateScrim();
      }

      function closeOverlays() {
        closeVersionHistory();
        closeExportDialog();
        closeAllBoards();
        closeNewBoardDialog();
        cancelCloseBoardWarning();
        closeSettings();
        documentModal.classList.remove('open'); documentModal.setAttribute('aria-hidden','true'); updateScrim();
      }

      viewport.addEventListener('dblclick', event => {
        if (activeTool !== 'cursor') return;
        if (event.target.closest('.card')) return;
        createCard(event.clientX, event.clientY);
      });

      viewport.addEventListener('pointerdown', event => {
        if (event.button === 1) {
          startPan(event);
          return;
        }
        if (!event.target.closest('.card') && event.pointerType === 'touch') {
          finishEdit(true);
          startPan(event, true);
          return;
        }
        if (activeTool === 'hand' && event.button === 0) {
          finishEdit(true);
          startPan(event, true);
          return;
        }
        if (!event.target.closest('.card') && activeTool === 'cursor') {
          finishEdit(true);
          startMarquee(event);
        }
      });

      viewport.addEventListener('auxclick', event => {
        if (event.button === 1) event.preventDefault();
      });

      viewport.addEventListener('contextmenu', openContextMenu);

      viewport.addEventListener('wheel', event => {
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.0014);
        zoomAt(event.clientX, event.clientY, factor);
      }, { passive: false });

      document.addEventListener('keydown', event => {
        const nativeZoomKey = (event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key);
        if (nativeZoomKey) event.preventDefault();
        const formFocused = event.target.matches?.('input, select, textarea, [contenteditable="true"]');
        const overlayOpen = versionModal.classList.contains('open') || exportModal.classList.contains('open') || boardOverviewModal.classList.contains('open') || allBoardsModal.classList.contains('open') || newBoardModal.classList.contains('open') || closeBoardWarningModal.classList.contains('open') || settingsModal.classList.contains('open') || documentModal.classList.contains('open');
        const shortcutsEnabled = Boolean(currentBoard()) && editingId === null && !overlayOpen && !formFocused;
        const command = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (!command && event.shiftKey && key === 'w' && !formFocused && editingId === null) { event.preventDefault(); if (!overlayOpen && currentBoard() && !document.body.classList.contains('home-mode')) closeCurrentBoardToHome(); return; }
        if (!command && event.shiftKey && key === 'r') { event.preventDefault(); if (!overlayOpen && !formFocused) openBoardOverview(); return; }
        if (!formFocused && command && ['n','o','s','e','i','z','y','d','g','u','x','c','a'].includes(key)) event.preventDefault();
        if (command && event.shiftKey && key === 'o') { event.preventDefault(); if(!formFocused){importMode='board-list';importFile.click();} return; }
        if (shortcutsEnabled && command && !event.shiftKey && (event.key==='+' || event.key==='=')) { event.preventDefault(); zoomFromPointer('in'); return; }
        if (shortcutsEnabled && command && !event.shiftKey && event.key==='-') { event.preventDefault(); zoomFromPointer('out'); return; }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'a') { event.preventDefault(); selectAllCards(); return; }
        if (shortcutsEnabled && command && event.shiftKey && key === 'a') { event.preventDefault(); fitAllCards(); return; }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'g') { event.preventDefault(); groupSelectedCards(); return; }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'u') { event.preventDefault(); ungroupSelectedCards(); return; }
        if (shortcutsEnabled && command && event.shiftKey && key === 'e') {
          event.preventDefault();
          openColorPicker();
          return;
        }
        if (shortcutsEnabled && event.shiftKey && !command && !event.altKey && key === 'l') { event.preventDefault(); if (!event.repeat) toggleSelectionLinks(); return; }
        if (shortcutsEnabled && command && event.altKey && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const index = boards.findIndex(b => b.id === currentBoardId); switchBoard(boards[(index + (event.key === 'ArrowRight' ? 1 : boards.length - 1)) % boards.length].id); return; }
        if (command && !event.shiftKey && key === 's' && !document.body.classList.contains('home-mode')) {
          event.preventDefault();
          saveBoardNow();
          return;
        }
        if (allBoardsModal.classList.contains('open') && event.key === 'Delete') {
          event.preventDefault();
          deleteOverviewBoard();
          return;
        }
        if (command && !event.shiftKey && key === 'o') {
          event.preventDefault();
          if (!formFocused && editingId === null) openAllBoards();
        }
        if (!formFocused && editingId === null && command && !event.shiftKey && key === 'n') {
          event.preventDefault();
          requestNewBoard();
          return;
        }
        if (shortcutsEnabled && event.shiftKey && !command && key === 'p') {
          event.preventDefault();
          fitAllCards();
        }
        if (command && !event.shiftKey && key === 'r') {
          event.preventDefault();
          if (shortcutsEnabled) repeatLastCardAction();
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'e') {
          event.preventDefault();
          openExportDialog();
        }
        if (command && !event.shiftKey && key === 'i' && !formFocused && editingId === null) {
          event.preventDefault();
          importMode = 'board-list';
          importFile.click();
        }
        if (shortcutsEnabled && event.code === 'Space' && !event.repeat) {
          event.preventDefault();
          setActiveTool(activeTool === 'cursor' ? 'connector' : 'cursor');
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'z') {
          event.preventDefault();
          undo();
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'y') {
          event.preventDefault();
          redo();
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'c') {
          event.preventDefault();
          copySelectedCards();
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'x') {
          event.preventDefault();
          cutSelectedCards();
        }
        if (shortcutsEnabled && command && !event.shiftKey && key === 'd') {
          event.preventDefault();
          duplicateSelectedCards();
        }
        if (shortcutsEnabled && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowUp') {
          event.preventDefault();
          moveSelectedToLayer('top');
        }
        if (shortcutsEnabled && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowDown') {
          event.preventDefault();
          moveSelectedToLayer('bottom');
        }
        if (shortcutsEnabled && event.key === 'Delete') {
          event.preventDefault();
          deleteSelectedCards();
        }
        if (shortcutsEnabled && event.key === 'Enter' && selectedIds.size === 1) {
          event.preventDefault();
          beginEdit([...selectedIds][0]);
        }
        if (shortcutsEnabled && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          const alignments = { t: 'top', b: 'bottom', l: 'left', r: 'right', c: 'centerX', e: 'centerY' };
          const edge = alignments[event.key.toLowerCase()];
          if (edge) {
            event.preventDefault();
            alignSelected(edge);
          }
        }
        if (event.key === 'Escape') {
          pendingConnectionId = null;
          selectedConnectionId = null;
          syncSelection();
          renderConnections();
          closeContextMenu();
          closeOverlays();
        }
      });
      document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
      document.addEventListener('gesturechange', event => event.preventDefault(), { passive: false });
      document.addEventListener('pointermove', event => { if (viewport.contains(event.target)) lastPointer = { x: event.clientX, y: event.clientY }; }, { passive: true });
      document.addEventListener('copy', event => {
        if (!preparingInternalCopy || !clipboardData?.cards?.length) return;
        const plain=clipboardData.cards.map(card=>card.text||card.name||card.type||'Kartu').join('\n');
        event.clipboardData.setData('text/plain',plain);
        event.clipboardData.setData('text/html',`<!--whiteboard:${internalClipboardToken}--><span>${plain.replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]))}</span>`);
        try{event.clipboardData.setData('application/x-whiteboard-cards',internalClipboardToken);}catch{}
        event.preventDefault();
      });
      document.addEventListener('paste', event => {
        if (editingId !== null || event.target.matches?.('input, textarea, [contenteditable="true"]')) return;
        const fileItem = [...(event.clipboardData?.items || [])].find(item => item.kind === 'file');
        const file = fileItem?.getAsFile();
        if (file) {
          event.preventDefault();
          importMediaFile(file, lastPointer.x, lastPointer.y);
        } else if (clipboardData?.cards?.length && (event.clipboardData?.getData('application/x-whiteboard-cards')===internalClipboardToken || event.clipboardData?.getData('text/html')?.includes(`whiteboard:${internalClipboardToken}`))) {
          event.preventDefault();
          pasteCards();
        } else {
          const pastedText = event.clipboardData?.getData('text/plain')?.trim();
          if (pastedText) {
            event.preventDefault();
            createPastedTextCard(pastedText, lastPointer.x, lastPointer.y, event.clipboardData?.getData('text/html') || '');
          }
        }
      });
      window.addEventListener('beforeunload', event => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
      });
      document.addEventListener('pointerdown', event => {
        if (event.button === 2 && drag?.moved) convertActiveDragToDuplicate(event);
      }, { capture: true });

      versionButton.addEventListener('click', openVersionHistory);
      closeVersionModalButton.addEventListener('click', closeVersionHistory);
      scrim.addEventListener('click', closeOverlays);
      cursorTool.addEventListener('click', () => setActiveTool('cursor'));
      connectorTool.addEventListener('click', () => setActiveTool('connector'));
      handTool.addEventListener('click', () => setActiveTool('hand'));
      addCardTool.addEventListener('click', () => createCard(lastPointer.x,lastPointer.y,'New idea',false));
      pickerTool.addEventListener('click', openColorPicker);
      mobileZoomOut.addEventListener('click', () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, .8));
      mobileZoomIn.addEventListener('click', () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25));
      mobileFit.addEventListener('click', fitAllCards);
      boardSelect.addEventListener('change', () => switchBoard(boardSelect.value));
      boardName.addEventListener('change', renameCurrentBoard);
      boardName.addEventListener('keydown', event => {
        if (event.key === 'Enter') boardName.blur();
      });
      newBoardButton.addEventListener('click', requestNewBoard);
      saveBoardButton.addEventListener('click', saveBoardNow);
      openBoardsMenu.addEventListener('click', openAllBoards);
      renameBoardMenu.addEventListener('click', promptRenameCurrentBoard);
      exportBoardButton.addEventListener('click', openExportDialog);
      importBoardButton.addEventListener('click', () => { importMode = 'board-list'; importFile.click(); });
      document.getElementById('openDeviceMenu').addEventListener('click', () => { importMode='board-list'; importFile.click(); });
      document.getElementById('closeBoardMenu').addEventListener('click', closeCurrentBoardToHome);
      importFile.addEventListener('change', () => importBoardFile(importFile.files[0]));
      importBoardFromOverview.addEventListener('click', () => { importMode = 'board-list'; importFile.click(); });
      document.getElementById('homeAllBoards').addEventListener('click', openAllBoards);
      document.getElementById('openAllBoardsHome').addEventListener('click', openAllBoards);
      closeAllBoardsButton.addEventListener('click', closeAllBoards);
      allBoardsModal.addEventListener('pointerdown', event => { if (event.target === allBoardsModal) closeAllBoards(); });
      confirmNewBoard.addEventListener('click', confirmNewBoardCreation);
      document.getElementById('cancelNewBoard').addEventListener('click', closeNewBoardDialog);
      document.getElementById('cancelNewBoardX').addEventListener('click', closeNewBoardDialog);
      newBoardName.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); confirmNewBoardCreation(); } });
      document.getElementById('cancelCloseBoard').addEventListener('click', cancelCloseBoardWarning);
      document.getElementById('discardCloseBoard').addEventListener('click', discardAndCloseBoard);
      document.getElementById('saveCloseBoard').addEventListener('click', saveAndCloseBoard);
      importMediaButton.addEventListener('click', () => mediaFile.click());
      mediaFile.addEventListener('change', () => {
        importMediaFile(mediaFile.files[0]);
        mediaFile.value = '';
      });
      closeExportModalButton.addEventListener('click', closeExportDialog);
      cancelExportButton.addEventListener('click', closeExportDialog);
      confirmExportButton.addEventListener('click', () => {
        const board = currentBoard();
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
        if (format === 'pdf') exportBoardPdf(board, exportName.value); else exportCurrentBoard(exportName.value);
        closeExportDialog();
      });
      exportName.addEventListener('keydown', event => {
        if (event.key === 'Enter') confirmExportButton.click();
      });
      versionModal.addEventListener('pointerdown', event => {
        if (event.target === versionModal) closeVersionHistory();
      });
      exportModal.addEventListener('pointerdown', event => {
        if (event.target === exportModal) closeExportDialog();
      });
      boardOverviewModal.addEventListener('pointerdown', event => { if (event.target === boardOverviewModal) event.stopPropagation(); });
      boardCardMenu.addEventListener('click', event => {
        const item = event.target.closest('[data-board-action]');
        if (item) runBoardCardAction(item.dataset.boardAction);
      });
      settingsButton.addEventListener('click', openSettings);
      document.getElementById('undoMenu').addEventListener('click', undo);
      document.getElementById('redoMenu').addEventListener('click', redo);
      document.getElementById('duplicateMenu').addEventListener('click', duplicateSelectedCards);
      document.getElementById('groupMenu').addEventListener('click', groupSelectedCards);
      document.getElementById('ungroupMenu').addEventListener('click', ungroupSelectedCards);
      document.getElementById('cutMenu').addEventListener('click', cutSelectedCards);
      document.getElementById('copyMenu').addEventListener('click', copySelectedCards);
      document.getElementById('pasteMenu').addEventListener('click', pasteFromClipboard);
      document.getElementById('deleteMenu').addEventListener('click', deleteSelectedCards);
      document.getElementById('selectAllMenu').addEventListener('click', selectAllCards);
      document.getElementById('fitMenu').addEventListener('click', fitAllCards);
      document.getElementById('zoomInMenu').addEventListener('click', () => zoomFromPointer('in'));
      document.getElementById('zoomOutMenu').addEventListener('click', () => zoomFromPointer('out'));
      document.getElementById('quickUndo').addEventListener('click', undo);
      document.getElementById('quickRedo').addEventListener('click', redo);
      document.getElementById('quickCut').addEventListener('click', cutSelectedCards);
      document.getElementById('quickCopy').addEventListener('click', copySelectedCards);
      document.getElementById('quickPaste').addEventListener('click', pasteFromClipboard);
      document.getElementById('quickDuplicate').addEventListener('click', duplicateSelectedCards);
      document.getElementById('quickRepeat').addEventListener('click', repeatLastCardAction);
      document.getElementById('quickGroup').addEventListener('click', groupSelectedCards);
      document.getElementById('quickUngroup').addEventListener('click', ungroupSelectedCards);
      document.getElementById('quickSelectAll').addEventListener('click', selectAllCards);
      document.getElementById('quickDelete').addEventListener('click', deleteSelectedCards);
      document.getElementById('quickZoomIn').addEventListener('click', () => zoomFromPointer('in'));
      document.getElementById('quickZoomOut').addEventListener('click', () => zoomFromPointer('out'));
      document.getElementById('quickFit').addEventListener('click', fitAllCards);
      document.getElementById('animationMenu').addEventListener('click', () => { dragMotionEnabled=!dragMotionEnabled;writeLocal(MOTION_STORAGE_KEY,String(dragMotionEnabled));updateMotionSetting(); });
      document.getElementById('toggleToolbarMenu').addEventListener('click', event => toggleSurface(toolRail,event.currentTarget));
      document.getElementById('togglePaletteMenu').addEventListener('click', event => toggleSurface(colorBar,event.currentTarget));
      document.getElementById('toggleHistoryMenu').addEventListener('click', event => toggleSurface(document.getElementById('colorHistory'),event.currentTarget));
      document.getElementById('toggleBoardStripMenu').addEventListener('click', event => toggleSurface(document.getElementById('boardTabs'),event.currentTarget));
      snapToggleMenu.addEventListener('click', () => {
        snapEnabled = !snapEnabled;
        writeLocal(SNAP_STORAGE_KEY, String(snapEnabled));
        updateSnapControl();
      });
      dragMotionToggle.addEventListener('change', () => {
        dragMotionEnabled = dragMotionToggle.checked;
        writeLocal(MOTION_STORAGE_KEY, String(dragMotionEnabled));
        updateMotionSetting();
      });
      textFormatBar.addEventListener('pointerdown', event => event.preventDefault());
      textFormatBar.addEventListener('click', event => {
        const button = event.target.closest('[data-format]');
        if (button) applyTextFormat(button.dataset.format);
      });
      document.querySelectorAll('.menu-trigger').forEach(trigger => trigger.addEventListener('click', event => {
        event.stopPropagation();
        const menu = trigger.closest('.app-menu');
        const shouldOpen = !menu.classList.contains('open');
        closeHeaderMenus();
        if (shouldOpen) menu.classList.add('open');
      }));
      const persistentMenuCommands = new Set(['animationMenu','snapToggleMenu','toggleToolbarMenu','togglePaletteMenu','toggleHistoryMenu','toggleBoardStripMenu']);
      document.querySelectorAll('.menu-command').forEach(command => command.addEventListener('click', () => { if (!persistentMenuCommands.has(command.id)) closeHeaderMenus(); }));
      closeSettingsButton.addEventListener('click', closeSettings);
      settingsModal.addEventListener('pointerdown', event => { if (event.target === settingsModal) closeSettings(); });
      closeDocumentModalButton.addEventListener('click', () => { documentModal.classList.remove('open'); documentModal.setAttribute('aria-hidden','true'); updateScrim(); });
      documentModal.addEventListener('pointerdown', event => { if (event.target === documentModal) closeDocumentModalButton.click(); });
      contextMenu.addEventListener('click', event => {
        const item = event.target.closest('[data-action]');
        if (item) runContextAction(item.dataset.action);
      });
      colorBar.addEventListener('click', event => {
        const swatch = event.target.closest('[data-color]');
        if (swatch) applyColorToSelection(swatch.dataset.color, 'card');
      });
      colorBar.addEventListener('contextmenu', event => {
        const swatch = event.target.closest('[data-color]');
        if (!swatch) return;
        event.preventDefault();
        applyColorToSelection(swatch.dataset.color, 'text');
      });
      document.addEventListener('pointerdown', event => {
        if (!contextMenu.contains(event.target)) closeContextMenu();
        if (!boardCardMenu.contains(event.target) && !event.target.closest('.board-card-menu-button')) closeBoardCardMenu();
        if (!event.target.closest('.app-menu')) closeHeaderMenus();
      });
      document.addEventListener('dragenter', event => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        dragDepth += 1;
        dropOverlay.classList.add('open');
        dropOverlay.setAttribute('aria-hidden', 'false');
      });
      document.addEventListener('dragover', event => {
        if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
      });
      document.addEventListener('dragleave', event => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
          dropOverlay.classList.remove('open');
          dropOverlay.setAttribute('aria-hidden', 'true');
        }
      });
      document.addEventListener('drop', event => {
        event.preventDefault();
        dragDepth = 0;
        dropOverlay.classList.remove('open');
        dropOverlay.setAttribute('aria-hidden', 'true');
        const file = [...(event.dataTransfer?.files || [])].find(item => item.name.toLowerCase().endsWith('.json') || item.type === 'application/json' || item.type.startsWith('image/') || item.type.startsWith('audio/') || item.type.startsWith('video/') || audioFilePattern.test(item.name) || videoFilePattern.test(item.name) || textFilePattern.test(item.name));
        const dropMode = boardOverviewModal.classList.contains('open') ? 'board-list' : 'merge';
        if (file && (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/') || audioFilePattern.test(file.name) || videoFilePattern.test(file.name) || textFilePattern.test(file.name)) && dropMode === 'merge') importMediaFile(file, event.clientX, event.clientY);
        else if (file) importBoardFile(file, dropMode);
        else window.alert('Gunakan JSON, media yang didukung, atau file teks/dokumen.');
      });


      function isMediaCard(card) { return Boolean(card && ['image','svg','audio','video'].includes(card.type)); }

      function toggleSelectionLinks() {
        if (selectedIds.size < 2) return;
        const internal = connections.filter(c => selectedIds.has(c.from) && selectedIds.has(c.to));
        if (internal.length) {
          const ids = new Set(internal.map(c => c.id)); connections = connections.filter(c => !ids.has(c.id));
        } else {
          const order = [...new Set([...selectionOrder,...selectedIds])].filter(id => selectedIds.has(id));
          for (let i=1;i<order.length;i++) connections.push({id:makeId('connection'),from:order[i-1],to:order[i],label:''});
        }
        pendingConnectionId=null; selectedConnectionId=null; saveState(); renderConnections();
      }

      function layerUnits() {
        const seen = new Set(); return cards.filter(c => { const key=c.groupId || 'card-'+c.id; if(seen.has(key))return false; seen.add(key); return true; });
      }
      function syncLayers() {
        const units=layerUnits(); cards.forEach(c => {const index=units.findIndex(u=>c.groupId ? u.groupId===c.groupId : u.id===c.id); const el=cardElement(c.id);if(el)el.style.zIndex=String(index+1);});
      }
      function groupSelectedCards() {
        const selected=cards.filter(c=>selectedIds.has(c.id)); if(selected.length<2)return;
        if(selected[0].groupId && selected.every(c=>c.groupId===selected[0].groupId))return;
        const original=cards.map(c=>c.id), top=Math.max(...selected.map(c=>cards.indexOf(c)));
        const before=cards.slice(0,top+1).filter(c=>!selectedIds.has(c.id));
        const after=cards.slice(top+1).filter(c=>!selectedIds.has(c.id));
        const groupId=makeId('group');
        selected.forEach(c=>{c.groupId=groupId;c.groupOriginalOrder=original;});
        cards=[...before,...selected,...after]; renderAll();saveState();
      }
      function ungroupSelectedCards() {
        const groups=[...new Set(cards.filter(c=>selectedIds.has(c.id)&&c.groupId).map(c=>c.groupId))];
        if(!groups.length)return;
        groups.forEach(group=>{
          const members=cards.filter(c=>c.groupId===group);
          const order=members[0]?.groupOriginalOrder || [];
          const byId = new Map(cards.map(card => [card.id, card]));
          const restored = order.map(id => byId.get(id)).filter(Boolean);
          const restoredIds = new Set(restored.map(card => card.id));
          cards = [...restored, ...cards.filter(card => !restoredIds.has(card.id))];
          members.forEach(c=>{delete c.groupId;delete c.groupOriginalOrder;});
        });
        renderAll();saveState();
      }
      function renderBoardTabs() {
        const root=document.getElementById('boardTabs');if(!root)return;root.replaceChildren();
        boards.filter(b=>!closedBoardIds.has(b.id)).forEach(b=>{const tab=document.createElement('div');tab.className=`board-tab${b.id===currentBoardId?' active':''}`;const button=document.createElement('button');button.className='board-tab-open';button.textContent=b.name;button.onclick=()=>{closedBoardIds.delete(b.id);switchBoard(b.id);closeBoardOverview();};const close=document.createElement('button');close.className='board-tab-close';close.type='button';close.title=`Tutup ${b.name}`;close.setAttribute('aria-label',`Tutup ${b.name}`);close.append(lucideIcon('x'));close.onclick=event=>{event.stopPropagation();if(b.id===currentBoardId)closeCurrentBoardToHome();else closedBoardIds.add(b.id);renderBoardTabs();};tab.append(button,close);root.append(tab);});
        const plus=document.createElement('button');plus.textContent='+';plus.setAttribute('aria-label','Board baru');plus.onclick=requestNewBoard;root.append(plus);
      }

      function installMediaPlayer(el, card) {
        el.style.setProperty('--media-width',card.width*camera.scale+'px');el.style.setProperty('--media-height',card.height*camera.scale+'px');
        el.replaceChildren(); const stage=document.createElement('div'); stage.className='media-stage';
        if(card.type==='audio'){stage.classList.add('audio-stage');if(card.cover)stage.style.backgroundImage=`url("${card.cover}")`;}
        stage.style.width=card.width+'px';stage.style.height=card.height+'px';stage.style.transform='scale('+camera.scale+')';
        const media=document.createElement(card.type); media.src=card.data;media.preload='metadata';media.controls=false;
        media.setAttribute('playsinline','');media.style.pointerEvents='none';
        if(card.type==='audio')media.hidden=true;
        const controls=document.createElement('div');controls.className='media-controls';
        const play=document.createElement('button');play.type='button';play.textContent='▶';play.title='Putar / jeda';
        const caption=document.createElement('span');caption.className='media-caption';caption.textContent=card.name||card.type;
        const progress=document.createElement('progress');progress.max=1;progress.value=0;
        const stamp=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
        media.addEventListener('timeupdate',()=>{progress.value=media.duration?media.currentTime/media.duration:0;caption.textContent=(card.name||card.type)+' · '+stamp(media.currentTime)+' / '+stamp(media.duration);});
        media.addEventListener('play',()=>{world.querySelectorAll('audio,video').forEach(other=>{if(other!==media)other.pause();});play.textContent='Ⅱ';});
        media.addEventListener('pause',()=>play.textContent='▶');
        media.addEventListener('error',()=>{caption.textContent='Format/codec tidak dapat diputar';});
        play.onclick=()=>{if(media.paused)media.play().catch(()=>caption.textContent='Media belum dapat diputar');else media.pause();};
        controls.append(play,caption,progress);stage.append(media,controls);el.append(stage);
        const handle=document.createElement('button');handle.type='button';handle.className='card-resize';handle.setAttribute('aria-label','Ubah ukuran media');handle.addEventListener('pointerdown',startCardResize);el.append(handle);syncResizeHandle(el,card);
        stage.addEventListener('dblclick',e=>e.stopPropagation());
        [play,media].forEach(node=>node.addEventListener('pointerdown',e=>e.stopPropagation()));
      }
      let colorHistory=[];
      function rememberColor(color) {
        colorHistory=[color,...colorHistory.filter(c=>c!==color)].slice(0,40);
        const root=document.getElementById('colorHistory');root.replaceChildren();
        colorHistory.forEach(color=>{const b=document.createElement('button');b.className='color-swatch';b.style.setProperty('--swatch',color);b.title=color;b.setAttribute('aria-label',color);b.onclick=()=>applyColorToSelection(color,'card');root.append(b);});
      }
      colorBar.addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b)rememberColor(b.dataset.color);});
      colorBar.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
      document.getElementById('colorHistory').addEventListener('wheel',e=>{e.currentTarget.scrollLeft+=e.deltaY;e.preventDefault();},{passive:false});
      // Urutan tetap: transparan, hitam, putih, warna dasar, lalu gradasi warna lain.
      const palette=[...colorBar.querySelectorAll('[data-color]')];
      const primary=['transparent','#111827','#ffffff','#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#14b8a6','#06b6d4','#3978f6','#8b5cf6','#ec4899'];
      const hue=color=>{const v=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),max=Math.max(...v),min=Math.min(...v),d=max-min;if(!d)return [999,-max];const [r,g,b]=v;return [((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60),-max];};
      palette.sort((a,b)=>{const ai=primary.indexOf(a.dataset.color),bi=primary.indexOf(b.dataset.color);if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);const x=hue(a.dataset.color),y=hue(b.dataset.color);return x[0]-y[0]||x[1]-y[1];}).forEach(b=>{b.title=b.dataset.color;b.setAttribute('aria-label',b.dataset.color);colorBar.append(b);});

      updateSnapControl();
      updateMotionSetting();
      installMenuIcons();
      loadState().then(() => { renderAll(); openBoardOverview(); });
    })();
