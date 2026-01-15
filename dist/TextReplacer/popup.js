// Popup script for managing text replacements

let replacements = [];
let editingIndex = -1;

// Load replacements from storage
function loadReplacements() {
  chrome.storage.sync.get(['replacements'], (result) => {
    replacements = result.replacements || [];
    renderReplacements();
  });
}

// Save replacements to storage
function saveReplacements() {
  chrome.storage.sync.set({ replacements }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving replacements:', chrome.runtime.lastError);
      alert('Error saving replacements. Please try again.');
    } else {
      // Notify content scripts to update (storage.onChanged will also trigger this)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('edge://')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateReplacements' }).catch(() => {
            // Content script might not be ready, that's okay - storage.onChanged will handle it
          });
        }
      });
    }
  });
}

// Render all replacements
function renderReplacements() {
  const container = document.getElementById('replacementsList');
  const template = document.getElementById('replacementTemplate');
  
  if (replacements.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No replacements configured.<br>Click "Add New Replacement" to create one.</p></div>';
    return;
  }

  container.innerHTML = '';
  
  replacements.forEach((replacement, index) => {
    const clone = template.content.cloneNode(true);
    
    // Set replacement number
    clone.querySelector('.replacement-number').textContent = `Replacement ${index + 1}`;
    
    // Set preview text
    const preview = clone.querySelector('.replacement-preview');
    if (replacement.textToReplace && replacement.replacementText) {
      preview.textContent = `"${replacement.textToReplace}" → "${replacement.replacementText}"`;
    } else {
      preview.textContent = 'Incomplete replacement';
      preview.style.color = '#ff9800';
    }
    
    // Set detail values
    clone.querySelector('[data-field="textToReplace"]').textContent = replacement.textToReplace || '(empty)';
    clone.querySelector('[data-field="replacementText"]').textContent = replacement.replacementText || '(empty)';
    
    const scopeRow = clone.querySelector('[data-scope-row]');
    const scopeValue = clone.querySelector('[data-field="scope"]');
    if (replacement.scope && replacement.scope.trim()) {
      scopeValue.textContent = replacement.scope;
    } else {
      scopeRow.style.display = 'none';
    }
    
    // Add edit button handler
    clone.querySelector('.edit-btn').addEventListener('click', () => {
      openModal(index);
    });
    
    // Add delete button handler
    clone.querySelector('.delete-btn').addEventListener('click', () => {
      deleteReplacement(index);
    });
    
    container.appendChild(clone);
  });
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
  } else {
    // Adding new replacement
    modalTitle.textContent = 'Add New Replacement';
    document.getElementById('textToReplace').value = '';
    document.getElementById('replacementText').value = '';
    document.getElementById('scope').value = '';
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
  
  if (!textToReplace || !replacementText) {
    alert('Please fill in both "Text to Replace" and "Replacement Text" fields.');
    return;
  }
  
  const replacement = {
    textToReplace,
    replacementText,
    scope
  };
  
  if (editingIndex >= 0) {
    // Update existing
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
  if (confirm('Are you sure you want to delete this replacement?')) {
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
  let csv = 'textToReplace,replacementText,scope\n';
  
  // Add each replacement as a row
  replacements.forEach(r => {
    const textToReplace = escapeCsvField(r.textToReplace || '');
    const replacementText = escapeCsvField(r.replacementText || '');
    const scope = escapeCsvField(r.scope || '');
    csv += `${textToReplace},${replacementText},${scope}\n`;
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
              scope: fields[2] || ''
            });
          }
        }
      } else {
        // Parse JSON
        const data = JSON.parse(e.target.result);
        
        // Check for different JSON formats
        if (data.replacements && Array.isArray(data.replacements)) {
          // Standard backup format: { replacements: [{textToReplace, replacementText, scope}] }
          validReplacements = data.replacements.filter(r => 
            r && typeof r.textToReplace === 'string' && typeof r.replacementText === 'string'
          );
        } else if (data.codes && Array.isArray(data.codes)) {
          // Codes format: { codes: [{code, name}] } - replace code with name only
          validReplacements = data.codes
            .filter(r => r && r.code && r.name)
            .map(r => ({
              textToReplace: r.code,
              replacementText: r.name,
              scope: ''
            }));
        } else if (Array.isArray(data)) {
          // Plain array format
          validReplacements = data.filter(r => {
            if (r.textToReplace && r.replacementText) return true;
            if (r.code && r.name) return true;
            return false;
          }).map(r => {
            if (r.textToReplace) {
              return { textToReplace: r.textToReplace, replacementText: r.replacementText, scope: r.scope || '' };
            } else {
              return { textToReplace: r.code, replacementText: r.name, scope: '' };
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
