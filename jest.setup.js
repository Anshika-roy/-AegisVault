/**
 * jest.setup.js
 * Runs before each test file. Simulates the browser environment where
 * app.js is loaded as a <script> tag, making its functions globally available.
 * chat.js depends on these globals at load time.
 */

// Provide a minimal navigator.serviceWorker stub so registerServiceWorker()
// in app.js does not throw when the module is loaded.
if (!('serviceWorker' in navigator)) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    configurable: true
  });
}

// Suppress console output from app.js during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn()
};

// Load app.js and expose all exported functions + STORAGE_KEYS as globals
// so that chat.js (which references them as browser-script globals) works.
const app = require('./app.js');

Object.keys(app).forEach((key) => {
  global[key] = app[key];
});

// STORAGE_KEYS is used by chat.js but is not part of app.js exports.
global.STORAGE_KEYS = {
  USERS: 'aegis_users',
  CURRENT_USER: 'aegis_current_user',
  LAWYERS: 'aegis_lawyers',
  REQUESTS: 'aegis_requests',
  MESSAGES: 'aegis_messages',
  NOTIFICATIONS: 'aegis_notifications'
};
