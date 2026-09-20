(function initWhiteboardStorage(globalScope) {
  'use strict';

  const DB_NAME = 'whiteboard-studio';
  const DB_VERSION = 2;
  const BOARD_STORE = 'boards';
  const META_STORE = 'meta';
  const LEGACY_STORE = 'documents';
  const META_KEY = 'workspace';
  let databasePromise;

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('Transaksi IndexedDB dibatalkan.'));
      transaction.onerror = () => reject(transaction.error || new Error('Transaksi IndexedDB gagal.'));
    });
  }

  function open() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BOARD_STORE)) database.createObjectStore(BOARD_STORE, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
        if (event.oldVersion === 0 && !database.objectStoreNames.contains(LEGACY_STORE)) database.createObjectStore(LEGACY_STORE);
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error || new Error('IndexedDB tidak dapat dibuka.'));
      };
      request.onblocked = () => reject(new Error('Tutup tab Whiteboard lama lalu muat ulang.'));
    });
    return databasePromise;
  }

  async function readLegacySnapshot(database) {
    if (!database.objectStoreNames.contains(LEGACY_STORE)) return null;
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(LEGACY_STORE, 'readonly');
      const request = transaction.objectStore(LEGACY_STORE).get('state');
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error('Data lama tidak dapat dibaca.'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('Transaksi data lama gagal.'));
    });
    if (!value) return null;
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch { return null; }
  }

  async function loadAll() {
    const database = await open();
    const { boards, meta } = await new Promise((resolve, reject) => {
      const transaction = database.transaction([BOARD_STORE, META_STORE], 'readonly');
      const boardsRequest = transaction.objectStore(BOARD_STORE).getAll();
      const metaRequest = transaction.objectStore(META_STORE).get(META_KEY);
      let boardResult = [];
      let metaResult;
      boardsRequest.onsuccess = () => { boardResult = boardsRequest.result || []; };
      metaRequest.onsuccess = () => { metaResult = metaRequest.result; };
      boardsRequest.onerror = () => reject(boardsRequest.error || new Error('Daftar board tidak dapat dibaca.'));
      metaRequest.onerror = () => reject(metaRequest.error || new Error('Metadata board tidak dapat dibaca.'));
      transaction.oncomplete = () => resolve({ boards: boardResult, meta: metaResult });
      transaction.onerror = () => reject(transaction.error || new Error('Transaksi board gagal.'));
    });
    if (boards.length) return { boards, meta: meta || {} };

    const legacy = await readLegacySnapshot(database);
    if (!legacy?.boards?.length) return { boards: [], meta: {} };
    const migratedBoards = legacy.boards.filter(board => board?.id).map(board => ({ ...board, savedAt: board.savedAt || Date.now() }));
    await replaceAll(migratedBoards, {
      currentBoardId: legacy.currentBoardId || null,
      recentIds: Array.isArray(legacy.recentIds) ? legacy.recentIds.slice(0, 7) : migratedBoards.slice(0, 7).map(board => board.id),
      migratedAt: Date.now()
    });
    return { boards: migratedBoards, meta: legacy };
  }

  async function saveBoard(board, meta) {
    if (!board?.id) throw new TypeError('Board harus memiliki id.');
    const database = await open();
    const transaction = database.transaction([BOARD_STORE, META_STORE], 'readwrite');
    transaction.objectStore(BOARD_STORE).put(board);
    if (meta) transaction.objectStore(META_STORE).put(meta, META_KEY);
    await transactionDone(transaction);
    return board;
  }

  async function saveMeta(meta) {
    const database = await open();
    const transaction = database.transaction(META_STORE, 'readwrite');
    transaction.objectStore(META_STORE).put(meta || {}, META_KEY);
    await transactionDone(transaction);
  }

  async function deleteBoard(boardId, meta) {
    const database = await open();
    const transaction = database.transaction([BOARD_STORE, META_STORE], 'readwrite');
    transaction.objectStore(BOARD_STORE).delete(boardId);
    if (meta) transaction.objectStore(META_STORE).put(meta, META_KEY);
    await transactionDone(transaction);
  }

  async function replaceAll(boards, meta) {
    const database = await open();
    const transaction = database.transaction([BOARD_STORE, META_STORE], 'readwrite');
    const boardStore = transaction.objectStore(BOARD_STORE);
    boardStore.clear();
    for (const board of boards || []) if (board?.id) boardStore.put(board);
    transaction.objectStore(META_STORE).put(meta || {}, META_KEY);
    await transactionDone(transaction);
  }

  const api = { DB_NAME, DB_VERSION, open, loadAll, saveBoard, saveMeta, deleteBoard, replaceAll };
  globalScope.WhiteboardStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
