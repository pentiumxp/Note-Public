'use strict';

function createWorkspaceViewModel({ notes = [], notebooks = [], selected = {} }) {
  const activeNotes = notes.filter((note) => note.status !== 'trash');
  const filtered = activeNotes.filter((note) => matchesSelected(note, selected));
  const sorted = [...filtered].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const openTasks = activeNotes.flatMap((note) => {
    return (note.tasks || [])
      .filter((task) => !task.done)
      .map((task) => ({
        ...task,
        noteId: note.id,
        noteTitle: note.title
      }));
  });

  return {
    notes: sorted,
    notebooks: notebooks.map((notebook) => ({
      ...notebook,
      count: activeNotes.filter((note) => note.notebookId === notebook.id).length
    })),
    shortcuts: activeNotes.filter((note) => note.shortcut),
    tags: buildTagCounts(activeNotes),
    openTasks,
    counts: {
      all: activeNotes.length,
      trash: notes.length - activeNotes.length,
      shortcuts: activeNotes.filter((note) => note.shortcut).length,
      tasks: openTasks.length
    }
  };
}

function matchesSelected(note, selected) {
  if (selected.query) {
    const query = selected.query.toLowerCase();
    const haystack = `${note.title || ''} ${note.body || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }
  if (selected.notebookId && note.notebookId !== selected.notebookId) {
    return false;
  }
  if (selected.tag && !(note.tags || []).includes(selected.tag)) {
    return false;
  }
  if (selected.shortcut && !note.shortcut) {
    return false;
  }
  if (selected.hasTasks && !(note.tasks || []).some((task) => !task.done)) {
    return false;
  }
  return true;
}

function buildTagCounts(notes) {
  const counts = new Map();
  for (const note of notes) {
    for (const tag of note.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  createWorkspaceViewModel
};

