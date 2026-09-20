const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'assets/js/storage.js'), 'utf8');

assert.match(html, /assets\/css\/app\.css/);
assert.match(html, /assets\/js\/core\.js/);
assert.match(html, /assets\/js\/storage\.js/);
assert.match(html, /assets\/js\/app\.js/);
assert.doesNotMatch(html, /bootstrap/i);
assert.match(css, /@media/);
assert.match(css, /scrollbar-width:\s*none/);
assert.doesNotMatch(css, /font:\s*(?:\d+|normal|bold)[^;]*inherit/);
assert.match(app, /key === 'w'/);
assert.match(app, /key === 'r'/);
assert.match(app, /event\.target\.matches\?\.\('input, select, textarea, \[contenteditable="true"\]'\)/);
assert.match(storage, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
assert.match(storage, /createObjectStore\(BOARD_STORE/);
assert.doesNotMatch(app, /writeStoredState\(/);
console.log('static.test: ok');
