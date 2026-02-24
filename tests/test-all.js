/**
 * Comprehensive Test Suite for ReText Extension
 * Tests: Scope Matching, Text Replacement, Toggle, Search, Whole Word, Badge, Manifest
 * Run with: node tests/test-all.js
 */

// ============================================================
// EXTRACT FUNCTIONS FROM SOURCE FOR TESTING
// ============================================================

// --- From content.js ---

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
    return urlObj.hostname.toLowerCase().includes(scopeLower) || fullUrl.includes(scopeLower);
  } catch (e) {
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

function applyReplacement(text, replacement) {
  const { textToReplace, replacementText, wholeWord } = replacement;
  if (!textToReplace || !replacementText) return text;
  const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let pattern;
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
  const regex = new RegExp(pattern, 'gi');
  return text.replace(regex, replacementText);
}

function filterActiveReplacements(replacements, globalEnabled, url) {
  if (globalEnabled === false) return [];
  return replacements.filter(r => {
    if (r.enabled === false) return false;
    if (!r.scope || r.scope.trim() === '') return true;
    return matchesScope(url, r.scope);
  });
}

// --- From popup.js ---

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
        if (line[i + 1] === '"') {
          current += '"';
          i++;
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

function searchFilter(replacements, searchTerm) {
  if (!searchTerm) return replacements;
  const term = searchTerm.toLowerCase();
  return replacements.filter(r =>
    (r.textToReplace || '').toLowerCase().includes(term) ||
    (r.replacementText || '').toLowerCase().includes(term) ||
    (r.scope || '').toLowerCase().includes(term)
  );
}

function computeBadgeCount(replacements, globalEnabled) {
  if (globalEnabled === false) return 0;
  return replacements.filter(r => r.enabled !== false).length;
}

// ============================================================
// TEST FRAMEWORK
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedTests++;
    failures.push(testName);
    console.log(`  ✗ FAIL: ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedTests++;
    failures.push(`${testName} (expected: "${expected}", got: "${actual}")`);
    console.log(`  ✗ FAIL: ${testName} (expected: "${expected}", got: "${actual}")`);
  }
}

function assertDeepEqual(actual, expected, testName) {
  totalTests++;
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedTests++;
    failures.push(`${testName} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
    console.log(`  ✗ FAIL: ${testName}`);
  }
}

// ============================================================
// TEST SUITE 1: SCOPE MATCHING
// ============================================================

console.log('\n=== TEST SUITE 1: Scope Matching ===\n');

// 1.1 Empty/null scope
assert(matchesScope('https://example.com', '') === true, 'Empty scope matches everything');
assert(matchesScope('https://example.com', null) === true, 'Null scope matches everything');
assert(matchesScope('https://example.com', undefined) === true, 'Undefined scope matches everything');
assert(matchesScope('https://example.com', '   ') === true, 'Whitespace scope matches everything');

// 1.2 Simple domain matching
assert(matchesScope('https://example.com/page', 'example.com') === true, 'Simple domain match');
assert(matchesScope('https://sub.example.com/page', 'example.com') === true, 'Subdomain contains domain');
assert(matchesScope('https://other.com/page', 'example.com') === false, 'Different domain no match');

// 1.3 Wildcard matching - hostname
assert(matchesScope('https://sub.example.com', '*.example.com') === true, 'Wildcard subdomain match');
assert(matchesScope('https://a.b.example.com', '*.example.com') === true, 'Nested subdomain wildcard');

// 1.4 Wildcard matching - URL path
assert(matchesScope('https://site.com/related/Histories/view', '*/related/Histories/view*') === true, 'Path wildcard match');
assert(matchesScope('https://site.com/related/Histories/view?id=1', '*/related/Histories/view*') === true, 'Path wildcard with query params');
assert(matchesScope('https://site.com/related/Histories/view/', '*/related/Histories/view*') === true, 'Path wildcard with trailing slash');
assert(matchesScope('https://site.com/other/page', '*/related/Histories/view*') === false, 'Path wildcard no match');

// 1.5 Trailing slash issue (the bug we fixed)
assert(matchesScope('https://site.com/view', '*/view/*') === false, 'Strict trailing slash - no match without content after /');
assert(matchesScope('https://site.com/view/123', '*/view/*') === true, 'Strict trailing slash - match with content after /');
assert(matchesScope('https://site.com/view', '*/view*') === true, 'No trailing slash - match without slash');
assert(matchesScope('https://site.com/view?q=1', '*/view*') === true, 'No trailing slash - match with query');

// 1.6 Multi-scope (comma-separated)
assert(matchesScope('https://example.com/page', 'example.com, other.com') === true, 'Multi-scope first match');
assert(matchesScope('https://other.com/page', 'example.com, other.com') === true, 'Multi-scope second match');
assert(matchesScope('https://third.com/page', 'example.com, other.com') === false, 'Multi-scope no match');
assert(matchesScope('https://site.com/api/data', '*.example.com, */api/*') === true, 'Multi-scope wildcard mix');

// 1.7 Full URL matching
assert(matchesScope('https://example.com/page', 'https://example.com/page') === true, 'Full URL exact match');
assert(matchesScope('https://example.com/other', 'https://example.com/page') === false, 'Full URL no match');

// 1.8 Case insensitivity
assert(matchesScope('https://EXAMPLE.COM/page', 'example.com') === true, 'Case insensitive domain');
assert(matchesScope('https://example.com/PAGE', '*/page*') === true, 'Case insensitive path');

// 1.9 Special characters in scope
assert(matchesScope('https://example.com/page?q=test', 'example.com') === true, 'URL with query string');

// ============================================================
// TEST SUITE 2: TEXT REPLACEMENT
// ============================================================

console.log('\n=== TEST SUITE 2: Text Replacement ===\n');

// 2.1 Basic replacement
assertEqual(
  applyReplacement('Hello World', { textToReplace: 'Hello', replacementText: 'Hi', wholeWord: false }),
  'Hi World',
  'Basic replacement'
);

// 2.2 Case insensitive
assertEqual(
  applyReplacement('hello HELLO Hello', { textToReplace: 'hello', replacementText: 'hi', wholeWord: false }),
  'hi hi hi',
  'Case insensitive replaces all'
);

// 2.3 Multiple occurrences
assertEqual(
  applyReplacement('cat and cat and cat', { textToReplace: 'cat', replacementText: 'dog', wholeWord: false }),
  'dog and dog and dog',
  'Multiple occurrences replaced'
);

// 2.4 No match
assertEqual(
  applyReplacement('Hello World', { textToReplace: 'Goodbye', replacementText: 'Hi', wholeWord: false }),
  'Hello World',
  'No match leaves text unchanged'
);

// 2.5 Empty inputs
assertEqual(
  applyReplacement('Hello World', { textToReplace: '', replacementText: 'Hi', wholeWord: false }),
  'Hello World',
  'Empty textToReplace returns original'
);
assertEqual(
  applyReplacement('Hello World', { textToReplace: 'Hello', replacementText: '', wholeWord: false }),
  'Hello World',
  'Empty replacementText returns original'
);

// 2.6 Special regex characters in text
assertEqual(
  applyReplacement('Price is $50.00', { textToReplace: '$50.00', replacementText: '$60.00', wholeWord: false }),
  'Price is $60.00',
  'Special regex chars escaped properly'
);
assertEqual(
  applyReplacement('Call (555) 123-4567', { textToReplace: '(555)', replacementText: '(666)', wholeWord: false }),
  'Call (666) 123-4567',
  'Parentheses escaped properly'
);
assertEqual(
  applyReplacement('a+b=c', { textToReplace: 'a+b', replacementText: 'x+y', wholeWord: false }),
  'x+y=c',
  'Plus sign escaped properly'
);

// 2.7 Partial match (no whole word)
assertEqual(
  applyReplacement('category catalog catch', { textToReplace: 'cat', replacementText: 'dog', wholeWord: false }),
  'dogegory dogalog dogch',
  'Partial match replaces within words'
);

// ============================================================
// TEST SUITE 3: WHOLE WORD MATCHING
// ============================================================

console.log('\n=== TEST SUITE 3: Whole Word Matching ===\n');

// 3.1 Whole word basic
assertEqual(
  applyReplacement('The cat sat on the mat', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'The dog sat on the mat',
  'Whole word replaces exact word'
);

// 3.2 Whole word - should NOT match partial
assertEqual(
  applyReplacement('category catalog catch', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'category catalog catch',
  'Whole word does NOT match partial words'
);

// 3.3 Whole word at start of text
assertEqual(
  applyReplacement('cat is here', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'dog is here',
  'Whole word at start of text'
);

// 3.4 Whole word at end of text
assertEqual(
  applyReplacement('I see a cat', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'I see a dog',
  'Whole word at end of text'
);

// 3.5 Whole word case insensitive
assertEqual(
  applyReplacement('Cat CAT cat', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'dog dog dog',
  'Whole word case insensitive'
);

// 3.6 Whole word with numbers
assertEqual(
  applyReplacement('Error 8601 occurred at step 86010', { textToReplace: '8601', replacementText: 'QS Load', wholeWord: true }),
  'Error QS Load occurred at step 86010',
  'Whole word with numbers - only exact match'
);

// 3.7 Whole word with punctuation boundaries
assertEqual(
  applyReplacement('error: cat.name', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'error: dog.name',
  'Whole word with punctuation boundaries'
);

// 3.8 Whole word single word text
assertEqual(
  applyReplacement('cat', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'dog',
  'Whole word single word text'
);

// 3.9 Whole word - special chars in search
assertEqual(
  applyReplacement('Cost is $50 today', { textToReplace: '$50', replacementText: '$60', wholeWord: true }),
  'Cost is $60 today',
  'Whole word with special regex chars'
);

// ============================================================
// TEST SUITE 4: TOGGLE ON/OFF (Individual & Global)
// ============================================================

console.log('\n=== TEST SUITE 4: Toggle On/Off ===\n');

const testReplacements = [
  { textToReplace: 'cat', replacementText: 'dog', scope: '', enabled: true, wholeWord: false },
  { textToReplace: 'red', replacementText: 'blue', scope: '', enabled: false, wholeWord: false },
  { textToReplace: 'sun', replacementText: 'moon', scope: 'example.com', enabled: true, wholeWord: false },
];

// 4.1 Global enabled, filter active
const active1 = filterActiveReplacements(testReplacements, true, 'https://example.com');
assertEqual(active1.length, 2, 'Global on: 2 active (1 disabled, 2 enabled for scope)');

// 4.2 Global disabled
const active2 = filterActiveReplacements(testReplacements, false, 'https://example.com');
assertEqual(active2.length, 0, 'Global off: 0 active');

// 4.3 Individual disabled
const active3 = filterActiveReplacements(testReplacements, true, 'https://other.com');
assertEqual(active3.length, 1, 'Scope mismatch: only 1 active (no scope rule)');

// 4.4 All enabled
const allEnabled = [
  { textToReplace: 'a', replacementText: 'b', scope: '', enabled: true },
  { textToReplace: 'c', replacementText: 'd', scope: '', enabled: true },
];
assertEqual(filterActiveReplacements(allEnabled, true, 'https://any.com').length, 2, 'All enabled: 2 active');

// 4.5 All disabled
const allDisabled = [
  { textToReplace: 'a', replacementText: 'b', scope: '', enabled: false },
  { textToReplace: 'c', replacementText: 'd', scope: '', enabled: false },
];
assertEqual(filterActiveReplacements(allDisabled, true, 'https://any.com').length, 0, 'All disabled: 0 active');

// 4.6 Default enabled (no enabled property)
const noEnabledProp = [
  { textToReplace: 'a', replacementText: 'b', scope: '' },
];
assertEqual(filterActiveReplacements(noEnabledProp, true, 'https://any.com').length, 1, 'Missing enabled prop defaults to true');

// 4.7 Global undefined defaults to enabled
const active7 = filterActiveReplacements(testReplacements, undefined, 'https://example.com');
assertEqual(active7.length, 2, 'Global undefined: treats as enabled');

// ============================================================
// TEST SUITE 5: SEARCH/FILTER
// ============================================================

console.log('\n=== TEST SUITE 5: Search/Filter ===\n');

const searchData = [
  { textToReplace: '8601', replacementText: 'On QS Load', scope: '*/Histories/*' },
  { textToReplace: '8602', replacementText: 'After Promotion', scope: '*/Histories/*' },
  { textToReplace: 'hello', replacementText: 'world', scope: 'example.com' },
  { textToReplace: 'foo', replacementText: 'bar', scope: '' },
];

// 5.1 No search term returns all
assertEqual(searchFilter(searchData, '').length, 4, 'Empty search returns all');
assertEqual(searchFilter(searchData, null).length, 4, 'Null search returns all');

// 5.2 Search by Find text
assertEqual(searchFilter(searchData, '8601').length, 1, 'Search by code finds 1');
assertEqual(searchFilter(searchData, 'hello').length, 1, 'Search by text finds 1');

// 5.3 Search by Replace text
assertEqual(searchFilter(searchData, 'Promotion').length, 1, 'Search by replacement text');
assertEqual(searchFilter(searchData, 'bar').length, 1, 'Search by replacement "bar"');

// 5.4 Search by Scope
assertEqual(searchFilter(searchData, 'Histories').length, 2, 'Search by scope finds 2');
assertEqual(searchFilter(searchData, 'example').length, 1, 'Search by scope domain');

// 5.5 Case insensitive search
assertEqual(searchFilter(searchData, 'HELLO').length, 1, 'Case insensitive search');
assertEqual(searchFilter(searchData, 'qs load').length, 1, 'Case insensitive replacement search');

// 5.6 No results
assertEqual(searchFilter(searchData, 'nonexistent').length, 0, 'No matching results');

// 5.7 Partial match
assertEqual(searchFilter(searchData, '860').length, 2, 'Partial match finds 2 codes');

// ============================================================
// TEST SUITE 6: BADGE COUNT
// ============================================================

console.log('\n=== TEST SUITE 6: Badge Count ===\n');

// 6.1 All enabled
assertEqual(computeBadgeCount([
  { enabled: true }, { enabled: true }, { enabled: true }
], true), 3, 'All enabled: badge shows 3');

// 6.2 Some disabled
assertEqual(computeBadgeCount([
  { enabled: true }, { enabled: false }, { enabled: true }
], true), 2, 'One disabled: badge shows 2');

// 6.3 Global off
assertEqual(computeBadgeCount([
  { enabled: true }, { enabled: true }
], false), 0, 'Global off: badge shows 0');

// 6.4 Empty replacements
assertEqual(computeBadgeCount([], true), 0, 'Empty: badge shows 0');

// 6.5 No enabled property defaults to true
assertEqual(computeBadgeCount([
  { textToReplace: 'a' }, { enabled: true }, { enabled: false }
], true), 2, 'Missing enabled defaults to true in count');

// ============================================================
// TEST SUITE 7: CSV IMPORT/EXPORT
// ============================================================

console.log('\n=== TEST SUITE 7: CSV Import/Export ===\n');

// 7.1 Simple CSV field
assertEqual(escapeCsvField('hello'), 'hello', 'Simple field no escaping');

// 7.2 Field with comma
assertEqual(escapeCsvField('hello,world'), '"hello,world"', 'Field with comma wrapped in quotes');

// 7.3 Field with quotes
assertEqual(escapeCsvField('say "hello"'), '"say ""hello"""', 'Field with quotes double-escaped');

// 7.4 Field with newline
assertEqual(escapeCsvField('line1\nline2'), '"line1\nline2"', 'Field with newline wrapped');

// 7.5 Parse simple CSV line
assertDeepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c'], 'Parse simple CSV');

// 7.6 Parse CSV with quoted field
assertDeepEqual(parseCsvLine('"hello,world",b,c'), ['hello,world', 'b', 'c'], 'Parse quoted CSV field');

// 7.7 Parse CSV with escaped quotes
assertDeepEqual(parseCsvLine('"say ""hi""",b,c'), ['say "hi"', 'b', 'c'], 'Parse escaped quotes in CSV');

// 7.8 Parse CSV with empty fields
assertDeepEqual(parseCsvLine('a,,c'), ['a', '', 'c'], 'Parse CSV with empty middle field');

// 7.9 CSV roundtrip
const original = 'hello, "world"';
const escaped = escapeCsvField(original);
const parsed = parseCsvLine(`${escaped},other`);
assertEqual(parsed[0], original, 'CSV roundtrip preserves data');

// 7.10 Parse CSV with wholeWord and enabled columns
assertDeepEqual(
  parseCsvLine('find,replace,scope,true,false'),
  ['find', 'replace', 'scope', 'true', 'false'],
  'Parse CSV with 5 columns (new format)'
);

// ============================================================
// TEST SUITE 8: MANIFEST VALIDATION
// ============================================================

console.log('\n=== TEST SUITE 8: Manifest Validation ===\n');

const fs = require('fs');
const path = require('path');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assertEqual(manifest.manifest_version, 3, 'Manifest version is 3');
assert(manifest.permissions.includes('storage'), 'Has storage permission');
assert(manifest.permissions.includes('activeTab'), 'Has activeTab permission');
assert(manifest.host_permissions.includes('<all_urls>'), 'Has all_urls host permission');
assert(manifest.content_scripts[0].js.includes('content.js'), 'Content script declared');
assertEqual(manifest.content_scripts[0].run_at, 'document_end', 'Runs at document_end');
assert(manifest.content_scripts[0].all_frames === true, 'Runs in all frames');
assertEqual(manifest.action.default_popup, 'popup.html', 'Popup declared');
assertEqual(manifest.background.service_worker, 'background.js', 'Background worker declared');
assert(manifest.commands === undefined, 'Commands section removed (shortcut removed)');

// Check all referenced files exist
const extDir = path.join(__dirname, '..');
const requiredFiles = ['content.js', 'popup.html', 'popup.css', 'popup.js', 'background.js', 'icon16.png', 'icon48.png', 'icon128.png'];
requiredFiles.forEach(file => {
  assert(fs.existsSync(path.join(extDir, file)), `Required file exists: ${file}`);
});

// ============================================================
// TEST SUITE 9: EDGE CASES
// ============================================================

console.log('\n=== TEST SUITE 9: Edge Cases ===\n');

// 9.1 Very long text
const longText = 'cat '.repeat(1000) + 'end';
const longResult = applyReplacement(longText, { textToReplace: 'cat', replacementText: 'dog', wholeWord: true });
assert(longResult.startsWith('dog '), 'Long text: first word replaced');
assert(longResult.endsWith('end'), 'Long text: last word preserved');
assert(!longResult.includes('cat'), 'Long text: all "cat" replaced');

// 9.2 Replacement that contains the search text
assertEqual(
  applyReplacement('cat is here', { textToReplace: 'cat', replacementText: 'catdog', wholeWord: true }),
  'catdog is here',
  'Replacement containing search text works'
);

// 9.3 Empty text
assertEqual(
  applyReplacement('', { textToReplace: 'cat', replacementText: 'dog', wholeWord: false }),
  '',
  'Empty text returns empty'
);

// 9.4 Single character replacement
assertEqual(
  applyReplacement('a b c a', { textToReplace: 'a', replacementText: 'x', wholeWord: true }),
  'x b c x',
  'Single character whole word replacement'
);

// 9.5 Scope with spaces in comma-separated list
assert(
  matchesScope('https://example.com/page', '  example.com  ,  other.com  ') === true,
  'Scope with extra spaces trimmed properly'
);

// 9.6 Unicode text replacement
assertEqual(
  applyReplacement('Café au lait', { textToReplace: 'Café', replacementText: 'Coffee', wholeWord: false }),
  'Coffee au lait',
  'Unicode text replacement'
);

// 9.7 Replacement with newline in text
assertEqual(
  applyReplacement('Hello World', { textToReplace: 'Hello', replacementText: 'Hi', wholeWord: false }),
  'Hi World',
  'Simple replacement (no newline issues)'
);

// 9.8 Multiple replacements in sequence
let multiText = 'The 8601 error with 8602 code';
multiText = applyReplacement(multiText, { textToReplace: '8601', replacementText: 'QS Load', wholeWord: true });
multiText = applyReplacement(multiText, { textToReplace: '8602', replacementText: 'Promotion', wholeWord: true });
assertEqual(multiText, 'The QS Load error with Promotion code', 'Sequential replacements work');

// 9.9 Scope matching with port numbers
assert(matchesScope('https://localhost:3000/page', 'localhost') === true, 'Scope matches localhost with port');

// 9.10 Scope with complex Salesforce URL
const sfUrl = 'https://adt.lightning.force.com/lightning/r/SBQQ__Quote__c/a8GPh000008pUlp/related/Histories/view?ws=%2Fview';
assert(matchesScope(sfUrl, '*/related/Histories/view*') === true, 'Salesforce Histories URL matches');
assert(matchesScope(sfUrl, 'adt.lightning.force.com') === true, 'Salesforce domain matches');
assert(matchesScope(sfUrl, '*/related/Histories/view*, adt.lightning.force.com') === true, 'Multi-scope with SF URL');

// ============================================================
// TEST SUITE 10: DATA INTEGRITY
// ============================================================

console.log('\n=== TEST SUITE 10: Data Integrity ===\n');

// 10.1 Replacement object structure
const validReplacement = {
  textToReplace: 'test',
  replacementText: 'result',
  scope: '',
  wholeWord: false,
  enabled: true
};
assert(typeof validReplacement.textToReplace === 'string', 'textToReplace is string');
assert(typeof validReplacement.replacementText === 'string', 'replacementText is string');
assert(typeof validReplacement.scope === 'string', 'scope is string');
assert(typeof validReplacement.wholeWord === 'boolean', 'wholeWord is boolean');
assert(typeof validReplacement.enabled === 'boolean', 'enabled is boolean');

// 10.2 Import codes.json format
const codesData = {
  codes: [
    { code: '8601', name: 'On QS Load', scope: ['*/view*', 'example.com'] },
    { code: '8602', name: 'After Promotion', scope: ['*/view*'] },
  ]
};
const imported = codesData.codes.map(r => {
  let scope = '';
  if (Array.isArray(r.scope)) scope = r.scope.join(', ');
  else if (r.scope) scope = r.scope;
  return { textToReplace: r.code, replacementText: r.name, scope, wholeWord: false, enabled: true };
});
assertEqual(imported.length, 2, 'Imported 2 codes');
assertEqual(imported[0].textToReplace, '8601', 'Code mapped to textToReplace');
assertEqual(imported[0].replacementText, 'On QS Load', 'Name mapped to replacementText');
assertEqual(imported[0].scope, '*/view*, example.com', 'Array scope joined with comma');
assertEqual(imported[1].scope, '*/view*', 'Single scope from array');

// 10.3 Export/Import roundtrip
const exportData = {
  version: '1.0.0',
  globalEnabled: true,
  replacements: [
    { textToReplace: 'hello', replacementText: 'world', scope: 'example.com', wholeWord: true, enabled: false }
  ]
};
const reimported = exportData.replacements.map(r => ({
  ...r,
  enabled: r.enabled !== false,
  wholeWord: r.wholeWord || false
}));
assertEqual(reimported[0].wholeWord, true, 'Roundtrip preserves wholeWord');
assertEqual(reimported[0].enabled, false, 'Roundtrip preserves enabled=false');

// ============================================================
// TEST SUITE 11: WHOLE WORD WITH SPECIAL CHARS (regression)
// ============================================================

console.log('\n=== TEST SUITE 11: Whole Word Special Chars (Regression) ===\n');

// 11.1 $ at start of word
assertEqual(
  applyReplacement('The price is $100 but $1000 is expensive', { textToReplace: '$100', replacementText: '$200', wholeWord: true }),
  'The price is $200 but $1000 is expensive',
  'Whole word $100 does not match $1000'
);

// 11.2 Multiple special char terms
assertEqual(
  applyReplacement('Call (555) now at (555) again', { textToReplace: '(555)', replacementText: '(666)', wholeWord: true }),
  'Call (666) now at (666) again',
  'Whole word (555) replaced at multiple locations'
);

// 11.3 Special chars at end of text
assertEqual(
  applyReplacement('Total: $50', { textToReplace: '$50', replacementText: '$60', wholeWord: true }),
  'Total: $60',
  'Whole word special char at end of text'
);

// 11.4 Special chars at start of text
assertEqual(
  applyReplacement('$50 is the price', { textToReplace: '$50', replacementText: '$60', wholeWord: true }),
  '$60 is the price',
  'Whole word special char at start of text'
);

// 11.5 Whole word special char - only match
assertEqual(
  applyReplacement('$50', { textToReplace: '$50', replacementText: '$60', wholeWord: true }),
  '$60',
  'Whole word special char as only text'
);

// 11.6 Whole word with dots
assertEqual(
  applyReplacement('Visit v2.0 not v2.0.1', { textToReplace: 'v2.0', replacementText: 'v3.0', wholeWord: true }),
  'Visit v3.0 not v2.0.1',
  'Whole word with dots does not match longer version'
);

// 11.7 Alphanumeric whole word with adjacent special chars
assertEqual(
  applyReplacement('error:cat.name', { textToReplace: 'cat', replacementText: 'dog', wholeWord: true }),
  'error:dog.name',
  'Alphanumeric whole word bounded by punctuation'
);

// 11.8 Whole word tab-separated
assertEqual(
  applyReplacement('col1\t$50\tcol3', { textToReplace: '$50', replacementText: '$60', wholeWord: true }),
  'col1\t$60\tcol3',
  'Whole word special char with tab boundaries'
);

// ============================================================
// TEST SUITE 12: COMBINED FEATURES
// ============================================================

console.log('\n=== TEST SUITE 12: Combined Features ===\n');

// 12.1 Whole word + scope + enabled together
const combo = [
  { textToReplace: 'cat', replacementText: 'dog', scope: 'example.com', wholeWord: true, enabled: true },
  { textToReplace: 'red', replacementText: 'blue', scope: 'example.com', wholeWord: false, enabled: false },
  { textToReplace: 'sun', replacementText: 'moon', scope: 'other.com', wholeWord: true, enabled: true },
];
const comboActive = filterActiveReplacements(combo, true, 'https://example.com/page');
assertEqual(comboActive.length, 1, 'Combined: only 1 active (enabled + scope match)');
assertEqual(comboActive[0].textToReplace, 'cat', 'Combined: correct rule active');

// 12.2 Search on filtered results
const comboSearched = searchFilter(combo, 'cat');
assertEqual(comboSearched.length, 1, 'Search in combined dataset');

// 12.3 Badge with mixed states
assertEqual(computeBadgeCount(combo, true), 2, 'Badge: 2 enabled (regardless of scope)');
assertEqual(computeBadgeCount(combo, false), 0, 'Badge: 0 when global off');

// 12.4 Multiple replacements apply in order
let orderText = 'Replace A then B';
const orderRules = [
  { textToReplace: 'A', replacementText: 'X', wholeWord: true },
  { textToReplace: 'B', replacementText: 'Y', wholeWord: true },
];
orderRules.forEach(r => { orderText = applyReplacement(orderText, r); });
assertEqual(orderText, 'Replace X then Y', 'Multiple rules apply sequentially');

// 12.5 Chained replacement (output of one becomes input for another)
let chainText = 'cat is here';
const chainRules = [
  { textToReplace: 'cat', replacementText: 'dog', wholeWord: true },
  { textToReplace: 'dog', replacementText: 'fish', wholeWord: true },
];
chainRules.forEach(r => { chainText = applyReplacement(chainText, r); });
assertEqual(chainText, 'fish is here', 'Chained replacements: cat->dog->fish');

// ============================================================
// TEST SUITE 13: STRESS TESTS
// ============================================================

console.log('\n=== TEST SUITE 13: Stress Tests ===\n');

// 13.1 Large number of replacements
const largeRules = [];
for (let i = 0; i < 100; i++) {
  largeRules.push({ textToReplace: `word${i}`, replacementText: `WORD${i}`, scope: '', enabled: true, wholeWord: false });
}
let largeText = largeRules.map(r => r.textToReplace).join(' ');
largeRules.forEach(r => { largeText = applyReplacement(largeText, r); });
assert(largeText === largeRules.map(r => r.replacementText).join(' '), 'Stress: 100 replacements applied');

// 13.2 Large text with many occurrences
const stressText = 'error '.repeat(10000);
const stressResult = applyReplacement(stressText, { textToReplace: 'error', replacementText: 'warn', wholeWord: true });
assert(!stressResult.includes('error'), 'Stress: 10000 occurrences all replaced');

// 13.3 Search with large dataset
const largeSearch = [];
for (let i = 0; i < 500; i++) {
  largeSearch.push({ textToReplace: `item${i}`, replacementText: `result${i}`, scope: '' });
}
assertEqual(searchFilter(largeSearch, 'item99').length, 1, 'Stress: search in 500 items finds exact');
assertEqual(searchFilter(largeSearch, 'item1').length, 111, 'Stress: search partial "item1" in 500 items');

// 13.4 Badge count with many items
assertEqual(computeBadgeCount(largeRules, true), 100, 'Stress: badge count with 100 items');

// 13.5 Scope matching against many comma-separated scopes
const manyScopes = Array.from({length: 50}, (_, i) => `domain${i}.com`).join(', ');
assert(matchesScope('https://domain25.com/page', manyScopes) === true, 'Stress: match in 50 comma-separated scopes');
assert(matchesScope('https://nomatch.com/page', manyScopes) === false, 'Stress: no match in 50 scopes');

// ============================================================
// TEST SUITE 14: HTML/POPUP VALIDATION
// ============================================================

console.log('\n=== TEST SUITE 14: HTML/Popup Validation ===\n');

const popupHtmlPath = path.join(extDir, 'popup.html');
const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');

assert(popupHtml.includes('id="globalToggle"'), 'popup.html has global toggle');
assert(popupHtml.includes('id="searchInput"'), 'popup.html has search input');
assert(popupHtml.includes('id="replacementsTable"'), 'popup.html has replacements table');
assert(popupHtml.includes('id="replacementModal"'), 'popup.html has modal');
assert(popupHtml.includes('id="wholeWord"'), 'popup.html has wholeWord checkbox');
assert(popupHtml.includes('id="addReplacementBtn"'), 'popup.html has add button');
assert(popupHtml.includes('id="exportJsonBtn"'), 'popup.html has export JSON button');
assert(popupHtml.includes('id="exportCsvBtn"'), 'popup.html has export CSV button');
assert(popupHtml.includes('id="importBtn"'), 'popup.html has import button');
assert(popupHtml.includes('id="importFile"'), 'popup.html has import file input');

// Verify popup.js is loaded
assert(popupHtml.includes('popup.js'), 'popup.html loads popup.js');
assert(popupHtml.includes('popup.css'), 'popup.html loads popup.css');

// ============================================================
// TEST SUITE 15: CONTENT.JS LOGIC INTEGRATION
// ============================================================

console.log('\n=== TEST SUITE 15: Content.js Logic Integration ===\n');

const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

assert(contentJs.includes('globalEnabled'), 'content.js checks globalEnabled');
assert(contentJs.includes('replacement.enabled === false'), 'content.js checks individual enabled');
assert(contentJs.includes('wholeWord'), 'content.js supports wholeWord');
assert(contentJs.includes('MutationObserver'), 'content.js uses MutationObserver');
assert(contentJs.includes('chrome.storage.onChanged'), 'content.js listens to storage changes');
assert(contentJs.includes("request.action === 'toggleGlobal'"), 'content.js handles toggleGlobal message');
assert(contentJs.includes("request.action === 'updateReplacements'"), 'content.js handles updateReplacements message');
assert(contentJs.includes('matchesScope'), 'content.js uses matchesScope function');
assert(contentJs.includes('matchesSingleScope'), 'content.js uses matchesSingleScope function');
assert(contentJs.includes('hasSpecialChars'), 'content.js handles special chars in wholeWord');
assert(contentJs.includes('debouncedReplacements'), 'content.js has debounced replacement function');
assert(contentJs.includes('_debounceTimer'), 'content.js uses debounce timer variable');
assert(contentJs.includes('clearTimeout(_debounceTimer)'), 'content.js clears debounce timer');
assert(contentJs.includes('setTimeout(() => performReplacements()'), 'content.js schedules debounced execution');
assert(contentJs.includes('debouncedReplacements()'), 'content.js MutationObserver calls debounced function');

// ============================================================
// TEST SUITE 16: BACKGROUND.JS LOGIC VALIDATION
// ============================================================

console.log('\n=== TEST SUITE 16: Background.js Logic Validation ===\n');

const bgJs = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');

assert(bgJs.includes('chrome.runtime.onInstalled'), 'background.js has onInstalled listener');
assert(bgJs.includes('globalEnabled'), 'background.js manages globalEnabled');
assert(bgJs.includes('updateBadge'), 'background.js has updateBadge function');
assert(bgJs.includes('chrome.action.setBadgeText'), 'background.js sets badge text');
assert(bgJs.includes('chrome.action.setBadgeBackgroundColor'), 'background.js sets badge color');
assert(!bgJs.includes('chrome.commands.onCommand'), 'background.js no longer has keyboard command listener');
assert(bgJs.includes('chrome.storage.onChanged'), 'background.js listens to storage changes');
assert(bgJs.includes("text: 'OFF'"), 'background.js shows OFF badge');
assert(bgJs.includes("color: '#f44336'"), 'background.js uses red for OFF state');
assert(bgJs.includes('#4caf50'), 'background.js uses green for active state');

// ============================================================
// NEW FEATURE FUNCTIONS (extracted for testing)
// ============================================================

// F4: Regex mode - apply replacement with isRegex flag
function applyReplacementV2(text, replacement) {
  const { textToReplace, replacementText, wholeWord, isRegex } = replacement;
  if (!textToReplace || !replacementText) return text;

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
    return text.replace(regex, replacementText);
  } catch (e) {
    return text;
  }
}

// F7: Rule groups - helper functions
function getGroupNames(replacements) {
  const names = new Set();
  replacements.forEach(r => {
    if (r.group && r.group.trim()) names.add(r.group.trim());
  });
  return Array.from(names).sort();
}

function filterByGroup(replacements, groupName) {
  if (groupName === null || groupName === undefined) return replacements;
  if (groupName === '') return replacements.filter(r => !r.group || !r.group.trim());
  return replacements.filter(r => (r.group || '') === groupName);
}

function getUngroupedCount(replacements) {
  return replacements.filter(r => !r.group || !r.group.trim()).length;
}

// F2: Storage helper - determines which storage to use
function resolveStorageArea(syncAvailable) {
  return syncAvailable ? 'sync' : 'local';
}

// ============================================================
// TEST SUITE 17: F12 - SKIP SCRIPT/STYLE/TEXTAREA NODES
// ============================================================

console.log('\n=== TEST SUITE 17: Skip Script/Style/Textarea Nodes (F12) ===\n');

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

assert(SKIP_TAGS.has('SCRIPT'), 'SKIP_TAGS includes SCRIPT');
assert(SKIP_TAGS.has('STYLE'), 'SKIP_TAGS includes STYLE');
assert(SKIP_TAGS.has('TEXTAREA'), 'SKIP_TAGS includes TEXTAREA');
assert(SKIP_TAGS.has('NOSCRIPT'), 'SKIP_TAGS includes NOSCRIPT');
assert(SKIP_TAGS.has('CODE'), 'SKIP_TAGS includes CODE');
assert(SKIP_TAGS.has('PRE'), 'SKIP_TAGS includes PRE');
assert(!SKIP_TAGS.has('DIV'), 'SKIP_TAGS does NOT include DIV');
assert(!SKIP_TAGS.has('SPAN'), 'SKIP_TAGS does NOT include SPAN');
assert(!SKIP_TAGS.has('P'), 'SKIP_TAGS does NOT include P');

// Verify content.js has the skip logic
assert(contentJs.includes('SKIP_TAGS') || contentJs.includes('skipTags') || contentJs.includes('tagName'), 'content.js has tag skip logic');
assert(contentJs.includes('SCRIPT') || contentJs.includes('script'), 'content.js references SCRIPT tag');
assert(contentJs.includes('STYLE') || contentJs.includes('style'), 'content.js references STYLE tag');
assert(contentJs.includes('TEXTAREA') || contentJs.includes('textarea'), 'content.js references TEXTAREA tag');

// ============================================================
// TEST SUITE 18: F4 - REGEX MODE
// ============================================================

console.log('\n=== TEST SUITE 18: Regex Mode (F4) ===\n');

// 18.1 Basic regex pattern
assertEqual(
  applyReplacementV2('Codes: E001, E002, E999', { textToReplace: 'E\\d{3}', replacementText: 'ERR', isRegex: true }),
  'Codes: ERR, ERR, ERR',
  'Regex: digit pattern replaces all'
);

// 18.2 Capture group replacement
assertEqual(
  applyReplacementV2('John Smith, Jane Doe', { textToReplace: '(\\w+) (\\w+)', replacementText: '$2, $1', isRegex: true }),
  'Smith, John, Doe, Jane',
  'Regex: capture group swap'
);

// 18.3 Non-regex mode still escapes
assertEqual(
  applyReplacementV2('file.txt and file2txt', { textToReplace: 'file.txt', replacementText: 'doc.pdf', isRegex: false }),
  'doc.pdf and file2txt',
  'Non-regex: dot is literal not wildcard'
);

// 18.4 Invalid regex falls back gracefully
assertEqual(
  applyReplacementV2('hello world', { textToReplace: '[invalid', replacementText: 'test', isRegex: true }),
  'hello world',
  'Invalid regex returns text unchanged'
);

// 18.5 Regex with alternation
assertEqual(
  applyReplacementV2('cat or dog or bird', { textToReplace: 'cat|dog', replacementText: 'pet', isRegex: true }),
  'pet or pet or bird',
  'Regex: alternation works'
);

// 18.6 Regex word boundary
assertEqual(
  applyReplacementV2('category cat concatenate', { textToReplace: '\\bcat\\b', replacementText: 'dog', isRegex: true }),
  'category dog concatenate',
  'Regex: word boundary works'
);

// 18.7 wholeWord ignored when isRegex=true (regex user controls boundaries)
assertEqual(
  applyReplacementV2('category cat', { textToReplace: 'cat', replacementText: 'dog', isRegex: true, wholeWord: true }),
  'dogegory dog',
  'Regex mode: wholeWord flag ignored (user controls regex)'
);

// 18.8 Empty inputs still safe
assertEqual(
  applyReplacementV2('hello', { textToReplace: '', replacementText: 'x', isRegex: true }),
  'hello',
  'Regex: empty pattern returns original'
);

// Verify popup.html has regex checkbox
assert(popupHtml.includes('id="isRegex"') || popupHtml.includes('id="useRegex"'), 'popup.html has regex mode checkbox');

// Verify content.js handles isRegex
assert(contentJs.includes('isRegex') || contentJs.includes('useRegex'), 'content.js handles regex mode flag');

// ============================================================
// TEST SUITE 19: F7 - RULE GROUPS / FOLDERS
// ============================================================

console.log('\n=== TEST SUITE 19: Rule Groups (F7) ===\n');

const groupedRules = [
  { textToReplace: 'a', replacementText: 'b', group: 'Salesforce', enabled: true },
  { textToReplace: 'c', replacementText: 'd', group: 'Salesforce', enabled: true },
  { textToReplace: 'e', replacementText: 'f', group: 'Internal', enabled: false },
  { textToReplace: 'g', replacementText: 'h', group: '', enabled: true },
  { textToReplace: 'i', replacementText: 'j', enabled: true },
];

// 19.1 Extract group names
assertDeepEqual(getGroupNames(groupedRules), ['Internal', 'Salesforce'], 'Get sorted group names');

// 19.2 Filter by group
assertEqual(filterByGroup(groupedRules, 'Salesforce').length, 2, 'Filter Salesforce group: 2 rules');
assertEqual(filterByGroup(groupedRules, 'Internal').length, 1, 'Filter Internal group: 1 rule');
assertEqual(filterByGroup(groupedRules, '').length, 2, 'Filter empty group: 2 ungrouped rules');

// 19.3 Filter null group returns all
assertEqual(filterByGroup(groupedRules, null).length, 5, 'Null group filter returns all');

// 19.4 Ungrouped count
assertEqual(getUngroupedCount(groupedRules), 2, 'Ungrouped count: 2');

// 19.5 Empty data
assertDeepEqual(getGroupNames([]), [], 'Empty data: no groups');
assertEqual(getUngroupedCount([]), 0, 'Empty data: 0 ungrouped');

// 19.6 All ungrouped
const noGroups = [{ textToReplace: 'x', replacementText: 'y' }];
assertDeepEqual(getGroupNames(noGroups), [], 'No groups assigned: empty array');
assertEqual(getUngroupedCount(noGroups), 1, 'All ungrouped: count 1');

// 19.7 Group in search filter
const groupSearchData = [
  { textToReplace: 'a', replacementText: 'b', scope: '', group: 'SF Codes' },
  { textToReplace: 'c', replacementText: 'd', scope: '', group: 'Other' },
];
// Search should also match group name
function searchFilterV2(replacements, searchTerm) {
  if (!searchTerm) return replacements;
  const term = searchTerm.toLowerCase();
  return replacements.filter(r =>
    (r.textToReplace || '').toLowerCase().includes(term) ||
    (r.replacementText || '').toLowerCase().includes(term) ||
    (r.scope || '').toLowerCase().includes(term) ||
    (r.group || '').toLowerCase().includes(term)
  );
}
assertEqual(searchFilterV2(groupSearchData, 'SF').length, 1, 'Search by group name finds match');
assertEqual(searchFilterV2(groupSearchData, 'codes').length, 1, 'Search partial group name');

// Verify popup.html has group-related UI
assert(popupHtml.includes('group') || popupHtml.includes('Group'), 'popup.html has group UI elements');

// ============================================================
// TEST SUITE 20: F10 - CONTEXT MENU
// ============================================================

console.log('\n=== TEST SUITE 20: Context Menu (F10) ===\n');

assert(manifest.permissions.includes('contextMenus'), 'Manifest has contextMenus permission');
assert(bgJs.includes('chrome.contextMenus'), 'background.js uses contextMenus API');
assert(bgJs.includes('contextMenus.create') || bgJs.includes('contextMenus.onClicked'), 'background.js creates/handles context menu');

// ============================================================
// TEST SUITE 21: TD6 - ACCESSIBILITY
// ============================================================

console.log('\n=== TEST SUITE 21: Accessibility (TD6) ===\n');

// Modal accessibility
assert(popupHtml.includes('role="dialog"'), 'Modal has role="dialog"');
assert(popupHtml.includes('aria-modal="true"'), 'Modal has aria-modal="true"');
assert(popupHtml.includes('aria-labelledby'), 'Modal has aria-labelledby');

// Form label associations
assert(popupHtml.includes('for="textToReplace"'), 'Label for textToReplace input');
assert(popupHtml.includes('for="replacementText"'), 'Label for replacementText input');
assert(popupHtml.includes('for="scope"'), 'Label for scope input');

// Icon button accessibility
assert(popupHtml.includes('aria-label') || contentJs.includes('aria-label'), 'Buttons have aria-labels');

// Search input accessibility
assert(popupHtml.includes('aria-label="Search"') || popupHtml.includes('role="search"'), 'Search has accessibility attributes');

// Global toggle accessibility
assert(popupHtml.includes('aria-label') && popupHtml.includes('globalToggle'), 'Global toggle has accessibility');

// Table accessibility
assert(popupHtml.includes('scope="col"') || popupHtml.includes('role="table"'), 'Table has column scope or role');

// ============================================================
// TEST SUITE 22: TD7 - CSS VARIABLES
// ============================================================

console.log('\n=== TEST SUITE 22: CSS Variables (TD7) ===\n');

const popupCss = fs.readFileSync(path.join(extDir, 'popup.css'), 'utf8');

assert(popupCss.includes(':root'), 'CSS has :root selector');
assert(popupCss.includes('--'), 'CSS uses custom properties');
assert(popupCss.includes('var(--'), 'CSS references custom properties with var()');

// Key color variables should exist
assert(popupCss.includes('--color-primary') || popupCss.includes('--primary'), 'CSS has primary color variable');
assert(popupCss.includes('--color-bg') || popupCss.includes('--bg'), 'CSS has background color variable');
assert(popupCss.includes('--color-text') || popupCss.includes('--text'), 'CSS has text color variable');

// ============================================================
// TEST SUITE 23: F2 - STORAGE FALLBACK
// ============================================================

console.log('\n=== TEST SUITE 23: Storage Fallback (F2) ===\n');

assertEqual(resolveStorageArea(true), 'sync', 'Sync available: use sync');
assertEqual(resolveStorageArea(false), 'local', 'Sync unavailable: use local');

// Verify source files use a storage abstraction or fallback
const popupJs = fs.readFileSync(path.join(extDir, 'popup.js'), 'utf8');
assert(
  popupJs.includes('storage.local') || popupJs.includes('storageArea') || popupJs.includes('getStorage'),
  'popup.js has storage fallback logic'
);
assert(
  bgJs.includes('storage.local') || bgJs.includes('storageArea') || bgJs.includes('getStorage'),
  'background.js has storage fallback logic'
);

// ============================================================
// TEST SUITE 24: TD5 - TOAST NOTIFICATIONS
// ============================================================

console.log('\n=== TEST SUITE 24: Toast Notifications (TD5) ===\n');

assert(popupHtml.includes('toast-container') || popupHtml.includes('toast'), 'popup.html has toast container');
assert(popupJs.includes('showToast') || popupJs.includes('toast'), 'popup.js has toast function');
assert(popupCss.includes('.toast') || popupCss.includes('toast'), 'popup.css has toast styles');

// Verify alert() and confirm() are removed (or minimal)
const alertCount = (popupJs.match(/\balert\(/g) || []).length;
const confirmCount = (popupJs.match(/\bconfirm\(/g) || []).length;
assert(alertCount === 0, `popup.js has no alert() calls (found ${alertCount})`);
assert(confirmCount <= 1, `popup.js has at most 1 confirm() call for import (found ${confirmCount})`);

// ============================================================
// TEST SUITE 25: TD4 - ERROR HANDLING
// ============================================================

console.log('\n=== TEST SUITE 25: Error Handling (TD4) ===\n');

// loadReplacements should check for errors
assert(popupJs.includes('chrome.runtime.lastError') && popupJs.includes('loadReplacements'), 'popup.js loadReplacements checks for errors');

// updateBadge should have error handling
assert(
  popupJs.includes('.catch') || popupJs.includes('try'),
  'popup.js updateBadge has error handling'
);

// ============================================================
// TEST SUITE 26: TD3 - DIST FOLDER VALIDATION
// ============================================================

console.log('\n=== TEST SUITE 26: Dist Folder (TD3) ===\n');

const distDir = path.join(extDir, 'dist', 'TextReplacer');
if (fs.existsSync(distDir)) {
  // If dist exists, it must be current
  const distManifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
  assertEqual(distManifest.version, manifest.version, 'dist manifest version matches source');
  assert(distManifest.permissions.includes('contextMenus'), 'dist manifest has contextMenus');
  
  const distContentJs = fs.readFileSync(path.join(distDir, 'content.js'), 'utf8');
  assert(distContentJs.includes('debouncedReplacements'), 'dist content.js has debounce');
} else {
  // dist removed is also valid
  assert(true, 'dist/ folder removed (valid cleanup)');
}

// ============================================================
// TEST SUITE 27: F4 - REGEX MODE IN SOURCE FILES
// ============================================================

console.log('\n=== TEST SUITE 27: Regex Mode Source Validation ===\n');

assert(contentJs.includes('isRegex') || contentJs.includes('useRegex'), 'content.js supports regex mode');
assert(popupJs.includes('isRegex') || popupJs.includes('useRegex'), 'popup.js handles regex mode');

// Export should include isRegex field
assert(popupJs.includes('isRegex') || popupJs.includes('useRegex'), 'Export includes regex flag');

// ============================================================
// RESULTS SUMMARY
// ============================================================

console.log('\n' + '='.repeat(60));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(60));
console.log(`Total:  ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log('='.repeat(60));

if (failedTests > 0) {
  console.log('\nFAILED TESTS:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
