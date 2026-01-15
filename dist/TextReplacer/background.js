// Background service worker for the extension

chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with empty replacements array if not exists
  chrome.storage.sync.get(['replacements'], (result) => {
    if (!result.replacements) {
      chrome.storage.sync.set({ replacements: [] });
    }
  });
});

// Optional: Handle extension icon click if needed
chrome.action.onClicked.addListener((tab) => {
  // Popup handles the UI, but we can add additional logic here if needed
});
