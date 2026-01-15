// Content script that performs text replacement on web pages

(function() {
  'use strict';

  console.log('Text Replacer: Content script loaded on', window.location.href);

  // Function to check if current URL matches scope
  function matchesScope(url, scope) {
    if (!scope || scope.trim() === '') {
      return true; // No scope means apply everywhere
    }

    try {
      const urlObj = new URL(url);
      const scopeLower = scope.toLowerCase().trim();
      
      // Check if scope is a domain pattern
      if (scopeLower.includes('*')) {
        const pattern = scopeLower
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(urlObj.hostname);
      }
      
      // Check if scope is a full URL pattern
      if (scopeLower.startsWith('http://') || scopeLower.startsWith('https://')) {
        const pattern = scopeLower
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}`, 'i');
        return regex.test(url);
      }
      
      // Simple domain/hostname matching
      return urlObj.hostname.toLowerCase().includes(scopeLower) ||
             urlObj.hostname.toLowerCase() === scopeLower;
    } catch (e) {
      console.error('Text Replacer: Error checking scope', e);
      return true; // Default to true if scope check fails
    }
  }

  // Function to replace text in a node
  function replaceTextInNode(node, replacements) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let modified = false;

      replacements.forEach(replacement => {
        const { textToReplace, replacementText, scope } = replacement;
        
        if (!textToReplace || !replacementText) {
          return;
        }

        // Check scope if provided
        if (scope && scope.trim() !== '') {
          if (!matchesScope(window.location.href, scope)) {
            return;
          }
        }

        // Perform replacement (case-insensitive by default)
        const regex = new RegExp(textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (regex.test(text)) {
          text = text.replace(regex, replacementText);
          modified = true;
        }
      });

      if (modified) {
        node.textContent = text;
      }
    } else {
      // Recursively process child nodes
      for (let i = 0; i < node.childNodes.length; i++) {
        replaceTextInNode(node.childNodes[i], replacements);
      }
    }
  }

  // Function to perform replacements
  function performReplacements() {
    chrome.storage.sync.get(['replacements'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Text Replacer: Storage error', chrome.runtime.lastError);
        return;
      }
      
      const replacements = result.replacements || [];
      console.log('Text Replacer: Found', replacements.length, 'replacement(s)');
      
      if (replacements.length === 0) {
        return;
      }

      // Filter replacements that match current scope
      const activeReplacements = replacements.filter(replacement => {
        if (!replacement.scope || replacement.scope.trim() === '') {
          return true;
        }
        return matchesScope(window.location.href, replacement.scope);
      });

      console.log('Text Replacer: Active replacements for this page:', activeReplacements.length);
      
      if (activeReplacements.length === 0) {
        return;
      }

      // Replace text in the document body
      replaceTextInNode(document.body, activeReplacements);
    });
  }

  // Wait for DOM to be ready
  function init() {
    if (document.body) {
      // Initial replacement
      performReplacements();

      // Watch for dynamic content changes
      const observer = new MutationObserver(() => {
        performReplacements();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      // If body doesn't exist yet, wait for it
      setTimeout(init, 100);
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Listen for storage changes to update replacements in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.replacements) {
      performReplacements();
    }
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateReplacements') {
      performReplacements();
      sendResponse({ success: true });
    }
    return true;
  });
})();
