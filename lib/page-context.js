/**
 * page-context.js - Lightweight page context extraction and observers
 * Returns host/title/snippet for lyric + prompt fusion (opt-in)
 */

let allowPageText = true;
let observersReady = false;
let pendingTimer = null;
let mutationObserver = null;
let lastContext = { host: '', title: '', snippet: '' };
let lastSignature = '';
const listeners = new Set();

function hasDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Enable or disable page text collection.
 * @param {boolean} value
 */
export function setOptIn(value) {
  allowPageText = Boolean(value);
  scheduleRefresh('optIn');
}

function sanitizeSnippet(value = '', limit = 280) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Collect a short visible text snippet from the page.
 * Avoids inputs/passwords/contentEditable fields.
 * @param {number} limit
 * @returns {string}
 */
function collectVisibleSnippet(limit = 280) {
  if (!hasDom() || !document.body || !allowPageText) return '';

  try {
    if (typeof document.createTreeWalker !== 'function' || typeof NodeFilter === 'undefined') {
      return sanitizeSnippet(document.body.innerText || '', limit);
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const text = node.textContent;
          if (!text || !text.trim()) {
            return NodeFilter.FILTER_SKIP;
          }

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_SKIP;

          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
            return NodeFilter.FILTER_REJECT;
          }
          if (typeof HTMLInputElement !== 'undefined' && parent instanceof HTMLInputElement) {
            return NodeFilter.FILTER_REJECT;
          }
          if (typeof HTMLSelectElement !== 'undefined' && parent instanceof HTMLSelectElement) {
            return NodeFilter.FILTER_REJECT;
          }
          if (typeof HTMLTextAreaElement !== 'undefined' && parent instanceof HTMLTextAreaElement) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.isContentEditable) {
            return NodeFilter.FILTER_REJECT;
          }

          const styles = window.getComputedStyle(parent);
          if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let snippet = '';
    while (walker.nextNode()) {
      snippet += `${walker.currentNode.textContent.trim()} `;
      if (snippet.length >= limit) {
        break;
      }
    }

    return sanitizeSnippet(snippet, limit);
  } catch (err) {
    console.warn('[HMB:page-context] Failed to collect snippet:', err);
    try {
      return sanitizeSnippet(document.body?.innerText || '', limit);
    } catch (innerErr) {
      console.warn('[HMB:page-context] innerText fallback failed:', innerErr);
      return '';
    }
  }
}

function computeContext() {
  if (!hasDom()) {
    return { ...lastContext };
  }

  const host = window.location?.hostname || '';
  const title = document.title ? document.title.slice(0, 120) : '';
  const snippet = allowPageText ? collectVisibleSnippet(280) : '';

  return { host, title, snippet };
}

function notify(context) {
  const signature = JSON.stringify(context);
  if (signature === lastSignature) {
    return context;
  }
  lastSignature = signature;
  lastContext = context;
  listeners.forEach((listener) => {
    try {
      listener({ ...context });
    } catch (err) {
      console.error('[HMB:page-context] Listener error', err);
    }
  });
  return context;
}

function refreshContext() {
  const context = computeContext();
  return notify(context);
}

function scheduleRefresh(reason = 'tick') {
  if (!hasDom()) return;
  if (pendingTimer) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    refreshContext();
  }, reason === 'mutation' ? 120 : 240);
}

function initObservers() {
  if (!hasDom() || observersReady) return;

  const start = () => {
    if (observersReady) return;
    observersReady = true;

    mutationObserver = new MutationObserver(() => scheduleRefresh('mutation'));
    mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    window.addEventListener('focus', () => scheduleRefresh('focus'), true);
    window.addEventListener('blur', () => scheduleRefresh('blur'), true);
    window.addEventListener('scroll', () => scheduleRefresh('scroll'), true);
    document.addEventListener('visibilitychange', () => scheduleRefresh('visibility'), true);
    scheduleRefresh('init');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        start();
      }
    });
  } else if (document.body) {
    start();
  } else {
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody);
        start();
      }
    }, 50);
  }
}

/**
 * Retrieve host/title/snippet for the current page (respect opt-in).
 */
export function getPageContext() {
  if (!hasDom()) {
    return { ...lastContext };
  }

  if (!observersReady) {
    initObservers();
    refreshContext();
  }

  return { ...lastContext };
}

export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  if (hasDom()) {
    initObservers();
    if (!observersReady) {
      scheduleRefresh('subscribe');
    } else {
      scheduleRefresh('subscribeImmediate');
    }
  }
  listeners.add(listener);
  // Provide current snapshot immediately
  listener({ ...getPageContext() });
  return () => {
    listeners.delete(listener);
  };
}

export default {
  getPageContext,
  setOptIn,
  subscribe
};
