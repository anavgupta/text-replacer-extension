// Content script that performs text replacement on web pages

(function() {
  'use strict';

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

  function getStorage() {
    try {
      if (chrome.storage.sync) return chrome.storage.sync;
    } catch (e) { /* sync unavailable */ }
    return chrome.storage.local;
  }

  function matchesSingleScope(url, scope) {
    if (!scope || scope.trim() === '') {
      return true;
    }
    try {
      const urlObj = new URL(url);
      const scopeLower = scope.toLowerCase().trim();
      const fullUrl = url.toLowerCase();
      if (scopeLower.includes('*')) {
        const pattern = scopeLower
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        const regex = new RegExp(pattern, 'i');
        if (regex.test(fullUrl)) return true;
        if (regex.test(urlObj.hostname)) return true;
        return false;
      }
      if (scopeLower.startsWith('http://') || scopeLower.startsWith('https://')) {
        return fullUrl.includes(scopeLower);
      }
      return urlObj.hostname.toLowerCase().includes(scopeLower) ||
             fullUrl.includes(scopeLower);
    } catch (e) {
      console.error('ReText: Error checking scope', e);
      return true;
    }
  }

  function matchesScope(url, scope) {
    if (!scope || scope.trim() === '') {
      return true;
    }
    const scopes = scope.split(',').map(s => s.trim()).filter(s => s);
    return scopes.some(singleScope => matchesSingleScope(url, singleScope));
  }

  function replaceTextInNode(node, replacements) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let modified = false;

      replacements.forEach(replacement => {
        const { textToReplace, replacementText, scope, wholeWord, isRegex } = replacement;

        if (!textToReplace || !replacementText) return;

        if (scope && scope.trim() !== '') {
          if (!matchesScope(window.location.href, scope)) return;
        }

        let pattern;
        let flags = 'gi';

        if (isRegex) {
          pattern = textToReplace;
        } else {
          const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (wholeWord) {
            const hasSpecialChars = /[^a-zA-Z0-9_]/.test(textToReplace);
            if (hasSpecialChars) {
              pattern = `(?<=^|[\\s])${escapedText}(?=[\\s]|$)`;
            } else {
              pattern = `\\b${escapedText}\\b`;
            }
          } else {
            pattern = escapedText;
          }
        }

        try {
          const regex = new RegExp(pattern, flags);
          const newText = text.replace(regex, replacementText);
          if (newText !== text) {
            text = newText;
            modified = true;
          }
        } catch (e) {
          // Invalid regex pattern — skip silently
        }
      });

      if (modified) {
        node.textContent = text;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has(node.tagName)) return;
      for (let i = 0; i < node.childNodes.length; i++) {
        replaceTextInNode(node.childNodes[i], replacements);
      }
    }
  }

  function performReplacements() {
    getStorage().get(['replacements', 'globalEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('ReText: Storage error', chrome.runtime.lastError);
        return;
      }

      if (result.globalEnabled === false) return;

      const replacements = result.replacements || [];
      if (replacements.length === 0) return;

      const activeReplacements = replacements.filter(replacement => {
        if (replacement.enabled === false) return false;
        if (!replacement.scope || replacement.scope.trim() === '') return true;
        return matchesScope(window.location.href, replacement.scope);
      });

      if (activeReplacements.length === 0) return;

      replaceTextInNode(document.body, activeReplacements);
    });
  }

  let _debounceTimer = null;
  function debouncedReplacements(delay = 150) {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => performReplacements(), delay);
  }

  function init() {
    if (document.body) {
      performReplacements();

      const observer = new MutationObserver(() => {
        debouncedReplacements();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      setTimeout(init, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if ((areaName === 'sync' || areaName === 'local') && (changes.replacements || changes.globalEnabled)) {
      performReplacements();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateReplacements') {
      performReplacements();
      sendResponse({ success: true });
    } else if (request.action === 'toggleGlobal') {
      performReplacements();
      sendResponse({ success: true });
    }
    return true;
  });
})();
