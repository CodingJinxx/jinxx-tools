# Scan Feature Implementation Prompt

Use this prompt to instruct an AI or developer to implement the Scan feature for the StudyVault / Jinxx Tools plugin. The feature will allow users to run a scan session, detect newly-created single-page PDF files produced by a scanner, merge or append those pages into course PDFs inside the vault, and provide a friendly interactive Suggester UX for choosing the target course or existing scan file.

Scope and constraints
- This feature is implemented as part of the plugin (TypeScript). It may use Node APIs available in the Obsidian desktop environment. It must be optional and disabled by default if Node APIs are not available.
- The plugin already contains course management and settings (BaseFolders, Scans configuration) per earlier migration. This Scan feature should integrate with those settings.
- The feature must be robust on Windows: handle file locks, partial writes, and per-day subfolders created by scanners.
- Do not implement OCR or remote network calls. PDF merging may be performed with a JS library (pdf-lib) bundled into the plugin build;

High-level goals
- Let the user start a "scan session" from a plugin command or ribbon icon.
- Detect which PDF files appeared in the configured scanner drop folder (usually a day subfolder like `2025_10_22` with files `IMG_0001.pdf`, `IMG_0002.pdf`).
- Wait for files to become stable (size unchanged for N ms) to avoid partial reads.
- Provide an interactive UI (Suggester + file list modal) showing detected pages in inferred order and letting the user:
  - pick the target course (via the course suggester),
  - choose to create a New scan PDF or Append to an existing course scan PDF,
  - reorder pages (move up/down) and exclude pages before merging,
  - preview a page (open the PDF page or the file in vault) if feasible.
- Merge pages into a single PDF and save to the chosen course's Scans folder (or append to existing PDF), performing atomic write + optional backup.
- Keep original files unless user opts to delete or move them to an Archive folder.

Data contract (session JSON)
{
  "sessionId": "2025-10-22T10-15-00_abcdef",
  "startedAt": "2025-10-22T10:15:00.000Z",
  "scanRoot": "C:\\Scans\\Canon",
  "dayFolder": "C:\\Scans\\Canon\\2025_10_22",
  "snapshotBefore": { "C:\\...\\IMG_0001.pdf": {size, mtime} },
  "snapshotAfter": { ... },
  "newFiles": [{ path, name, size, mtime, stable:true }]
}

File-detection & stability rules (Windows-safe)
- The scanner produces one PDF file per page, inside a day subfolder named like YYYY_MM_DD.
- Detection: compute snapshotBefore at Start, snapshotAfter at Done. New files = after - before by absolute path.
- Stability heuristic (configurable defaults):
  - stabilityDelayMs: 2000 (wait this long between size checks)
  - stabilityRetries: 4
  - Consider a file stable when size is unchanged across two checks separated by stabilityDelayMs.
  - If a file is locked (access error), retry up to `stabilityRetries` times; surface non-stable files in UI with option to retry later.
- Ordering: prefer numeric sequence in filenames (IMG_0001 → sort by numeric token). If filename doesn't match, fallback to mtime.

Merge / append implementation options (pick one or implement both with runtime detection)
- Option A (recommended for plugin): Use `pdf-lib` (npm package) bundled into plugin build. Benefits: cross-platform, no external dependency. Implementation notes:
  - For each input PDF path, read binary: use `app.vault.adapter.readBinary(absolutePath)` or `fs.readFile` if Node fs is needed.
  - Load each PDF via PDFDocument.load(bytes) and copy pages into a new PDFDocument.
  - Save merged bytes and write via `app.vault.adapter.writeBinary(outPath, outBytes)`.
- Option B (fallback): Use Ghostscript via `child_process.exec` if the executable is present. Pros: Streaming, efficient for many pages. Cons: requires user to install Ghostscript.
- Atomic write: write to temp `<out>.tmp`, then `app.vault.adapter.rename` (or `rename` in Node) to final path. Keep a backup of original target if appending and user setting `makeBackupBeforeAppend` is true.

Suggester UX and interactive flow (detailed)
1. Command "Start Scan Session" (or ribbon icon): record snapshotBefore of current day folder (detect latest YYYY_MM_DD in scan root) and show brief Notice "Scan session started" + brief instructions in modal.
2. User scans pages.
3. Command "Finish Scan Session" (user triggers when done). The plugin:
   - detects the day folder (same as before) and computes snapshotAfter,
   - builds newFiles list, runs stability checks in parallel (with limited concurrency), and marks files stable/unstable.
4. Present an interactive modal showing only stable files in inferred order. Modal features:
   - Left: ordered list of pages (filename, size, mtime) with checkbox to include/exclude and buttons ↑ ↓ to reorder.
   - Right/top: Target selector: a Suggester dropdown to choose Course (list courses discovered by CourseService) and below it a second Suggester listing existing PDFs in that course's Scans folder (for Append option).
   - Buttons: Preview (open selected file), Create New (choose naming pattern), Append to Existing (selected), Merge (perform merge), Cancel.
5. After user confirms Merge:
   - Merge selected files in chosen order.
   - On success, show Notice with output path and which files were included. Offer an action link to open the merged PDF note or to create/update a Course note linking to it.
   - Optionally move original single-page PDFs to an Archive subfolder (configurable setting) or leave them untouched.

UI details & accessibility
- Implement the page-order modal as a standard Obsidian Modal with keyboard navigation and focus management. Use simple icons and descriptive labels.
- The Course suggester should use the existing Suggester to pick course names. Once course is chosen, populate existing-scan suggester by listing .pdf files in the course Scans folder.

Plugin settings related to Scan feature
- scanFolderPath: absolute path to scanner root (string). If blank, show an input prompt first-run.
- stabilityDelayMs, stabilityRetries (numbers)
- defaultOutputFolderTemplate: e.g., `{universityFolder}/Scans/{course}`
- namingPattern: `{course}_{YYYY-MM-DD}_{counter}.pdf`
- keepOriginals: true/false
- archiveAfterMerge: boolean and archive folder path (default `{scanFolder}/archive` or `{universityFolder}/Scans/Originals/{YYYY-MM-DD}`)
- mergeLibrary: `pdf-lib` | `ghostscript` (auto-detect: prefer pdf-lib)
- makeBackupBeforeAppend: boolean

Edge cases & error handling
- No new files: show a Notice and allow restart.
- Some files unstable: show the unstable list in UI and allow 'Retry stability check' or 'Exclude' for now.
- Filename collisions: if output exists, append counter if user chooses Create New; if Append selected, handle atomic merging into temporary file then rename.
- Large sessions: process input files in streaming-friendly batches if using pdf-lib and keep memory usage reasonable (e.g., copy pages incrementally rather than reading all PDFs into memory at once).

Acceptance criteria (must pass)
- Start session and Finish session correctly detect new PDF files created in the scanner day subfolder.
- Stability heuristic prevents partial/incomplete pages from being merged.
- The interactive suggester modal lets the user pick course, choose create/append, reorder files, exclude files, and confirm merge.
- Merged output contains pages in the confirmed order and is saved to the chosen course Scans folder. If appending, target PDF is updated atomically and backup preserved if configured.
- Originals are kept or moved depending on plugin settings; nothing is deleted without explicit user opt-in.

Testing steps
1. Prepare a dummy scanner folder with subfolder `2025_10_22` and files `IMG_0001.pdf`, `IMG_0002.pdf` (small PDFs). Start session then finish session — verify detection and merge flow.
2. Simulate a partial write by writing a file in two parts with delay — ensure stability check rejects it until fully written.
3. Try Append to existing PDF: create `courseA_scan.pdf` in a course Scans folder, then append new pages — verify final PDF includes appended pages and original backed up.

Developer deliverables (for AI)
- Add `src/services/ScanService.ts` with methods: startSession(), endSession(sessionId), detectNewFiles(session), waitForStability(file), orderFiles(files), mergeFiles(files, outPath, appendTo?).
- Add `src/ui/ScanSessionModal.ts` implementing the interactive pages list and target selection UI.
- Wire plugin commands: `Start Scan Session`, `Finish Scan Session`, and optionally a `Scan: Merge Last Session` for quick retry.
- Update plugin SettingsTab to include scan-specific settings described above.
- Unit-testable small functions: file ordering, stability check logic (mock file stats), filename parsing.

Implementation notes & hints
- Use `app.vault.adapter.readBinary(path)` / `writeBinary` for binary IO within the vault.
- For absolute external paths (scanner drop outside vault), prefer Node's `fs.promises` when available; provide graceful fallback or clear error message if Node fs isn't allowed.
- When using pdf-lib, prefer the incremental page-copy pattern: load source PDF, copy pages into destination PDFDocument, then free the source reference.

Security and safety notes
- Never execute arbitrary files from the scanner folder. Only perform read operations and write merged outputs into vault-controlled paths.
- If enabling external executables (Ghostscript), ensure user consent in Settings and show clear instructions for installing the external tool.

Final instruction to the AI agent
- Implement the Scan feature as specified above. Produce a patch/commit with new files and modifications to Settings and plugin commands. Add README usage and a short demo script describing how to test the feature. If any platform-specific limitation prevents a required behavior, state it clearly in the commit message and in the README.
