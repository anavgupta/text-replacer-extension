// Popup script for managing text replacements

let replacements = [];
let editingIndex = -1;
let globalEnabled = true;
let searchTerm = '';
let _undoBuffer = null;
let _undoTimer = null;

function getStorage() {
  try {
    if (chrome.storage.sync) return chrome.storage.sync;
  } catch (e) { /* sync unavailable */ }
  return chrome.storage.local;
}

// --- Toast notifications ---

function showToast(message, type = 'info', duration = 3000, actionLabel, actionCallback) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  if (actionLabel && actionCallback) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      actionCallback();
      toast.remove();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease-in forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// --- Storage operations ---

function loadReplacements() {
  getStorage().get(['replacements', 'globalEnabled'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading replacements:', chrome.runtime.lastError);
      showToast('Failed to load replacements', 'error');
      return;
    }
    replacements = result.replacements || [];
    globalEnabled = result.globalEnabled !== false;
    document.getElementById('globalToggle').checked = globalEnabled;
    renderReplacements();
    updateBadge();
    checkPendingRule();
  });
}

function saveReplacements() {
  getStorage().set({ replacements, globalEnabled }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving replacements:', chrome.runtime.lastError);
      showToast('Error saving replacements', 'error');
    } else {
      updateBadge();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('edge://')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateReplacements' }).catch(() => {});
        }
      });
    }
  });
}

function updateBadge() {
  const enabledCount = globalEnabled ? replacements.filter(r => r.enabled !== false).length : 0;
  try {
    chrome.runtime.sendMessage({ action: 'updateBadge', count: enabledCount }).catch(() => {});
  } catch (e) {
    // Background script may not be ready
  }
}

function checkPendingRule() {
  getStorage().get(['_pendingRuleText'], (result) => {
    if (result._pendingRuleText) {
      getStorage().remove('_pendingRuleText');
      openModal(-1, result._pendingRuleText);
    }
  });
}

// --- Rendering ---

function renderReplacements() {
  const tbody = document.getElementById('replacementsList');
  const table = document.getElementById('replacementsTable');
  const emptyState = document.getElementById('emptyState');
  const noResults = document.getElementById('noResults');
  const countLabel = document.getElementById('countLabel');

  const enabledCount = replacements.filter(r => r.enabled !== false).length;
  countLabel.textContent = `${enabledCount}/${replacements.length} active`;

  populateGroupSuggestions();

  if (replacements.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.add('show');
    noResults.classList.remove('show');
    return;
  }

  const filteredReplacements = replacements.map((r, i) => ({ ...r, originalIndex: i }))
    .filter(r => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (r.textToReplace || '').toLowerCase().includes(term) ||
             (r.replacementText || '').toLowerCase().includes(term) ||
             (r.scope || '').toLowerCase().includes(term) ||
             (r.group || '').toLowerCase().includes(term);
    });

  if (filteredReplacements.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.remove('show');
    noResults.classList.add('show');
    return;
  }

  table.classList.remove('hidden');
  emptyState.classList.remove('show');
  noResults.classList.remove('show');
  tbody.innerHTML = '';

  filteredReplacements.forEach((replacement) => {
    const index = replacement.originalIndex;
    const isEnabled = replacement.enabled !== false;
    const tr = document.createElement('tr');
    if (!isEnabled) tr.classList.add('disabled');

    // Toggle column
    const tdToggle = document.createElement('td');
    tdToggle.innerHTML = `<input type="checkbox" class="row-toggle" data-index="${index}" ${isEnabled ? 'checked' : ''} aria-label="Toggle rule">`;
    tr.appendChild(tdToggle);

    // Group column
    const tdGroup = document.createElement('td');
    const groupText = replacement.group && replacement.group.trim() ? replacement.group : '—';
    const groupClass = replacement.group && replacement.group.trim() ? 'group-name' : 'group-name empty';
    tdGroup.innerHTML = `<span class="cell-text ${groupClass}" title="${escapeHtml(replacement.group || 'Ungrouped')}">${escapeHtml(groupText)}</span>`;
    tr.appendChild(tdGroup);

    // Find column
    const tdFind = document.createElement('td');
    let findContent = `<span class="cell-text" title="${escapeHtml(replacement.textToReplace || '')}">${escapeHtml(replacement.textToReplace || '(empty)')}</span>`;
    if (replacement.wholeWord) findContent += `<span class="whole-word-badge" title="Whole word only">W</span>`;
    if (replacement.isRegex) findContent += `<span class="regex-badge" title="Regex mode">R</span>`;
    tdFind.innerHTML = findContent;
    tr.appendChild(tdFind);

    // Replace column
    const tdReplace = document.createElement('td');
    tdReplace.innerHTML = `<span class="cell-text" title="${escapeHtml(replacement.replacementText || '')}">${escapeHtml(replacement.replacementText || '(empty)')}</span>`;
    tr.appendChild(tdReplace);

    // Scope column
    const tdScope = document.createElement('td');
    const scopeText = replacement.scope && replacement.scope.trim() ? replacement.scope : '—';
    const scopeClass = replacement.scope && replacement.scope.trim() ? 'scope' : 'scope empty';
    tdScope.innerHTML = `<span class="cell-text ${scopeClass}" title="${escapeHtml(replacement.scope || 'All pages')}">${escapeHtml(scopeText)}</span>`;
    tr.appendChild(tdScope);

    // Actions column
    const tdActions = document.createElement('td');
    tdActions.innerHTML = `
      <div class="action-buttons">
        <button class="btn-icon edit-btn" title="Edit" data-index="${index}" aria-label="Edit rule">✎</button>
        <button class="btn-icon delete-btn" title="Delete" data-index="${index}" aria-label="Delete rule">×</button>
      </div>
    `;
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.row-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'));
      replacements[idx].enabled = e.target.checked;
      saveReplacements();
      renderReplacements();
    });
  });

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openModal(parseInt(e.target.getAttribute('data-index')));
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteReplacement(parseInt(e.target.getAttribute('data-index')));
    });
  });
}

function populateGroupSuggestions() {
  const datalist = document.getElementById('groupSuggestions');
  if (!datalist) return;
  datalist.innerHTML = '';
  const groups = new Set();
  replacements.forEach(r => { if (r.group && r.group.trim()) groups.add(r.group.trim()); });
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    datalist.appendChild(opt);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Modal ---

function openModal(index = -1, prefillText) {
  editingIndex = index;
  const modal = document.getElementById('replacementModal');
  const modalTitle = document.getElementById('modalTitle');

  if (index >= 0) {
    modalTitle.textContent = 'Edit Replacement';
    const r = replacements[index];
    document.getElementById('textToReplace').value = r.textToReplace || '';
    document.getElementById('replacementText').value = r.replacementText || '';
    document.getElementById('scope').value = r.scope || '';
    document.getElementById('ruleGroup').value = r.group || '';
    document.getElementById('wholeWord').checked = r.wholeWord || false;
    document.getElementById('isRegex').checked = r.isRegex || false;
  } else {
    modalTitle.textContent = 'Add New Replacement';
    document.getElementById('textToReplace').value = prefillText || '';
    document.getElementById('replacementText').value = '';
    document.getElementById('scope').value = '';
    document.getElementById('ruleGroup').value = '';
    document.getElementById('wholeWord').checked = false;
    document.getElementById('isRegex').checked = false;
  }

  modal.classList.add('active');
  document.getElementById(prefillText ? 'replacementText' : 'textToReplace').focus();
}

function closeModal() {
  document.getElementById('replacementModal').classList.remove('active');
  editingIndex = -1;
}

function saveReplacement() {
  const textToReplace = document.getElementById('textToReplace').value.trim();
  const replacementText = document.getElementById('replacementText').value.trim();
  const scope = document.getElementById('scope').value.trim();
  const group = document.getElementById('ruleGroup').value.trim();
  const wholeWord = document.getElementById('wholeWord').checked;
  const isRegex = document.getElementById('isRegex').checked;

  if (!textToReplace || !replacementText) {
    showToast('Please fill in both "Text to Replace" and "Replacement Text" fields.', 'warning');
    return;
  }

  if (isRegex) {
    try { new RegExp(textToReplace); } catch (e) {
      showToast(`Invalid regex: ${e.message}`, 'error', 5000);
      return;
    }
  }

  const replacement = { textToReplace, replacementText, scope, group, wholeWord, isRegex, enabled: true };

  if (editingIndex >= 0) {
    replacement.enabled = replacements[editingIndex].enabled !== false;
    replacements[editingIndex] = replacement;
    showToast('Replacement updated', 'success');
  } else {
    replacements.push(replacement);
    showToast('Replacement added', 'success');
  }

  saveReplacements();
  renderReplacements();
  closeModal();
}

// --- Delete with undo ---

function deleteReplacement(index) {
  const deleted = replacements.splice(index, 1)[0];
  saveReplacements();
  renderReplacements();

  clearTimeout(_undoTimer);

  showToast('Replacement deleted', 'warning', 5000, 'Undo', () => {
    replacements.splice(index, 0, deleted);
    saveReplacements();
    renderReplacements();
    showToast('Deletion undone', 'success');
  });
}

// --- Export ---

function exportReplacementsJson() {
  if (replacements.length === 0) {
    showToast('No replacements to export.', 'warning');
    return;
  }
  const data = {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    globalEnabled,
    replacements
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `text-replacer-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported as JSON', 'success');
}

function exportReplacementsCsv() {
  if (replacements.length === 0) {
    showToast('No replacements to export.', 'warning');
    return;
  }
  let csv = 'textToReplace,replacementText,scope,group,wholeWord,isRegex,enabled\n';
  replacements.forEach(r => {
    csv += `${escapeCsvField(r.textToReplace || '')},${escapeCsvField(r.replacementText || '')},${escapeCsvField(r.scope || '')},${escapeCsvField(r.group || '')},${r.wholeWord ? 'true' : 'false'},${r.isRegex ? 'true' : 'false'},${r.enabled !== false ? 'true' : 'false'}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `text-replacer-backup-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported as CSV', 'success');
}

function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { fields.push(current); current = ''; }
      else { current += char; }
    }
  }
  fields.push(current);
  return fields;
}

// --- Import ---

function importReplacements(file) {
  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  reader.onload = (e) => {
    try {
      let validReplacements = [];

      if (isCSV) {
        const lines = e.target.result.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          showToast('CSV file is empty or has no data rows.', 'warning');
          return;
        }
        for (let i = 1; i < lines.length; i++) {
          const fields = parseCsvLine(lines[i].trim());
          if (fields.length >= 2 && fields[0]) {
            validReplacements.push({
              textToReplace: fields[0],
              replacementText: fields[1] || '',
              scope: fields[2] || '',
              group: fields[3] || '',
              wholeWord: fields[4] === 'true',
              isRegex: fields[5] === 'true',
              enabled: fields[6] !== 'false'
            });
          }
        }
      } else {
        const data = JSON.parse(e.target.result);
        if (data.replacements && Array.isArray(data.replacements)) {
          validReplacements = data.replacements.filter(r =>
            r && typeof r.textToReplace === 'string' && typeof r.replacementText === 'string'
          ).map(r => ({
            ...r,
            group: r.group || '',
            enabled: r.enabled !== false,
            wholeWord: r.wholeWord || false,
            isRegex: r.isRegex || false
          }));
        } else if (data.codes && Array.isArray(data.codes)) {
          validReplacements = data.codes.filter(r => r && r.code && r.name).map(r => {
            let scope = '';
            if (Array.isArray(r.scope)) scope = r.scope.join(', ');
            else if (r.scope) scope = r.scope;
            return { textToReplace: r.code, replacementText: r.name, scope, group: r.group || '', wholeWord: r.wholeWord || false, isRegex: false, enabled: true };
          });
        } else if (Array.isArray(data)) {
          validReplacements = data.filter(r => (r.textToReplace && r.replacementText) || (r.code && r.name)).map(r => {
            if (r.textToReplace) {
              return { textToReplace: r.textToReplace, replacementText: r.replacementText, scope: r.scope || '', group: r.group || '', wholeWord: r.wholeWord || false, isRegex: r.isRegex || false, enabled: r.enabled !== false };
            }
            return { textToReplace: r.code, replacementText: r.name, scope: '', group: '', wholeWord: false, isRegex: false, enabled: true };
          });
        } else {
          showToast('Invalid file format. Expected "replacements" or "codes" array.', 'error');
          return;
        }
      }

      if (validReplacements.length === 0) {
        showToast('No valid replacements found in the file.', 'warning');
        return;
      }

      const action = confirm(
        `Found ${validReplacements.length} replacement(s).\n\nOK = REPLACE all existing.\nCancel = MERGE with existing.`
      );

      if (action) {
        replacements = validReplacements;
      } else {
        replacements = [...replacements, ...validReplacements];
      }

      saveReplacements();
      renderReplacements();
      showToast(`Imported ${validReplacements.length} replacement(s)`, 'success');
    } catch (error) {
      console.error('Import error:', error);
      showToast('Error reading file. Ensure it\'s valid JSON or CSV.', 'error');
    }
  };

  reader.onerror = () => {
    showToast('Error reading file.', 'error');
  };

  reader.readAsText(file);
}

// --- Initialize ---

document.addEventListener('DOMContentLoaded', () => {
  loadReplacements();

  document.getElementById('globalToggle').addEventListener('change', (e) => {
    globalEnabled = e.target.checked;
    saveReplacements();
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderReplacements();
  });

  document.getElementById('addReplacementBtn').addEventListener('click', () => openModal());

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveReplacement);

  document.getElementById('replacementModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('replacementModal')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('replacementModal').classList.contains('active')) {
      closeModal();
    }
  });

  document.getElementById('exportJsonBtn').addEventListener('click', exportReplacementsJson);
  document.getElementById('exportCsvBtn').addEventListener('click', exportReplacementsCsv);

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importReplacements(file);
      e.target.value = '';
    }
  });
});
