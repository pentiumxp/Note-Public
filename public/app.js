'use strict';

const STORAGE_KEY = 'note.workspace.v2';

const attachmentIcons = {
  image: '▣',
  document: '▥',
  audio: '●',
  file: '▧'
};

const sessionObjectUrls = new Map();
const state = loadState();
let selectedNoteId = state.notes[0]?.id || null;
let selectedFilter = { type: 'all' };
const SWIPE_REVEAL_WIDTH = 104;
const SWIPE_DELETE_WIDTH = 184;
const NOTE_LIST_INITIAL_LIMIT = 120;
const NOTE_LIST_BATCH_SIZE = 80;
const NOTE_LIST_SCROLL_THRESHOLD = 900;
let renderedNoteLimit = NOTE_LIST_INITIAL_LIMIT;

const elements = {
  newNoteButton: document.querySelector('#new-note-button'),
  searchInput: document.querySelector('#search-input'),
  mobileSearchInput: document.querySelector('#mobile-search-input'),
  homeSurface: document.querySelector('#home-surface'),
  noteList: document.querySelector('#note-list'),
  notebookList: document.querySelector('#notebook-list'),
  tagList: document.querySelector('#tag-list'),
  titleInput: document.querySelector('#title-input'),
  notebookSelect: document.querySelector('#notebook-select'),
  tagInput: document.querySelector('#tag-input'),
  bodyEditor: document.querySelector('#body-editor'),
  shortcutButton: document.querySelector('#shortcut-button'),
  trashButton: document.querySelector('#trash-button'),
  restoreButton: document.querySelector('#restore-button'),
  addTaskButton: document.querySelector('#add-task-button'),
  addPhotoButton: document.querySelector('#add-photo-button'),
  addAttachmentButton: document.querySelector('#add-attachment-button'),
  mobileCreateButton: document.querySelector('#mobile-create-button'),
  createSheet: document.querySelector('#create-sheet'),
  sheetBackdrop: document.querySelector('#sheet-backdrop'),
  taskList: document.querySelector('#task-list'),
  attachmentList: document.querySelector('#attachment-list'),
  syncStatus: document.querySelector('#sync-status'),
  countAll: document.querySelector('#count-all'),
  countShortcuts: document.querySelector('#count-shortcuts'),
  countTasks: document.querySelector('#count-tasks'),
  countAttachments: document.querySelector('#count-attachments'),
  countTrash: document.querySelector('#count-trash'),
  listTitle: document.querySelector('#list-title'),
  listSubtitle: document.querySelector('#list-subtitle'),
  sortSelect: document.querySelector('#sort-select'),
  editorPanel: document.querySelector('#editor-panel'),
  closeEditorButton: document.querySelector('#close-editor-button'),
  photoInput: document.querySelector('#photo-input'),
  fileInput: document.querySelector('#file-input')
};

wireEvents();
wireHermesEmbedding();
render();
loadImportedWorkspace();

function wireEvents() {
  elements.newNoteButton.addEventListener('click', openCreateSheet);
  elements.mobileCreateButton.addEventListener('click', openCreateSheet);
  elements.sheetBackdrop.addEventListener('click', closeCreateSheet);
  elements.closeEditorButton.addEventListener('click', closeEditor);

  document.querySelectorAll('[data-create-kind]').forEach((button) => {
    button.addEventListener('click', () => createFromKind(button.dataset.createKind));
  });

  document.querySelectorAll('[data-mobile-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-mobile-tab]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      handleMobileTab(button.dataset.mobileTab);
    });
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      setSearch('');
      selectedFilter = { type: button.dataset.filter };
      resetNoteListWindow();
      render();
    });
  });

  document.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFilter = { type: button.dataset.filterShortcut };
      setSearch('');
      resetNoteListWindow();
      render();
    });
  });

  elements.searchInput.addEventListener('input', () => applySearch(elements.searchInput.value));
  elements.mobileSearchInput.addEventListener('input', () => applySearch(elements.mobileSearchInput.value));
  elements.titleInput.addEventListener('input', updateSelectedFromEditor);
  elements.bodyEditor.addEventListener('input', updateSelectedFromEditor);
  elements.bodyEditor.addEventListener('click', handleBodyEditorClick);
  elements.noteList.addEventListener('click', handleNoteListAttachmentClick, true);
  document.addEventListener('error', handlePreviewImageFallback, true);
  elements.notebookSelect.addEventListener('change', updateSelectedFromEditor);
  elements.tagInput.addEventListener('change', updateSelectedFromEditor);

  document.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', () => {
      document.execCommand(button.dataset.command, false);
      elements.bodyEditor.focus();
      updateSelectedFromEditor();
    });
  });

  elements.shortcutButton.addEventListener('click', () => {
    const note = selectedNote();
    if (!note) return;
    note.shortcut = !note.shortcut;
    touch(note);
    persistAndRender();
  });

  elements.trashButton.addEventListener('click', () => {
    const note = selectedNote();
    if (!note) return;
    note.status = 'trash';
    touch(note);
    selectedNoteId = state.notes.find((candidate) => candidate.status !== 'trash')?.id || null;
    closeEditor();
    persistAndRender();
  });

  elements.restoreButton.addEventListener('click', () => {
    const note = selectedNote();
    if (!note) return;
    note.status = 'active';
    touch(note);
    persistAndRender();
  });

  elements.addTaskButton.addEventListener('click', addTaskToSelected);
  elements.addPhotoButton.addEventListener('click', () => elements.photoInput.click());
  elements.addAttachmentButton.addEventListener('click', () => elements.fileInput.click());
  elements.photoInput.addEventListener('change', () => attachSelectedFile(elements.photoInput, 'image'));
  elements.fileInput.addEventListener('change', () => attachSelectedFile(elements.fileInput, 'file'));
  elements.sortSelect.addEventListener('change', () => {
    resetNoteListWindow();
    render();
  });
  elements.homeSurface.addEventListener('scroll', maybeExtendNoteList, { passive: true });
}

function wireHermesEmbedding() {
  if (new URLSearchParams(window.location.search).get('embed') === 'hermes') {
    postHostEvent('plugin:ready', { plugin: 'note' });
    emitNavigationState();
  }
  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hermes.plugin.back') {
      const handled = handlePluginBack();
      postPluginMessage('note.plugin.back_result', { handled, route: currentPluginRoute() });
      if (!handled) {
        emitNavigationState();
      }
      return;
    }
    if (message.type === 'hermes:theme') {
      applyHermesTheme(message.theme || {});
    }
    if (message.type === 'hermes:workspace' || message.type === 'hermes:refresh') {
      render();
      emitNavigationState();
      postHostEvent('plugin:refreshRequested', { plugin: 'note' });
    }
    if (message.type === 'hermes:visibility' && message.visible) {
      render();
      emitNavigationState();
    }
  });
}

function applyHermesTheme(theme) {
  const root = document.documentElement;
  if (theme.density === 'compact') {
    root.style.setProperty('--line', '#d6ddd4');
  }
  if (typeof theme.fontFamily === 'string' && theme.fontFamily.length < 120) {
    document.body.style.fontFamily = `${theme.fontFamily}, "Microsoft YaHei", Arial, sans-serif`;
  }
}

function postHostEvent(type, payload) {
  window.parent?.postMessage({ type, payload }, window.location.origin);
}

function postPluginMessage(type, payload = {}) {
  window.parent?.postMessage({ type, version: 1, ...payload }, window.location.origin);
}

function currentPluginRoute() {
  if (document.querySelector('.image-preview-overlay')) {
    return { surface: 'image_preview' };
  }
  if (!elements.createSheet.hidden) {
    return { surface: 'create_sheet' };
  }
  if (elements.editorPanel.classList.contains('is-open')) {
    return { surface: 'editor' };
  }
  return { surface: 'home' };
}

function emitNavigationState() {
  const route = currentPluginRoute();
  const canGoBack = route.surface !== 'home';
  const previewFullscreen = route.surface === 'image_preview';
  postPluginMessage('note.plugin.navigation', {
    canGoBack,
    route,
    previewFullscreen,
    fullscreenPreview: previewFullscreen,
    preview: previewFullscreen ? { kind: 'image', fullscreen: true } : { fullscreen: false }
  });
  postHostEvent('plugin:navigationChanged', { canGoBack, surface: route.surface, previewFullscreen });
}

function handlePluginBack() {
  const preview = document.querySelector('.image-preview-overlay');
  if (preview) {
    preview.remove();
    emitNavigationState();
    return true;
  }
  if (!elements.createSheet.hidden) {
    closeCreateSheet();
    return true;
  }
  if (elements.editorPanel.classList.contains('is-open')) {
    closeEditor();
    return true;
  }
  return false;
}

function openCreateSheet() {
  elements.createSheet.hidden = false;
  emitNavigationState();
}

function closeCreateSheet() {
  elements.createSheet.hidden = true;
  emitNavigationState();
}

function openEditor() {
  elements.editorPanel.classList.add('is-open');
  emitNavigationState();
}

function closeEditor() {
  elements.editorPanel.classList.remove('is-open');
  emitNavigationState();
}

function createFromKind(kind) {
  const notebookId = state.notebooks[0]?.id || 'notebook_inbox';
  const templates = {
    text: {
      title: '无标题笔记',
      body: ''
    },
    super: {
      title: '超级笔记',
      body: '<h2>摘要</h2><p></p><h2>正文</h2><p></p><h2>行动项</h2><ul><li></li></ul>'
    },
    photo: {
      title: '照片笔记',
      body: '<p>添加照片后，可在附件区查看图片记录。</p>',
      attachment: { name: '待添加照片', kind: 'image', pending: true }
    },
    scan: {
      title: '扫描文档',
      body: '<p>扫描件会作为文档附件保存在这篇笔记里。</p>',
      attachment: { name: '扫描文档占位.pdf', kind: 'document' }
    },
    audio: {
      title: '录音笔记',
      body: '<p>录音完成后会显示在附件区。</p>',
      attachment: { name: '录音占位.m4a', kind: 'audio' }
    },
    attachment: {
      title: '附件笔记',
      body: '<p>选择一个文件，作为这篇笔记的附件记录。</p>',
      attachment: { name: '待添加文件', kind: 'file', pending: true }
    }
  };
  const selected = templates[kind] || templates.text;
  const note = createNote({ title: selected.title, body: selected.body, notebookId });
  if (selected.attachment) {
    note.attachments.push({ id: nextId('att'), ...selected.attachment });
  }
  state.notes.unshift(note);
  selectedNoteId = note.id;
  closeCreateSheet();
  persistAndRender();
  openEditor();
  elements.titleInput.focus();

  if (kind === 'photo') {
    elements.photoInput.click();
  }
  if (kind === 'attachment') {
    elements.fileInput.click();
  }
}

function handleMobileTab(tab) {
  closeEditor();
  if (tab === 'home') {
    selectedFilter = { type: 'all' };
    setSearch('');
  }
  if (tab === 'search') {
    elements.mobileSearchInput.focus();
  }
  if (tab === 'templates') {
    selectedFilter = { type: 'tag', tag: '模板' };
    setSearch('');
  }
  if (tab === 'me') {
    selectedFilter = { type: 'tasks' };
    setSearch('');
  }
  resetNoteListWindow();
  render();
}

function applySearch(query) {
  setSearch(query);
  selectedFilter = query ? { type: 'search', query } : { type: 'all' };
  resetNoteListWindow();
  render();
}

function setSearch(value) {
  elements.searchInput.value = value;
  elements.mobileSearchInput.value = value;
}

function render() {
  renderCounters();
  renderNotebooks();
  renderTags();
  renderNoteList();
  renderEditor();
  markFilterButton();
}

function renderCounters() {
  const activeNotes = state.notes.filter((note) => note.status !== 'trash');
  elements.countAll.textContent = activeNotes.length;
  elements.countShortcuts.textContent = activeNotes.filter((note) => note.shortcut).length;
  elements.countTasks.textContent = activeNotes.filter((note) => (note.tasks || []).some((task) => !task.done)).length;
  elements.countAttachments.textContent = activeNotes.filter((note) => (note.attachments || []).length > 0).length;
  elements.countTrash.textContent = state.notes.filter((note) => note.status === 'trash').length;
}

function renderNotebooks() {
  elements.notebookList.innerHTML = '';
  for (const notebook of state.notebooks) {
    const count = state.notes.filter((note) => note.status !== 'trash' && note.notebookId === notebook.id).length;
    const button = document.createElement('button');
    button.className = 'nav-row';
    button.innerHTML = `<span>${escapeHtml(notebook.name)}</span><span>${count}</span>`;
    button.addEventListener('click', () => {
      selectedFilter = { type: 'notebook', notebookId: notebook.id };
      setSearch('');
      resetNoteListWindow();
      render();
    });
    elements.notebookList.append(button);
  }

  elements.notebookSelect.innerHTML = state.notebooks
    .map((notebook) => `<option value="${escapeHtml(notebook.id)}">${escapeHtml(notebook.name)}</option>`)
    .join('');
}

function renderTags() {
  const counts = new Map();
  for (const note of state.notes.filter((item) => item.status !== 'trash')) {
    for (const tag of note.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  elements.tagList.innerHTML = '';
  for (const [tag, count] of [...counts.entries()].sort()) {
    const button = document.createElement('button');
    button.className = 'tag-pill';
    button.textContent = `${tag} ${count}`;
    button.addEventListener('click', () => {
      selectedFilter = { type: 'tag', tag };
      setSearch('');
      resetNoteListWindow();
      render();
    });
    elements.tagList.append(button);
  }
  if (!counts.size) {
    elements.tagList.innerHTML = '<div class="empty-state">暂无标签</div>';
  }
}

function renderNoteList() {
  const allNotes = filteredNotes();
  const notes = allNotes.slice(0, renderedNoteLimit);
  elements.listTitle.textContent = titleForFilter();
  elements.listSubtitle.textContent = selectedFilter.type === 'all' ? '最近更新' : '筛选结果';
  elements.noteList.innerHTML = '';
  if (!allNotes.length) {
    elements.noteList.innerHTML = '<div class="empty-state">没有匹配的笔记</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    const row = document.createElement('div');
    row.className = `note-swipe-row ${note.id === selectedNoteId ? 'is-active' : ''}`;
    row.dataset.noteId = note.id;

    const actions = document.createElement('div');
    actions.className = 'note-swipe-actions';
    actions.innerHTML = '<button class="note-delete-action" type="button" aria-label="删除"><span aria-hidden="true" class="trash-icon"></span></button>';

    const button = document.createElement('div');
    button.className = 'note-row note-swipe-content';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    const attachment = (note.attachments || [])[0];
    button.innerHTML = `
      <div class="note-main">
        <div class="note-row-title">${escapeHtml(note.title || '无标题笔记')}</div>
        <div class="note-row-snippet">${escapeHtml(textFromHtml(note.body) || '空白笔记')}</div>
        <div class="note-row-meta">
          <span>${formatDate(note.updatedAt)}</span>
          ${note.shortcut ? '<span class="meta-chip">星标</span>' : ''}
          ${(note.tasks || []).some((task) => !task.done) ? '<span class="meta-chip">待办</span>' : ''}
          ${(note.attachments || []).length ? `<span class="meta-chip">附件 ${(note.attachments || []).length}</span>` : ''}
        </div>
      </div>
      <div class="note-thumb">${attachmentPreviewMarkup(attachment)}</div>
    `;
    const mediaStrip = buildNoteListAttachmentStrip(note);
    if (mediaStrip) {
      const snippet = button.querySelector('.note-row-snippet');
      button.querySelector('.note-main')?.insertBefore(mediaStrip, snippet);
    }
    if ((note.attachments || []).length) {
      button.querySelector('.note-row-meta .meta-chip:last-child')?.remove();
    }
    const snippet = button.querySelector('.note-row-snippet');
    const listSnippet = noteListSnippetText(note);
    if (snippet && listSnippet) {
      snippet.textContent = listSnippet;
    }
    if (snippet && !listSnippet) {
      snippet.remove();
    }
    button.querySelector('.note-thumb')?.remove();
    button.addEventListener('click', () => {
      if (row.dataset.swipeSuppressClick === '1') {
        row.dataset.swipeSuppressClick = '0';
        return;
      }
      selectedNoteId = note.id;
      markActiveNoteRow();
      renderEditor();
      openEditor();
      loadNoteDetail(note.id);
    });
    actions.querySelector('.note-delete-action').addEventListener('click', (event) => {
      event.stopPropagation();
      confirmAndDeleteNote(note.id);
    });
    row.append(actions, button);
    wireNoteSwipe(row, button, note.id);
    fragment.append(row);
  }
  elements.noteList.append(fragment);

  if (renderedNoteLimit < allNotes.length) {
    const sentinel = document.createElement('div');
    sentinel.className = 'note-list-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    elements.noteList.append(sentinel);
  }
}

function resetNoteListWindow() {
  renderedNoteLimit = NOTE_LIST_INITIAL_LIMIT;
  if (elements.homeSurface) {
    elements.homeSurface.scrollTop = 0;
  }
}

function maybeExtendNoteList() {
  if (!elements.homeSurface) return;
  const remaining = elements.homeSurface.scrollHeight - elements.homeSurface.scrollTop - elements.homeSurface.clientHeight;
  if (remaining > NOTE_LIST_SCROLL_THRESHOLD) return;
  const total = filteredNotes().length;
  if (renderedNoteLimit >= total) return;
  renderedNoteLimit = Math.min(total, renderedNoteLimit + NOTE_LIST_BATCH_SIZE);
  renderNoteList();
}

function markActiveNoteRow() {
  elements.noteList.querySelectorAll('.note-swipe-row').forEach((row) => {
    row.classList.toggle('is-active', row.dataset.noteId === selectedNoteId);
  });
}

function updateRenderedNoteRow(note) {
  const row = elements.noteList.querySelector(`.note-swipe-row[data-note-id="${cssEscape(note.id)}"]`);
  if (!row) return;
  const title = row.querySelector('.note-row-title');
  const snippet = row.querySelector('.note-row-snippet');
  if (title) title.textContent = note.title || 'Untitled note';
  if (snippet) snippet.textContent = noteListSnippetText(note);
}

function noteListSnippetText(note) {
  const text = (textFromHtml(note.body) || note.snippet || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const compact = text.replace(/[\s·,，.。;；:：、]+/g, '');
  if (/^(附件|图片|文件)+$/u.test(compact)) return '';
  return text;
}

function buildNoteListAttachmentStrip(note) {
  const attachments = (note.attachments || []).slice(0, 4);
  if (!attachments.length) return null;
  const strip = document.createElement('div');
  strip.className = 'note-row-attachments';
  for (const attachment of attachments) {
    if (attachment.kind === 'image' && attachment.url) {
      const preview = document.createElement('button');
      preview.className = 'note-row-image-chip';
      preview.type = 'button';
      preview.dataset.attachmentId = attachment.id || '';
      preview.setAttribute('aria-label', attachment.name || '图片');
      preview.innerHTML = previewImageMarkup(attachment.thumbnailUrl || attachment.url, attachment.url, '', { lazy: true });
      preview.addEventListener('click', (event) => {
        event.stopPropagation();
        openImagePreview(attachment.url, attachment.name || '图片');
      });
      strip.append(preview);
      continue;
    }
    const chip = document.createElement(attachment.url ? 'button' : 'span');
    chip.className = 'note-row-attachment-chip';
    chip.dataset.attachmentId = attachment.id || '';
    if (attachment.url) {
      chip.type = 'button';
      chip.setAttribute('aria-label', attachment.name || attachmentTypeInfo(attachment).label);
      chip.addEventListener('click', (event) => {
        event.stopPropagation();
        openAttachmentPreview(attachment);
      });
    }
    chip.innerHTML = attachmentIconMarkup(attachment, 'small');
    strip.append(chip);
  }
  if ((note.attachments || []).length > attachments.length) {
    const more = document.createElement('span');
    more.className = 'note-row-attachment-chip';
    more.textContent = `+${(note.attachments || []).length - attachments.length}`;
    strip.append(more);
  }
  return strip;
}

function wireNoteSwipe(row, content, noteId) {
  let startX = 0;
  let startY = 0;
  let offset = 0;
  let swiping = false;
  let pointerId = null;
  let mouseTracking = false;

  const trackMove = (clientX, clientY, event) => {
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (!swiping && dx < -8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      swiping = true;
      row.dataset.swipeSuppressClick = '1';
      closeOtherSwipeRows(row);
    }
    if (!swiping) return;
    event.preventDefault();
    offset = Math.min(Math.max(-dx, 0), SWIPE_DELETE_WIDTH + 34);
    setSwipeOffset(row, offset);
  };

  content.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.note-row-image-chip')) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    startX = event.clientX;
    startY = event.clientY;
    offset = 0;
    swiping = false;
    pointerId = event.pointerId;
    content.setPointerCapture?.(event.pointerId);
  });

  content.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    trackMove(event.clientX, event.clientY, event);
  });

  const finish = () => {
    if (!swiping) return;
    if (offset >= SWIPE_DELETE_WIDTH) {
      setSwipeOffset(row, window.innerWidth || SWIPE_DELETE_WIDTH + 80);
      deleteNoteById(noteId, { confirmed: true });
      return;
    }
    if (offset >= 36) {
      setSwipeOffset(row, SWIPE_REVEAL_WIDTH);
      return;
    }
    setSwipeOffset(row, 0);
    window.setTimeout(() => {
      row.dataset.swipeSuppressClick = '0';
    }, 0);
  };

  content.addEventListener('pointerup', finish);
  content.addEventListener('pointercancel', () => setSwipeOffset(row, 0));

  const mouseMove = (event) => {
    if (!mouseTracking) return;
    trackMove(event.clientX, event.clientY, event);
  };
  const mouseFinish = () => {
    window.removeEventListener('mousemove', mouseMove);
    window.removeEventListener('mouseup', mouseFinish);
    mouseTracking = false;
    finish();
  };
  content.addEventListener('mousedown', (event) => {
    if (event.target.closest('.note-row-image-chip')) return;
    if (event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    offset = 0;
    swiping = false;
    mouseTracking = true;
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseFinish);
  });
}

function setSwipeOffset(row, offset) {
  const content = row.querySelector('.note-swipe-content');
  if (!content) return;
  const bounded = Math.max(0, offset);
  content.style.transform = `translateX(${-bounded}px)`;
  row.classList.toggle('is-open', bounded >= SWIPE_REVEAL_WIDTH - 4);
  row.classList.toggle('is-commit', bounded >= SWIPE_DELETE_WIDTH);
  if (bounded === 0) {
    row.dataset.swipeSuppressClick = '0';
  }
}

function closeOtherSwipeRows(activeRow) {
  elements.noteList.querySelectorAll('.note-swipe-row.is-open').forEach((row) => {
    if (row !== activeRow) {
      setSwipeOffset(row, 0);
    }
  });
}

function confirmAndDeleteNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  const title = note?.title || '这条笔记';
  if (!window.confirm(`确认删除“${title}”？`)) {
    const row = elements.noteList.querySelector(`.note-swipe-row[data-note-id="${cssEscape(noteId)}"]`);
    if (row) setSwipeOffset(row, 0);
    return;
  }
  deleteNoteById(noteId, { confirmed: true });
}

async function deleteNoteById(noteId, { confirmed = false } = {}) {
  const index = state.notes.findIndex((note) => note.id === noteId);
  if (index < 0) return;
  const [removed] = state.notes.splice(index, 1);
  if (selectedNoteId === noteId) {
    selectedNoteId = filteredNotes()[0]?.id || state.notes.find((note) => note.status !== 'trash')?.id || null;
    closeEditor();
  }
  render();
  try {
    const response = await fetch(`/api/v1/app/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`delete failed: ${response.status}`);
    }
    elements.syncStatus.textContent = confirmed ? '笔记已删除' : '本地已保存';
  } catch (error) {
    state.notes.splice(Math.min(index, state.notes.length), 0, removed);
    selectedNoteId = selectedNoteId || removed.id;
    elements.syncStatus.textContent = '删除失败，已恢复';
    render();
    console.error(error);
  }
}

function renderEditor() {
  const note = selectedNote();
  if (!note) {
    elements.titleInput.value = '';
    elements.bodyEditor.innerHTML = '';
    elements.tagInput.value = '';
    elements.taskList.innerHTML = '<div class="empty-state">选择或新建一篇笔记</div>';
    elements.attachmentList.innerHTML = '<div class="empty-state">暂无附件</div>';
    return;
  }

  elements.titleInput.value = note.title || '';
  elements.bodyEditor.innerHTML = note.body || '';
  elements.notebookSelect.value = note.notebookId || state.notebooks[0]?.id || '';
  elements.tagInput.value = (note.tags || []).join(', ');
  elements.shortcutButton.textContent = note.shortcut ? '★' : '☆';
  elements.restoreButton.hidden = note.status !== 'trash';
  elements.trashButton.hidden = note.status === 'trash';
  renderTasks(note);
  renderAttachments(note);
}

function renderTasks(note) {
  elements.taskList.innerHTML = '';
  const tasks = note.tasks || [];
  if (!tasks.length) {
    elements.taskList.innerHTML = '<div class="empty-state">暂无待办</div>';
    return;
  }
  for (const task of tasks) {
    const row = document.createElement('label');
    row.className = 'task-row';
    row.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''}><span>${escapeHtml(task.text)}</span>`;
    row.querySelector('input').addEventListener('change', (event) => {
      task.done = event.target.checked;
      touch(note);
      persistAndRender();
    });
    elements.taskList.append(row);
  }
}

function renderAttachments(note) {
  elements.attachmentList.innerHTML = '';
  const attachments = note.attachments || [];
  if (!attachments.length) {
    elements.attachmentList.innerHTML = '<div class="empty-state">暂无附件</div>';
    return;
  }
  for (const attachment of attachments) {
    const row = document.createElement('div');
    row.className = 'attachment-row';
    row.innerHTML = `
      <div class="attachment-preview">${attachmentPreviewMarkup(attachment)}</div>
      <div>
        <div class="attachment-name">${escapeHtml(attachment.name)}</div>
        <div class="attachment-kind">${attachmentKindLabel(attachment)}</div>
      </div>
      <button class="icon-button" data-remove-attachment="${escapeHtml(attachment.id)}" title="移除">×</button>
    `;
    if (attachment.url) {
      row.classList.add('is-openable');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', (event) => {
        if (event.target.closest('[data-remove-attachment]')) return;
        openAttachmentPreview(attachment);
      });
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openAttachmentPreview(attachment);
      });
    }
    row.querySelector('[data-remove-attachment]').addEventListener('click', () => {
      note.attachments = note.attachments.filter((item) => item.id !== attachment.id);
      touch(note);
      persistAndRender();
    });
    elements.attachmentList.append(row);
  }
}

function addTaskToSelected() {
  const note = selectedNote();
  if (!note) return;
  const text = prompt('待办内容');
  if (!text?.trim()) return;
  note.tasks = note.tasks || [];
  note.tasks.push({ id: nextId('task'), text: text.trim(), done: false });
  touch(note);
  persistAndRender();
}

function attachSelectedFile(input, forcedKind) {
  const note = selectedNote();
  const file = input.files?.[0];
  input.value = '';
  if (!note || !file) return;

  const kind = forcedKind === 'image' || file.type.startsWith('image/') ? 'image' : 'file';
  const pending = (note.attachments || []).find((item) => item.pending && item.kind === kind);
  const attachment = pending || { id: nextId('att') };
  attachment.name = file.name;
  attachment.kind = kind;
  attachment.size = file.size;
  attachment.type = file.type || 'application/octet-stream';
  attachment.pending = false;
  if (kind === 'image') {
    attachment.previewId = attachment.id;
    sessionObjectUrls.set(attachment.previewId, URL.createObjectURL(file));
  }
  if (!pending) {
    note.attachments = note.attachments || [];
    note.attachments.push(attachment);
  }
  touch(note);
  persistAndRender();
}

function filteredNotes() {
  let notes = [...state.notes];
  if (selectedFilter.type !== 'trash') {
    notes = notes.filter((note) => note.status !== 'trash');
  }
  if (selectedFilter.type === 'trash') {
    notes = notes.filter((note) => note.status === 'trash');
  }
  if (selectedFilter.type === 'shortcuts') {
    notes = notes.filter((note) => note.shortcut);
  }
  if (selectedFilter.type === 'tasks') {
    notes = notes.filter((note) => (note.tasks || []).some((task) => !task.done));
  }
  if (selectedFilter.type === 'attachments') {
    notes = notes.filter((note) => (note.attachments || []).length > 0);
  }
  if (selectedFilter.type === 'notebook') {
    notes = notes.filter((note) => note.notebookId === selectedFilter.notebookId);
  }
  if (selectedFilter.type === 'tag') {
    notes = notes.filter((note) => (note.tags || []).includes(selectedFilter.tag));
  }
  if (selectedFilter.type === 'search' && selectedFilter.query) {
    const query = selectedFilter.query.toLowerCase();
    notes = notes.filter((note) => {
      const attachments = (note.attachments || []).map((item) => item.name).join(' ');
      return `${note.title} ${textFromHtml(note.body)} ${(note.tags || []).join(' ')} ${attachments}`.toLowerCase().includes(query);
    });
  }

  const sort = elements.sortSelect.value;
  return notes.sort((a, b) => {
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
    if (sort === 'created') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
}

function updateSelectedFromEditor() {
  const note = selectedNote();
  if (!note) return;
  note.title = elements.titleInput.value.trim() || '无标题笔记';
  note.body = elements.bodyEditor.innerHTML;
  note.notebookId = elements.notebookSelect.value;
  note.tags = elements.tagInput.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  touch(note);
  persist();
  renderCounters();
  updateRenderedNoteRow(note);
  renderTags();
}

function persistAndRender() {
  persist();
  render();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  elements.syncStatus.textContent = '本地已保存';
}

async function loadImportedWorkspace() {
  try {
    const response = await fetch('/api/v1/app/workspace');
    if (!response.ok) {
      throw new Error(`workspace load failed: ${response.status}`);
    }
    const payload = await response.json();
    state.notebooks = (payload.notebooks || []).map((notebook) => ({
      id: notebook.id,
      name: notebook.name
    }));
    state.notes = (payload.notes || []).map((note) => ({
      id: note.id,
      title: note.title,
      body: note.snippet || '',
      snippet: note.snippet || '',
      notebookId: note.notebookId,
      tags: note.tags || [],
      tasks: note.tasks || [],
      attachments: note.attachments || [],
      attachmentCount: note.attachmentCount || 0,
      shortcut: Boolean(note.shortcut),
      reminderAt: note.reminderAt || null,
      status: note.status || 'active',
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      detailLoaded: false
    }));
    selectedNoteId = null;
    elements.syncStatus.textContent = `已载入 ${state.notes.length} 条导入笔记`;
    resetNoteListWindow();
    render();
  } catch (error) {
    elements.syncStatus.textContent = '本地数据加载失败';
    console.error(error);
  }
}

async function loadNoteDetail(noteId) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note || note.detailLoaded) return;
  try {
    const response = await fetch(`/api/v1/app/notes/${encodeURIComponent(noteId)}`);
    if (!response.ok) {
      throw new Error(`note load failed: ${response.status}`);
    }
    const payload = await response.json();
    const detail = payload.note;
    if (!detail) return;
    Object.assign(note, {
      title: detail.title,
      body: detail.body || detail.snippet || '',
      notebookId: detail.notebookId,
      tags: detail.tags || [],
      tasks: detail.tasks || [],
      attachments: detail.attachments || [],
      attachmentCount: detail.attachmentCount || 0,
      shortcut: Boolean(detail.shortcut),
      reminderAt: detail.reminderAt || null,
      status: detail.status || 'active',
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      detailLoaded: true
    });
    if (selectedNoteId === noteId) {
      updateRenderedNoteRow(note);
      renderEditor();
    }
  } catch (error) {
    elements.syncStatus.textContent = '笔记正文加载失败';
    console.error(error);
  }
}

function handleBodyEditorClick(event) {
  const target = event.target.closest('.inline-image-thumb');
  if (!target) return;
  event.preventDefault();
  openImagePreview(target.dataset.imageUrl, target.dataset.imageName || '图片');
}

function handleNoteListAttachmentClick(event) {
  const chip = event.target.closest('.note-row-image-chip,.note-row-attachment-chip');
  if (!chip || !elements.noteList.contains(chip)) return;
  const attachment = findAttachmentById(chip.dataset.attachmentId);
  if (!attachment?.url) return;
  event.preventDefault();
  event.stopPropagation();
  if (chip.classList.contains('note-row-image-chip')) {
    openImagePreview(attachment.url, attachment.name || '图片');
    return;
  }
  openAttachmentPreview(attachment);
}

function handlePreviewImageFallback(event) {
  const image = event.target;
  if (!image?.matches?.('img[data-fallback-src]')) return;
  const fallback = image.dataset.fallbackSrc || '';
  if (!fallback || image.src.endsWith(fallback)) return;
  delete image.dataset.fallbackSrc;
  image.src = fallback;
}

function findAttachmentById(attachmentId) {
  if (!attachmentId) return null;
  for (const note of state.notes || []) {
    const attachment = (note.attachments || []).find((item) => item.id === attachmentId);
    if (attachment) return attachment;
  }
  return null;
}

function openImagePreview(url, name) {
  if (!url) return;
  openPreviewOverlay({
    label: '图片预览',
    content: `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`
  });
}

function openAttachmentPreview(attachment) {
  if (!attachment?.url) return;
  const info = attachmentTypeInfo(attachment);
  if (info.type === 'image') {
    openImagePreview(attachment.url, attachment.name || info.label);
    return;
  }
  if (info.type === 'pdf') {
    const url = `${attachment.url}#toolbar=0&navpanes=0&view=FitH`;
    openPreviewOverlay({
      label: attachment.name || 'PDF',
      overlayClass: 'file-preview-overlay',
      panelClass: 'file-preview-panel pdf-preview-panel',
      content: `
        <iframe class="file-preview-frame pdf-preview-frame" src="${escapeHtml(url)}" title="${escapeHtml(attachment.name || 'PDF')}"></iframe>
        <a class="file-preview-open file-preview-floating-action" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">打开原文件</a>
      `
    });
    return;
  }
  if (info.type === 'word' && attachment.previewUrl) {
    openPreviewOverlay({
      label: attachment.name || info.label,
      overlayClass: 'file-preview-overlay',
      panelClass: 'file-preview-panel document-preview-panel',
      content: `
        <iframe class="file-preview-frame word-preview-frame" src="${escapeHtml(attachment.previewUrl)}" title="${escapeHtml(attachment.name || info.label)}"></iframe>
        <div class="file-preview-floating-actions">
          <a class="file-preview-open" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">打开原文件</a>
          <a class="file-preview-open file-preview-secondary" href="${escapeHtml(attachment.url)}" download>下载</a>
        </div>
      `
    });
    return;
  }
  openPreviewOverlay({
    label: attachment.name || info.label,
    overlayClass: 'file-preview-overlay',
    panelClass: 'file-preview-panel document-preview-panel',
    content: `
      <div class="file-preview-card">
        ${attachmentIconMarkup(attachment, 'large')}
        <div class="file-preview-title">${escapeHtml(attachment.name || info.label)}</div>
        <div class="file-preview-subtitle">${escapeHtml(info.label)}${attachment.size ? ` · ${formatSize(attachment.size)}` : ''}</div>
        <div class="file-preview-actions">
          <a class="file-preview-open" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener">打开文件</a>
          <a class="file-preview-open file-preview-secondary" href="${escapeHtml(attachment.url)}" download>下载</a>
        </div>
      </div>
    `
  });
}

function openPreviewOverlay({ label, content, overlayClass = '', panelClass = '' }) {
  const overlay = document.createElement('div');
  overlay.className = `image-preview-overlay ${overlayClass}`.trim();
  overlay.innerHTML = `
    <button class="image-preview-backdrop" type="button" aria-label="关闭"></button>
    <section class="image-preview-panel ${escapeHtml(panelClass)}" aria-label="${escapeHtml(label)}">
      <div class="image-preview-head" hidden>
        <span>${escapeHtml(label)}</span>
        <button type="button" aria-label="关闭">×</button>
      </div>
      <button class="image-preview-close" type="button" aria-label="Close">×</button>
      ${content}
    </section>
  `;
  const close = () => {
    overlay.remove();
    emitNavigationState();
  };
  overlay.querySelector('.image-preview-backdrop').addEventListener('click', close);
  overlay.querySelector('.image-preview-close').addEventListener('click', close);
  document.body.append(overlay);
  emitNavigationState();
}

function selectedNote() {
  return state.notes.find((note) => note.id === selectedNoteId) || null;
}

function createNote({ title, body, notebookId }) {
  const timestamp = new Date().toISOString();
  return {
    id: nextId('note'),
    title,
    body,
    notebookId,
    tags: [],
    tasks: [],
    attachments: [],
    shortcut: false,
    reminderAt: null,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return seedState();
}

function seedState() {
  const now = new Date().toISOString();
  const inbox = 'notebook_inbox';
  const work = 'notebook_work';
  return {
    notebooks: [
      { id: inbox, name: '收件箱' },
      { id: work, name: '项目资料' },
      { id: 'notebook_archive', name: '归档' }
    ],
    notes: [
      {
        id: nextId('note'),
        title: '欢迎使用 Note',
        body: '<p>这里是离线优先的笔记工作台。首页浏览最近笔记，底部新建入口可创建文字、超级笔记、照片、扫描、录音和附件笔记。</p><ul><li>支持笔记本、标签和快捷方式</li><li>支持照片和文件附件元数据</li><li>真实同步、OCR 和剪藏后续接入</li></ul>',
        notebookId: inbox,
        tags: ['入门', '本地'],
        tasks: [{ id: nextId('task'), text: '确认复刻范围', done: false }],
        attachments: [{ id: nextId('att'), name: '参考截图占位.png', kind: 'image' }],
        shortcut: true,
        reminderAt: null,
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: nextId('note'),
        title: '印象笔记复刻观察',
        body: '<p>已对照中国版印象笔记首页、搜索入口、底部新建面板和快速创建项。当前实现保留功能结构，不使用官方商标、图标或私有素材。</p>',
        notebookId: work,
        tags: ['参考', '产品'],
        tasks: [],
        attachments: [
          { id: nextId('att'), name: '首页布局记录.md', kind: 'document' },
          { id: nextId('att'), name: '附件交互清单.pdf', kind: 'file' }
        ],
        shortcut: false,
        reminderAt: null,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function attachmentPreviewMarkup(attachment) {
  if (!attachment) return '笔';
  const previewUrl = attachment.previewId ? sessionObjectUrls.get(attachment.previewId) : null;
  if (previewUrl) return `<img src="${previewUrl}" alt="" loading="lazy" decoding="async">`;
  if (attachment.kind === 'image' && attachment.url) return previewImageMarkup(attachment.thumbnailUrl || attachment.url, attachment.url, '', { lazy: true });
  return attachmentIconMarkup(attachment, 'medium');
}

function previewImageMarkup(src, fallbackSrc = '', alt = '', options = {}) {
  const fallbackAttr = fallbackSrc && fallbackSrc !== src ? ` data-fallback-src="${escapeHtml(fallbackSrc)}"` : '';
  const loading = options.lazy ? ' loading="lazy"' : '';
  return `<img src="${escapeHtml(src)}"${fallbackAttr} alt="${escapeHtml(alt)}"${loading} decoding="async">`;
}

function attachmentIconMarkup(attachment, size = 'medium') {
  const info = attachmentTypeInfo(attachment);
  return `<span class="file-type-icon file-type-${escapeHtml(info.type)} file-type-${escapeHtml(size)}" aria-hidden="true">${escapeHtml(info.short)}</span>`;
}

function attachmentTypeInfo(attachment = {}) {
  const name = String(attachment.name || '').toLowerCase();
  const mime = String(attachment.mime || attachment.type || '').toLowerCase();
  if (attachment.kind === 'image' || mime.startsWith('image/')) return { type: 'image', short: '图', label: '图片' };
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return { type: 'pdf', short: 'PDF', label: 'PDF' };
  if (mime.includes('word') || mime.includes('officedocument.wordprocessingml') || /\.(doc|docx)$/i.test(name)) {
    return { type: 'word', short: 'W', label: 'Word 文档' };
  }
  if (mime.includes('excel') || mime.includes('spreadsheetml') || /\.(xls|xlsx)$/i.test(name)) {
    return { type: 'excel', short: 'X', label: 'Excel 表格' };
  }
  if (mime.includes('powerpoint') || mime.includes('presentationml') || /\.(ppt|pptx)$/i.test(name)) {
    return { type: 'ppt', short: 'P', label: '演示文稿' };
  }
  if (attachment.kind === 'audio' || mime.startsWith('audio/')) return { type: 'audio', short: '音', label: '音频' };
  if (attachment.kind === 'document') return { type: 'document', short: '文', label: '文档' };
  return { type: 'file', short: '□', label: '文件' };
}

function attachmentKindLabel(attachment) {
  const labels = {
    image: '图片附件',
    document: '文档附件',
    audio: '录音附件',
    file: '文件附件'
  };
  const size = attachment.size ? ` · ${formatSize(attachment.size)}` : '';
  const pending = attachment.pending ? ' · 待选择' : '';
  return `${labels[attachment.kind] || labels.file}${size}${pending}`;
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function nextId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function touch(note) {
  note.updatedAt = new Date().toISOString();
}

function textFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function titleForFilter() {
  const titles = {
    all: '笔记',
    shortcuts: '快捷方式',
    tasks: '待办事项',
    attachments: '附件',
    trash: '废纸篓',
    search: '搜索结果',
    notebook: state.notebooks.find((notebook) => notebook.id === selectedFilter.notebookId)?.name || '笔记本',
    tag: `标签：${selectedFilter.tag}`
  };
  return titles[selectedFilter.type] || '笔记';
}

function markFilterButton() {
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.filter === selectedFilter.type);
  });
}
