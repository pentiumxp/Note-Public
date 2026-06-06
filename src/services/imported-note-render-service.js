'use strict';

function normalizeImportedBody(body, attachments = []) {
  const raw = String(body || '');
  if (!hasHtmlMarkup(raw) && !containsEncryptedPayload(raw)) {
    const plain = renderPlainTextBody(raw);
    if (plain) {
      return plain;
    }
  }
  const inlineBody = renderInlineMedia(raw, attachments);
  if (containsEncryptedPayload(body)) {
    const imageGallery = renderImageGallery(attachments);
    const placeholder = '<p class="import-placeholder">这条 .notes 笔记的正文是印象笔记专有的 base64:aes 加密块，当前只能显示标题和附件；正文需要从已登录客户端的解密缓存或其他开放格式重新导入。</p>';
    if (imageGallery) {
      return `${placeholder}${imageGallery}`;
    }
    return placeholder;
  }
  const cleaned = inlineBody
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<en-crypt\b[^>]*>[\s\S]*?<\/en-crypt>/gi, '<div class="import-placeholder">印象笔记加密内容</div>')
    .replace(/<\/?en-note\b[^>]*>/gi, '')
    .replace(/<en-todo\b[^>]*checked=["']true["'][^>]*\/?>/gi, '<input type="checkbox" checked disabled>')
    .replace(/<en-todo\b[^>]*\/?>/gi, '<input type="checkbox" disabled>')
    .replace(base64BlockPattern(), '')
    .replace(/(?:<div>\s*<br\s*\/?>\s*<\/div>\s*){3,}/gi, '<div><br></div><div><br></div>')
    .trim();
  if (readableText(cleaned).length > 0 && !isBase64OnlyText(readableText(cleaned))) {
    return cleaned;
  }
  if (attachments.length > 0) {
    const imageGallery = renderImageGallery(attachments);
    if (imageGallery) {
      return imageGallery;
    }
    return '<p class="import-placeholder">这条导入笔记主要由附件组成，内容已保留在附件区。</p>';
  }
  return '<p class="import-placeholder">这条导入笔记包含印象笔记的加密或二进制内容，当前无法直接显示正文。</p>';
}

function renderPlainTextBody(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!text) {
    return '';
  }
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map(renderPlainTextBlock).join('');
}

function renderPlainTextBlock(block) {
  const lines = block.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
  if (!lines.length) {
    return '';
  }
  if (lines.every((line) => /^[-*•]\s+/.test(line.trim()))) {
    return `<ul>${lines.map((line) => `<li>${escapeHtml(line.trim().replace(/^[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
  }
  return `<p>${lines.map((line) => escapeHtml(line.trim())).join('<br>')}</p>`;
}

function hasHtmlMarkup(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function readableText(body, attachments = []) {
  if (containsEncryptedPayload(body)) {
    if (attachments.length > 0) {
      return `附件笔记 · ${attachments.length} 个附件`;
    }
    return '加密内容';
  }
  const text = normalizeImportedBodyForText(body)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text && !isBase64OnlyText(text)) {
    return text;
  }
  if (attachments.length > 0) {
    return `附件笔记 · ${attachments.length} 个附件`;
  }
  return '导入笔记';
}

function normalizeImportedBodyForText(body) {
  return String(body || '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<en-media\b[^>]*>/gi, ' 附件 ')
    .replace(/<en-crypt\b[^>]*>[\s\S]*?<\/en-crypt>/gi, ' 加密内容 ')
    .replace(/<\/?en-note\b[^>]*>/gi, '')
    .replace(base64BlockPattern(), ' ')
    .trim();
}

function renderInlineMedia(body, attachments) {
  const byHash = new Map();
  for (const attachment of attachments || []) {
    if (attachment.resourceHash) {
      byHash.set(String(attachment.resourceHash).toLowerCase(), attachment);
    }
  }
  return String(body || '').replace(/<en-media\b([^>]*)>/gi, (match, attrs) => {
    const hash = extractAttribute(attrs, 'hash').toLowerCase();
    const attachment = hash ? byHash.get(hash) : null;
    if (attachment && attachment.kind === 'image' && attachment.url) {
      return inlineImageMarkup(attachment);
    }
    if (attachment) {
      return `<div class="import-placeholder">附件：${escapeHtml(attachment.name)}</div>`;
    }
    return '<div class="import-placeholder">附件已保留在附件区</div>';
  });
}

function renderImageGallery(attachments) {
  const images = (attachments || []).filter((attachment) => attachment.kind === 'image' && attachment.url);
  if (!images.length) {
    return '';
  }
  return `<div class="inline-image-grid">${images.map(inlineImageMarkup).join('')}</div>`;
}

function inlineImageMarkup(attachment) {
  const previewUrl = attachment.thumbnailUrl || attachment.url;
  return `
    <button type="button" class="inline-image-thumb" data-image-url="${escapeHtml(attachment.url)}" data-image-name="${escapeHtml(attachment.name)}">
      <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(attachment.name)}">
    </button>
  `;
}

function extractAttribute(attrs, name) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const match = pattern.exec(String(attrs || ''));
  return match ? match[1] : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function base64BlockPattern() {
  return /(?:[A-Za-z0-9+/=]{40,}\s*){2,}|RU5D[A-Za-z0-9+/=\s]{40,}/g;
}

function containsEncryptedPayload(value) {
  return /RU5D|(?:[A-Za-z0-9+/=]{40,}\s*){2,}/.test(String(value || ''));
}

function isBase64OnlyText(value) {
  const text = String(value || '').replace(/\s+/g, '');
  if (text.length >= 12 && /^[A-Za-z0-9+/=]+$/.test(text) && /[+/=]/.test(text)) {
    return true;
  }
  return text.length >= 24
    && /^[A-Za-z0-9]+$/.test(text)
    && /[a-z]/.test(text)
    && /[A-Z]/.test(text)
    && /\d/.test(text);
}

module.exports = {
  normalizeImportedBody,
  readableText
};
