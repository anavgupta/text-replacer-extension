// Content script that performs text replacement on web pages

(function() {
  'use strict';

  // Function to check if current URL matches a single scope pattern
  function matchesSingleScope(url, scope) {
    if (!scope || scope.trim() === '') {
      return true; // No scope means apply everywhere
    }

    try {
      const urlObj = new URL(url);
      const scopeLower = scope.toLowerCase().trim();
      const fullUrl = url.toLowerCase();
      
      // Check if scope contains wildcard
      if (scopeLower.includes('*')) {
        const pattern = scopeLower
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars except *
          .replace(/\*/g, '.*');  // Convert * to .*
        const regex = new RegExp(pattern, 'i');
        
        // Test against full URL (path matching)
        if (regex.test(fullUrl)) {
          return true;
        }
        // Also test against hostname only
        if (regex.test(urlObj.hostname)) {
          return true;
        }
        return false;
      }
      
      // Check if scope is a full URL pattern
      if (scopeLower.startsWith('http://') || scopeLower.startsWith('https://')) {
        return fullUrl.includes(scopeLower);
      }
      
      // Simple domain/hostname or path matching
      return urlObj.hostname.toLowerCase().includes(scopeLower) ||
             fullUrl.includes(scopeLower);
    } catch (e) {
      console.error('Text Replacer: Error checking scope', e);
      return true; // Default to true if scope check fails
    }
  }

  // Function to check if URL matches any of the scopes (comma-separated)
  function matchesScope(url, scope) {
    if (!scope || scope.trim() === '') {
      return true; // No scope means apply everywhere
    }

    // Split by comma and check each scope
    const scopes = scope.split(',').map(s => s.trim()).filter(s => s);
    
    // Return true if ANY scope matches
    return scopes.some(singleScope => matchesSingleScope(url, singleScope));
  }

  // Function to replace text in a node
  function replaceTextInNode(node, replacements) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let modified = false;

      replacements.forEach(replacement => {
        const { textToReplace, replacementText, scope, wholeWord } = replacement;
        
        if (!textToReplace || !replacementText) {
          return;
        }

        // Check scope if provided
        if (scope && scope.trim() !== '') {
          if (!matchesScope(window.location.href, scope)) {
            return;
          }
        }

        // Escape special regex characters
        const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Build regex pattern based on wholeWord option
        let pattern;
        if (wholeWord) {
          // Use lookaround for whole-word matching that works with special characters
          // (?<!\S) = not preceded by non-whitespace, (?!\S) = not followed by non-whitespace
          // Fall back to \b for purely alphanumeric search terms
          const hasSpecialChars = /[^a-zA-Z0-9_]/.test(textToReplace);
          if (hasSpecialChars) {
            pattern = `(?<=^|[\\s])${escapedText}(?=[\\s]|$)`;
          } else {
            pattern = `\\b${escapedText}\\b`;
          }
        } else {
          pattern = escapedText;
        }
        
        const regex = new RegExp(pattern, 'gi');
        const newText = text.replace(regex, replacementText);
        if (newText !== text) {
          text = newText;
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

  // Function to perform replacements and return count
  function performReplacements() {
    chrome.storage.sync.get(['replacements', 'globalEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Text Replacer: Storage error', chrome.runtime.lastError);
        return;
      }
      
      // Check if globally enabled
      if (result.globalEnabled === false) {
        return;
      }
      
      const replacements = result.replacements || [];
      
      if (replacements.length === 0) {
        return;
      }

      // Filter replacements that are enabled and match current scope
      const activeReplacements = replacements.filter(replacement => {
        // Check if individual replacement is enabled
        if (replacement.enabled === false) {
          return false;
        }
        // Check scope
        if (!replacement.scope || replacement.scope.trim() === '') {
          return true;
        }
        return matchesScope(window.location.href, replacement.scope);
      });

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
    if (areaName === 'sync' && (changes.replacements || changes.globalEnabled)) {
      performReplacements();
    }
  });

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateReplacements') {
      performReplacements();
      sendResponse({ success: true });
    } else if (request.action === 'toggleGlobal') {
      // Refresh the page content when global toggle changes
      performReplacements();
      sendResponse({ success: true });
    }
    return true;
  });
})();
