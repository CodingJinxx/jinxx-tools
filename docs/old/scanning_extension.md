# Scanning Extension Idea

I bought a Canon scanner for scanning my handwritten notes for uni. The scanner produces one PDF per page. The goal of this plugin is to let me capture a scanning session from inside Obsidian, detect newly created PDF pages, combine them into a single PDF, and then either create a new course scan or append/extend an existing course PDF.

This document captures a proposed design, a small data contract for the scan session, file-detection rules and edge cases, configuration suggestions, the UI flow for the plugin, and a short list of questions for refinement.

Goals
- Let the user start a "scan session" from Obsidian.
- Detect which files were added to the scanner drop folder during the session.
- Merge those single-page PDFs into a single document in the vault, or append them to an existing scan PDF.
- Offer a course/file suggester so the user can choose where to put the output.
- Keep the process robust on Windows (file locks, partial writes) and safe (don't lose originals unless configured).

High-level contract (tiny)
- Input: scanFolder (absolute or vault-relative), session start snapshot (list of file metadata), session end snapshot.
- Output: merged PDF saved to an output folder (e.g. course folder) with a generated filename; optional updated markdown note linking to the PDF.
- Failure modes: file locked/incomplete; no new files added; selected target PDF unavailable for append.

Data model for a scan session (JSON shape)
{
	"sessionId": "2025-10-22T10-15-00_abcdef",
	"startedAt": "2025-10-22T10:15:00.000Z",
	"scanFolder": "C:\\Scans\\Canon\\Today",
	"snapshotBefore": [
		{ "path": "C:\\Scans\\Canon\\Today\\scan_0001.pdf", "size": 12345, "mtime": 163... }
	],
	"snapshotAfter": [ ... ],
	"newFiles": [
		{ "path": "C:\\Scans\\Canon\\Today\\scan_0002.pdf", "size": 23456, "mtime": 163..., "stable": true }
	]
}

File detection & stability
- Don't assume a file is complete immediately after it appears. Use a stability heuristic:
	- Wait until the file's size has not changed for N ms (configurable, default 1500-3000 ms).
	- Retry-check a small number of times if file is still changing.
	- Optionally consider checking that the file can be opened by the pdf library (fast open+close) as a final check.
- Detect new files by comparing the snapshotBefore and snapshotAfter by full path. Optionally also detect by hash if files may be overwritten.
- Ordering: use filename's natural sort (or mtime) to preserve scan order. Provide a user override if needed.

PDF merging / append behaviour
- Merge libraries: prefer a pure-JS library that works in Obsidian's environment, e.g. `pdf-lib` or `HummusJS` (if supported). If native commands are wanted, document fallback invocations (`ghostscript`, `pdftk`) but prefer avoiding external deps.
- Append mode: if the user selects an existing PDF to extend, merge new pages into that file and replace it atomically (write to temp file then rename). Keep a backup of the original unless user opts-out.
- Output naming: configurable pattern, e.g. `{courseSlug}_{YYYY-MM-DD}_{counter}.pdf` or `{courseSlug}_{noteTitle}_{YYYYMMDD}.pdf`.

Course mapping & suggester
- Provide a suggester that lists either course folders in the vault or course notes (detect by a prefix or a configured folder).
- For "Add New": allow selecting a course and a generated filename; create the merged PDF there and optionally create a markdown note with a link and metadata (date, pages, source files).
- For "Extend Existing": list existing scan PDFs for the chosen course (filtered by file extension and perhaps a tag in their note). Let the user choose which to append to.

Config options (example for `config.json`)
- scanFolder: absolute path to drop folder or relative to vault (string)
- tempWaitMs: 2000
- stabilityRetries: 3
- outputFolderTemplate: "Courses/{course}/Scans"
- namingPattern: "{course}_{date}_{counter}.pdf"
- mergeLibrary: "pdf-lib"  # or "ghostscript" for external
- keepOriginals: true
- makeBackupBeforeAppend: true
- ocrEnabled: false
- ocrLanguage: "eng"

UI flow (minimal)
1. User clicks "Start scanning" in the plugin command palette or ribbon.
2. Plugin records a snapshot of files currently in `scanFolder` and shows a small toast: "Scanning session started".
3. User scans pages; the scanner deposits many single-page PDFs into the drop folder.
4. User clicks "Done scanning".
5. Plugin scans the folder again, computes new files, waits for stability, then shows a file preview list and asks for target via suggester: "Choose course" -> "Add New" or "Append to existing".
6. After confirmation the plugin merges pages in order and writes the output PDF to the chosen location. Optionally create/update a note linking to it. Show success/failure notification and report which files were included.

Edge cases and error handling
- No new files: notify user and allow restarting the session.
- Partially written/locked files: skip them, report them to user, and offer retry.
- Duplicate scans (same page scanned twice): leave duplicates as-is by default; provide an optional deduplication step (compare page images / hashes) as a later enhancement.
- Large scan sessions: stream pages into the output to avoid high memory usage; prefer a library or technique that supports incremental writes.
- Filename collisions: use atomic write with temp name + final rename and optionally increment a counter when name already exists.

Acceptance criteria (basic)
- Starting and stopping a session reliably detects new files in the drop folder on Windows.
- Merged output PDF contains pages in the expected order.
- User can choose to create a new course scan or append to an existing PDF.

Questions / clarifications for you
1. What is the exact path pattern where the scanner drops files? Is it a single folder or date subfolders (you mentioned per-day subfolders)? If subfolders are used, do you want the plugin to scan subfolders recursively?
2. How do you identify courses today in your vault? By folder names, by a list in `config.json`, or by tagged notes? Which would you prefer the plugin to use as the suggester source?
3. Do you want originals deleted after merging, or kept by default? If deleted, should they go to a configurable trash folder?
4. Do you want OCR integrated in the initial version or deferred to a later step?
5. Which merge strategy do you prefer: pure JS (bundled) or calling an external tool (Ghostscript) installed on your machine? (Pure JS is easier for cross-platform plugin distribution.)

Next steps (if you agree with this design)
- Decide answers to the questions above.
- Pick desired defaults for `config.json` (scan folder, output folder, delete/keep originals).
- I can then implement a snapshot/detection prototype in `jinxx-quickadd.js` as you asked, or wait while you provide your opinions about implementation.

---

If this matches your expectations I can commit this text to the repo (done), and we can move on to the implementation decisions you mentioned.
