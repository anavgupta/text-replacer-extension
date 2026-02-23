// Background service worker for the extension

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['replacements', 'globalEnabled'], (result) => {
    const updates = {};
    if (!result.replacements) {
      updates.replacements = [];
    }
    if (result.globalEnabled === undefined) {
      updates.globalEnabled = true;
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });
  
  // Set initial badge
  updateBadge(0);
});

// Update badge text
function updateBadge(count) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#4caf50' : '#666' });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    updateBadge(request.count);
    sendResponse({ success: true });
  }
  return true;
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-extension') {
    // Toggle globalEnabled state
    chrome.storage.sync.get(['globalEnabled', 'replacements'], (result) => {
      const newState = !result.globalEnabled;
      chrome.storage.sync.set({ globalEnabled: newState }, () => {
        // Update badge
        const count = newState ? (result.replacements || []).filter(r => r.enabled !== false).length : 0;
        updateBadge(count);
        
        // Notify all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
              chrome.tabs.sendMessage(tab.id, { action: 'toggleGlobal', enabled: newState }).catch(() => {});
            }
          });
        });
        
        // Show notification (optional visual feedback)
        const title = newState ? 'Text Replacer Enabled' : 'Text Replacer Disabled';
        const message = newState ? `${count} replacement(s) active` : 'All replacements paused';
        
        // Use badge as visual feedback instead of notification
        if (!newState) {
          chrome.action.setBadgeText({ text: 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
        }
      });
    });
  }
});

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    chrome.storage.sync.get(['replacements', 'globalEnabled'], (result) => {
      const count = result.globalEnabled !== false 
        ? (result.replacements || []).filter(r => r.enabled !== false).length 
        : 0;
      
      if (result.globalEnabled === false) {
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
      } else {
        updateBadge(count);
      }
    });
  }
});
