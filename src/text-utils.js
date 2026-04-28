'use strict';

/**
 * Text processing utilities.
 */

function stripThinkBlocks(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function stripJsonCodeBlock(text) {
  return String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
}

function compactJson(value, limit = 12000) {
  const text = JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...<truncated>` : text;
}

module.exports = { stripThinkBlocks, stripJsonCodeBlock, compactJson };
