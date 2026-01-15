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
});
