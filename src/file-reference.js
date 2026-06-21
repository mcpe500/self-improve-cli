'use strict';

/**
 * @file Reference Parser
 * 
 * Parse @filename syntax from user input and attach file content
 * to agent context.
 * 
 * Example: "@src/auth.js fix the bug" → file content + prompt
 */

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Extract @file references from text.
 * 
 * @param {string} text - user input
 * @returns {string[]} array of file paths
 */
function parseFileReferences(text) {
  // Match @path/to/file.ext (word chars, /, -, ., but not spaces)
  const pattern = /@([\w./-]+(?:\.\w+)?)/g;
  const matches = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const filepath = match[1];
    // Filter out things that look like emails or version numbers
    if (!filepath.includes('@') && !/^\d+$/.test(filepath)) {
      matches.push(filepath);
    }
  }

  // Dedupe
  return [...new Set(matches)];
}

/**
 * Read a file with size limit.
 * 
 * @param {string} root - workspace root
 * @param {string} filepath - file path (relative or absolute)
 * @param {number} maxSize - max bytes (default 100KB)
 * @returns {Promise<string|null>} file content or null if missing
 */
async function readFileLimited(root, filepath, maxSize = 100 * 1024) {
  const fullPath = path.isAbsolute(filepath) 
    ? filepath 
    : path.join(root, filepath);

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;

    const content = await fs.readFile(fullPath, 'utf8');
    if (content.length > maxSize) {
      return content.slice(0, maxSize) + '\n...[truncated]';
    }
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Attach file content to a prompt.
 * 
 * @param {string} root - workspace root
 * @param {string} text - user input with @file references
 * @returns {Promise<object>} { prompt, attached, missing }
 */
async function attachFileContent(root, text) {
  const files = parseFileReferences(text);
  const attached = [];
  const missing = [];
  const parts = [];

  for (const file of files) {
    const content = await readFileLimited(root, file);
    if (content !== null) {
      attached.push(file);
      parts.push(`[File: ${file}]\n${content}`);
    } else {
      missing.push(file);
    }
  }

  // Remove @file references from prompt
  let prompt = text;
  for (const file of files) {
    prompt = prompt.replace(`@${file}`, '').trim();
  }

  // Prepend file content
  if (parts.length > 0) {
    prompt = parts.join('\n\n') + '\n\n---\n\n' + prompt;
  }

  return { prompt, attached, missing };
}

/**
 * Format attachment summary for UI display.
 * 
 * @param {object} result - { attached, missing }
 * @returns {string} summary string
 */
function formatAttachmentSummary(result) {
  const lines = [];
  
  if (result.attached.length > 0) {
    lines.push(`📎 Attached ${result.attached.length} file(s): ${result.attached.join(', ')}`);
  }
  
  if (result.missing.length > 0) {
    lines.push(`⚠️  Missing ${result.missing.length} file(s): ${result.missing.join(', ')}`);
  }
  
  return lines.join('\n');
}

module.exports = {
  parseFileReferences,
  readFileLimited,
  attachFileContent,
  formatAttachmentSummary,
};
