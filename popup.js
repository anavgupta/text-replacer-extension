// Popup script for managing text replacements

let replacements = [];
let editingIndex = -1;
let globalEnabled = true;
let searchTerm = '';

// Load replacements and settings from storage
function loadReplacements() {
  chrome.storage.sync.get(['replacements', 'globalEnabled'], (result) => {
    replacements = result.replacements || [];
    globalEnabled = result.globalEnabled !== false; // Default to true
    document.getElementById('globalToggle').checked = globalEnabled;
    renderReplacements();
    updateBadge();
  });
}

// Save replacements to storage
function saveReplacements() {
  chrome.storage.sync.set({ replacements, globalEnabled }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving replacements:', chrome.runtime.lastError);
      alert('Error saving replacements. Please try again.');
    } else {
      updateBadge();
      // Notify content scripts to update
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('edge://')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateReplacements' }).catch(() => {
            // Content script might not be ready
          });
        }
      });
    }
  });
}

// Update badge with count of enabled replacements
function updateBadge() {
  const enabledCount = globalEnabled ? replacements.filter(r => r.enabled !== false).length : 0;
  chrome.runtime.sendMessage({ action: 'updateBadge', count: enabledCount });
}

// Render all replacements as table rows
function renderReplacements() {
  const tbody = document.getElementById('replacementsList');
  const table = document.getElementById('replacementsTable');
  const emptyState = document.getElementById('emptyState');
  const noResults = document.getElementById('noResults');
  const countLabel = document.getElementById('countLabel');
  
  // Update count
  const enabledCount = replacements.filter(r => r.enabled !== false).length;
  countLabel.textContent = `${enabledCount}/${replacements.length} active`;
  
  if (replacements.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.add('show');
    noResults.classList.remove('show');
    return;
  }

  // Filter by search term
  const filteredReplacements = replacements.map((r, i) => ({ ...r, originalIndex: i }))
    .filter(r => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (r.textToReplace || '').toLowerCase().includes(term) ||
             (r.replacementText || '').toLowerCase().includes(term) ||
             (r.scope || '').toLowerCase().includes(term);
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
    tdToggle.innerHTML = `<input type="checkbox" class="row-toggle" data-index="${index}" ${isEnabled ? 'checked' : ''}>`;
    tr.appendChild(tdToggle);
    
    // Find column
    const tdFind = document.createElement('td');
    let findContent = `<span class="cell-text" title="${escapeHtml(replacement.textToReplace || '')}">${escapeHtml(replacement.textToReplace || '(empty)')}</span>`;
    if (replacement.wholeWord) {
      findContent += `<span class="whole-word-badge" title="Whole word only">W</span>`;
    }
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
        <button class="btn-icon edit-btn" title="Edit" data-index="${index}">✎</button>
        <button class="btn-icon delete-btn" title="Delete" data-index="${index}">×</button>
      </div>
    `;
    tr.appendChild(tdActions);
    
    tbody.appendChild(tr);
  });
  
  // Add event listeners for toggles
  tbody.querySelectorAll('.row-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      replacements[index].enabled = e.target.checked;
      saveReplacements();
      renderReplacements();
    });
  });
  
  // Add event listeners for edit buttons
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      openModal(index);
    });
  });
  
  // Add event listeners for delete buttons
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      deleteReplacement(index);
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open modal for adding/editing
function openModal(index = -1) {
  editingIndex = index;
  const modal = document.getElementById('replacementModal');
  const modalTitle = document.getElementById('modalTitle');
  
  if (index >= 0) {
    // Editing existing replacement
    modalTitle.textContent = 'Edit Replacement';
    const replacement = replacements[index];
    document.getElementById('textToReplace').value = replacement.textToReplace || '';
    document.getElementById('replacementText').value = replacement.replacementText || '';
    document.getElementById('scope').value = replacement.scope || '';
    document.getElementById('wholeWord').checked = replacement.wholeWord || false;
  } else {
    // Adding new replacement
    modalTitle.textContent = 'Add New Replacement';
    document.getElementById('textToReplace').value = '';
    document.getElementById('replacementText').value = '';
    document.getElementById('scope').value = '';
    document.getElementById('wholeWord').checked = false;
  }
  
  modal.classList.add('active');
  document.getElementById('textToReplace').focus();
}

// Close modal
function closeModal() {
  const modal = document.getElementById('replacementModal');
  modal.classList.remove('active');
  editingIndex = -1;
}

// Save replacement from modal
function saveReplacement() {
  const textToReplace = document.getElementById('textToReplace').value.trim();
  const replacementText = document.getElementById('replacementText').value.trim();
  const scope = document.getElementById('scope').value.trim();
  const wholeWord = document.getElementById('wholeWord').checked;
  
  if (!textToReplace || !replacementText) {
    alert('Please fill in both "Text to Replace" and "Replacement Text" fields.');
    return;
  }
  
  const replacement = {
    textToReplace,
    replacementText,
    scope,
    wholeWord,
    enabled: true
  };
  
  if (editingIndex >= 0) {
    // Preserve enabled state when editing
    replacement.enabled = replacements[editingIndex].enabled !== false;
    replacements[editingIndex] = replacement;
  } else {
    // Add new
    replacements.push(replacement);
  }
  
  saveReplacements();
  renderReplacements();
  closeModal();
}

// Delete a replacement
function deleteReplacement(index) {
  if (confirm('Delete this replacement?')) {
    replacements.splice(index, 1);
    saveReplacements();
    renderReplacements();
  }
}

// Export replacements to JSON file
function exportReplacementsJson() {
  if (replacements.length === 0) {
    alert('No replacements to export.');
    return;
  }
  
  const data = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    globalEnabled: globalEnabled,
    replacements: replacements
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
}

// Export replacements to CSV file
function exportReplacementsCsv() {
  if (replacements.length === 0) {
    alert('No replacements to export.');
    return;
  }
  
  // CSV header
  let csv = 'textToReplace,replacementText,scope,wholeWord,enabled\n';
  
  // Add each replacement as a row
  replacements.forEach(r => {
    const textToReplace = escapeCsvField(r.textToReplace || '');
    const replacementText = escapeCsvField(r.replacementText || '');
    const scope = escapeCsvField(r.scope || '');
    const wholeWord = r.wholeWord ? 'true' : 'false';
    const enabled = r.enabled !== false ? 'true' : 'false';
    csv += `${textToReplace},${replacementText},${scope},${wholeWord},${enabled}\n`;
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
}

// Escape CSV field (handle commas, quotes, newlines)
function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

// Parse CSV field (handle quoted fields)
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  
  return fields;
}

// Import replacements from file (JSON or CSV)
function importReplacements(file) {
  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  
  reader.onload = (e) => {
    try {
      let validReplacements = [];
      
      if (isCSV) {
        // Parse CSV
        const lines = e.target.result.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('CSV file is empty or has no data rows.');
          return;
        }
        
        // Skip header row, process data rows
        for (let i = 1; i < lines.length; i++) {
          const fields = parseCsvLine(lines[i].trim());
          if (fields.length >= 2 && fields[0]) {
            validReplacements.push({
              textToReplace: fields[0],
              replacementText: fields[1] || '',
              scope: fields[2] || '',
              wholeWord: fields[3] === 'true',
              enabled: fields[4] !== 'false'
            });
          }
        }
      } else {
        // Parse JSON
        const data = JSON.parse(e.target.result);
        
        // Check for different JSON formats
        if (data.replacements && Array.isArray(data.replacements)) {
          // Standard backup format
          validReplacements = data.replacements.filter(r => 
            r && typeof r.textToReplace === 'string' && typeof r.replacementText === 'string'
          ).map(r => ({
            ...r,
            enabled: r.enabled !== false,
            wholeWord: r.wholeWord || false
          }));
        } else if (data.codes && Array.isArray(data.codes)) {
          // Codes format: { codes: [{code, name, scope?}] }
          validReplacements = data.codes
            .filter(r => r && r.code && r.name)
            .map(r => {
              let scope = '';
              if (Array.isArray(r.scope)) {
                scope = r.scope.join(', ');
              } else if (r.scope) {
                scope = r.scope;
              }
              return {
                textToReplace: r.code,
                replacementText: r.name,
                scope: scope,
                wholeWord: r.wholeWord || false,
                enabled: true
              };
            });
        } else if (Array.isArray(data)) {
          // Plain array format
          validReplacements = data.filter(r => {
            if (r.textToReplace && r.replacementText) return true;
            if (r.code && r.name) return true;
            return false;
          }).map(r => {
            if (r.textToReplace) {
              return { 
                textToReplace: r.textToReplace, 
                replacementText: r.replacementText, 
                scope: r.scope || '',
                wholeWord: r.wholeWord || false,
                enabled: r.enabled !== false
              };
            } else {
              return { 
                textToReplace: r.code, 
                replacementText: r.name, 
                scope: '',
                wholeWord: false,
                enabled: true
              };
            }
          });
        } else {
          alert('Invalid backup file format. Expected "replacements" or "codes" array.');
          return;
        }
      }
      
      if (validReplacements.length === 0) {
        alert('No valid replacements found in the backup file.');
        return;
      }
      
      // Ask user how to handle import
      const action = confirm(
        `Found ${validReplacements.length} replacement(s) in backup.\n\n` +
        `Click OK to REPLACE all existing replacements.\n` +
        `Click Cancel to MERGE with existing replacements.`
      );
      
      if (action) {
        // Replace all
        replacements = validReplacements;
      } else {
        // Merge (add new ones)
        replacements = [...replacements, ...validReplacements];
      }
      
      saveReplacements();
      renderReplacements();
      alert(`Successfully imported ${validReplacements.length} replacement(s).`);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Error reading backup file. Please make sure it\'s a valid JSON or CSV file.');
    }
  };
  
  reader.onerror = () => {
    alert('Error reading file.');
  };
  
  reader.readAsText(file);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadReplacements();
  
  // Global toggle handler
  document.getElementById('globalToggle').addEventListener('change', (e) => {
    globalEnabled = e.target.checked;
    saveReplacements();
  });
  
  // Search input handler
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderReplacements();
  });
  
  // Add button click handler
  document.getElementById('addReplacementBtn').addEventListener('click', () => {
    openModal();
  });
  
  // Modal close handlers
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveReplacement);
  
  // Close modal on background click
  document.getElementById('replacementModal').addEventListener('click', (e) => {
    if (e.target.id === 'replacementModal') {
      closeModal();
    }
  });
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
  
  // Export button handlers
  document.getElementById('exportJsonBtn').addEventListener('click', exportReplacementsJson);
  document.getElementById('exportCsvBtn').addEventListener('click', exportReplacementsCsv);
  
  // Import button handler
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  // File input handler
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importReplacements(file);
      e.target.value = ''; // Reset file input
    }
  });
});
