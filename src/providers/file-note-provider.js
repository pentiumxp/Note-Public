'use strict';

const fs = require('node:fs/promises');

function createFileNoteProvider({ baseDir }) {
  if (!baseDir) {
    throw new Error('baseDir is required');
  }

  async function readTextFile(relativePath) {
    const path = requireRelativePath(relativePath);
    return fs.readFile(`${baseDir}/${path}`, 'utf8');
  }

  async function writeTextFile(relativePath, content) {
    const path = requireRelativePath(relativePath);
    await fs.writeFile(`${baseDir}/${path}`, String(content), 'utf8');
    return { path };
  }

  return {
    readTextFile,
    writeTextFile
  };
}

function requireRelativePath(path) {
  const value = String(path || '').trim().replaceAll('\\', '/');
  if (!value || value.startsWith('/') || value.includes('../')) {
    throw new Error('relative path is required');
  }
  return value;
}

module.exports = {
  createFileNoteProvider
};

