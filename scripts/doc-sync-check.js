#!/usr/bin/env node
/**
 * Doc-Sync Checker
 *
 * Verifies that docs/how-it-works.html is up to date with the source files.
 *
 * Usage:
 *   node scripts/doc-sync-check.js           # Check staleness (exit 0 = fresh, 1 = stale)
 *   node scripts/doc-sync-check.js --update  # Recalculate hash and write it into the HTML
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DOC_PATH = path.join(ROOT, 'docs', 'how-it-works.html');

const SOURCE_FILES = [
  'content.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'background.js',
  'manifest.json'
];

const SYNC_REGEX = /<!-- DOC-SYNC\n([\s\S]*?)-->/;
const HASH_REGEX = /source-hash:\s*([a-f0-9]+)/;

function hashSources() {
  const hasher = crypto.createHash('sha256');
  for (const file of SOURCE_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.error(`  Source file missing: ${file}`);
      process.exit(2);
    }
    hasher.update(fs.readFileSync(filePath, 'utf-8'));
  }
  return hasher.digest('hex');
}

function buildSyncComment(hash) {
  const now = new Date().toISOString();
  return [
    '<!-- DOC-SYNC',
    `  sources: ${SOURCE_FILES.join(', ')}`,
    `  generated: ${now}`,
    `  source-hash: ${hash}`,
    '-->'
  ].join('\n');
}

function run() {
  const updateMode = process.argv.includes('--update');

  if (!fs.existsSync(DOC_PATH)) {
    console.error('[doc-sync] docs/how-it-works.html not found. Generate it first.');
    process.exit(2);
  }

  const currentHash = hashSources();
  let html = fs.readFileSync(DOC_PATH, 'utf-8');

  if (updateMode) {
    const newComment = buildSyncComment(currentHash);
    if (SYNC_REGEX.test(html)) {
      html = html.replace(SYNC_REGEX, newComment);
    } else {
      html = html.replace('<!DOCTYPE html>', `<!DOCTYPE html>\n${newComment}`);
    }
    fs.writeFileSync(DOC_PATH, html, 'utf-8');
    console.log(`[doc-sync] Updated hash: ${currentHash.slice(0, 12)}...`);
    console.log(`[doc-sync] Timestamp: ${new Date().toISOString()}`);
    process.exit(0);
  }

  const match = html.match(SYNC_REGEX);
  if (!match) {
    console.warn('[doc-sync] No DOC-SYNC metadata found in how-it-works.html.');
    console.warn('           Run: node scripts/doc-sync-check.js --update');
    process.exit(1);
  }

  const hashMatch = match[1].match(HASH_REGEX);
  if (!hashMatch) {
    console.warn('[doc-sync] DOC-SYNC comment exists but has no source-hash.');
    process.exit(1);
  }

  const storedHash = hashMatch[1];

  if (storedHash === currentHash) {
    console.log('[doc-sync] Document is UP TO DATE with source files.');
    process.exit(0);
  }

  console.warn('[doc-sync] STALE — source files have changed since last doc generation.');
  console.warn(`           Stored hash : ${storedHash.slice(0, 12)}...`);
  console.warn(`           Current hash: ${currentHash.slice(0, 12)}...`);
  console.warn('');

  const storedParts = hashPartsPerFile();
  if (storedParts) {
    console.warn('  Changed files:');
    for (const file of SOURCE_FILES) {
      const filePath = path.join(ROOT, file);
      const fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf-8')).digest('hex');
      if (storedParts[file] && storedParts[file] !== fileHash) {
        console.warn(`    - ${file}`);
      }
    }
  }

  console.warn('');
  console.warn('  To update: node scripts/doc-sync-check.js --update');
  console.warn('  Then regenerate docs/how-it-works.html if needed.');
  process.exit(1);
}

function hashPartsPerFile() {
  const parts = {};
  for (const file of SOURCE_FILES) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      parts[file] = crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf-8')).digest('hex');
    }
  }
  return parts;
}

run();
