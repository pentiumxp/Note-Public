'use strict';

function createMemoryNoteStore(initialNotes = []) {
  const notes = new Map(initialNotes.map((note) => [note.id, { ...note }]));

  return {
    async save(note) {
      notes.set(note.id, { ...note });
      return { ...note };
    },

    async get(id) {
      const note = notes.get(id);
      return note ? { ...note } : null;
    },

    async list() {
      return [...notes.values()].map((note) => ({ ...note }));
    },

    async remove(id) {
      return notes.delete(id);
    }
  };
}

module.exports = {
  createMemoryNoteStore
};

