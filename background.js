// Background service worker for the extension

function getStorage() {
  try {
    if (chrome.storage.sync) return chrome.storage.sync;
  } catch (e) { /* sync unavailable */ }
  return chrome.storage.local;
}

chrome.runtime.onInstalled.addListener(() => {
  getStorage().get(['replacements', 'globalEnabled'], (result) => {
    const updates = {};
    if (!result.replacements) updates.replacements = [];
    if (result.globalEnabled === undefined) updates.globalEnabled = true;
    if (Object.keys(updates).length > 0) {
      getStorage().set(updates);
    }
  });

  updateBadge(0);

  chrome.contextMenus.create({
    id: 'create-replacement',
    title: 'Create replacement for "%s"',
    contexts: ['selection']
  });
});

function updateBadge(count) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#4caf50' : '#666' });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    updateBadge(request.count);
    sendResponse({ success: true });
  }
  return true;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'create-replacement' && info.selectionText) {
    chrome.action.openPopup().catch(() => {});
    getStorage().set({ _pendingRuleText: info.selectionText });
  }
});


chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' || areaName === 'local') {
    getStorage().get(['replacements', 'globalEnabled'], (result) => {
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
