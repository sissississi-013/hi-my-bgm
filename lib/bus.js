/**
 * bus.js - Simple message bus for cross-context communication
 * Wraps chrome.runtime messaging with a cleaner API
 */

const listeners = new Map();

/**
 * Send a message to background or content scripts
 * @param {string} type - Message type
 * @param {Object} payload - Message data
 * @returns {Promise<any>} Response from receiver
 */
export async function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Listen for messages of a specific type
 * @param {string} type - Message type to listen for
 * @param {Function} handler - Callback(payload, sender) => response
 */
export function on(type, handler) {
  if (!listeners.has(type)) {
    listeners.set(type, []);
  }
  listeners.get(type).push(handler);
}

/**
 * Initialize the message listener (call once per context)
 */
export function init() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (!listeners.has(type)) {
      return false; // No handler
    }

    const handlers = listeners.get(type);
    if (handlers.length === 0) {
      return false;
    }

    // Call the first matching handler
    const handler = handlers[0];
    const result = handler(payload, sender);

    // Support async handlers
    if (result instanceof Promise) {
      result.then(sendResponse);
      return true; // Keep channel open for async
    } else {
      sendResponse(result);
      return false;
    }
  });
}

export default {
  send,
  on,
  init
};
