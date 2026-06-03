'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createWorkspaceViewModel } = require('../src/view-models/workspace-view-model');

test('projects notebook counts, shortcuts, tags, and open tasks', () => {
  const model = createWorkspaceViewModel({
    notebooks: [{ id: 'inbox', name: 'Inbox' }],
    notes: [
      {
        id: 'n1',
        title: 'Inbox note',
        body: 'alpha',
        notebookId: 'inbox',
        tags: ['work'],
        shortcut: true,
        updatedAt: '2026-06-02T02:00:00.000Z',
        tasks: [{ id: 't1', text: 'Review', done: false }]
      },
      {
        id: 'n2',
        title: 'Trash note',
        body: 'beta',
        notebookId: 'inbox',
        tags: ['old'],
        status: 'trash',
        updatedAt: '2026-06-02T01:00:00.000Z',
        tasks: []
      }
    ]
  });

  assert.equal(model.counts.all, 1);
  assert.equal(model.counts.trash, 1);
  assert.equal(model.notebooks[0].count, 1);
  assert.equal(model.shortcuts[0].id, 'n1');
  assert.deepEqual(model.tags, [{ name: 'work', count: 1 }]);
  assert.equal(model.openTasks[0].noteTitle, 'Inbox note');
});

test('filters by search, notebook, tag, shortcut, and tasks', () => {
  const notes = [
    {
      id: 'n1',
      title: 'Meeting',
      body: 'project alpha',
      notebookId: 'work',
      tags: ['project'],
      shortcut: true,
      tasks: [{ id: 't1', text: 'Send recap', done: false }]
    },
    {
      id: 'n2',
      title: 'Recipe',
      body: 'alpha',
      notebookId: 'home',
      tags: ['kitchen'],
      shortcut: false,
      tasks: []
    }
  ];

  const model = createWorkspaceViewModel({
    notes,
    selected: {
      query: 'alpha',
      notebookId: 'work',
      tag: 'project',
      shortcut: true,
      hasTasks: true
    }
  });

  assert.deepEqual(model.notes.map((note) => note.id), ['n1']);
});

