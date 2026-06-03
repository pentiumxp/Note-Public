# Attachment Asset Store

## Decision

Note does not store attachment bytes in the main Note SQLite database.

The storage split is:

- `note.sqlite3`: notes, notebooks, note attachment metadata, and note-to-attachment references.
- `attachment.sqlite3`: attachment asset ledger, content hashes, logical attachment objects, status, and integrity records.
- `data/attachments`: attachment bytes, stored by content hash under Note-owned paths.
- `data/thumbnails`: generated image preview bytes for fast list and inline rendering.

This keeps note queries fast while making attachments auditable and recoverable.

## Required Guarantees

Attachments are first-class data. Images, PDF, Word, and other imported files must not be silently lost or corrupted.

Every persisted attachment file must have:

- `sha256`
- byte size
- MIME type
- workspace id
- logical attachment id
- internal storage key
- status: `active`, `missing`, or `deleted`

The Note UI and APIs must never derive file paths from user-provided filenames. User filenames are display metadata only.

## Write Flow

Attachment writes must follow this order:

1. Write bytes to a temporary file under the attachment root.
2. Compute `sha256` and byte size from the actual bytes.
3. Rename the temp file to the content-addressed final path.
4. Record or update the blob in `attachment.sqlite3`.
5. Record the workspace-bound attachment object in `attachment.sqlite3`.
6. Store only bounded metadata in `note.sqlite3`, including the internal `storageKey`.

If bytes are unavailable, record the object as `missing`; do not create a fake active attachment.

## Content-Addressed Paths

Final storage keys use the hash, not the original filename:

```text
<safe_workspace_id>/<sha256[0..1]>/<sha256><ext>
```

Example:

```text
note_yinxiang_import/9a/9a...ef.pdf
```

This enables deduplication and makes integrity checking deterministic.

## Attachment SQLite Schema

`attachment.sqlite3` owns these tables:

- `attachment_blobs`
  - one row per unique content hash
  - tracks `sha256`, `size`, `mime`, `storage_key`, `status`, and timestamps
- `attachment_objects`
  - one row per logical note attachment
  - tracks `workspace_id`, `note_id`, `attachment_id`, display name, kind, blob hash, source hash, and status
- `attachment_integrity_checks`
  - append-only integrity scan results

All object queries must filter by `workspace_id`.

## Preview Rules

The browser may render:

- images as image previews
- PDFs in an iframe preview when the browser supports it

Image thumbnails are real derivative files, not original images scaled by CSS. List rows, attachment rows, and inline imported image grids should load `thumbnailUrl` first and only load the original attachment URL when the user opens the full image preview.

The thumbnail backfill is idempotent:

```powershell
node scripts/backfill-image-thumbnails.js --workspace-id note:yinxiang_import
```

File previews in embedded mobile mode should fill the Note iframe viewport. PDF previews use an iframe with fit-to-width hints. DOCX/Word previews use the local `/api/v1/app/attachments/:id/preview` route, which extracts `word/document.xml` from the DOCX package and renders bounded HTML inside an iframe. Legacy Word files or conversion failures fall back to a file preview card with open and download actions.

## Backup And Recovery

A valid backup contains all three pieces:

- `note.sqlite3`
- `attachment.sqlite3`
- `data/attachments`
- `data/thumbnails`

Recovery must compare `attachment_blobs.storage_key` against files on disk and verify `sha256` for active blobs.
