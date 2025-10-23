# Transitioning `jinxx-quickadd.js` → Standalone Obsidian Plugin

This document describes how to port the existing QuickAdd user script `jinxx-quickadd.js` into a standalone Obsidian plugin. The immediate goal is to reproduce the script's current functionality (suggester, prompts, course management, config editing) inside a plugin. NOTE: any PDF scanning, merging, OCR, or scan-watcher features are explicitly deferred for a later phase — this transition focuses only on matching current QuickAdd behaviour.

Audience: a developer or an AI that will implement the plugin. The steps map QuickAdd helpers to Obsidian plugin equivalents, list required files, and provide acceptance criteria and smoke tests.

High-level goals
- Preserve the QuickAdd features implemented in `jinxx-quickadd.js`:
	- Action registration (addCourse, editConfig, delete/archive/restore/manage/rename courses)
	- Config-driven base folders (read from `95_Scripts/config.json`)
	- Interactive UI flows (suggester lists, input prompts, yes/no confirmations, notices)
	- Vault operations via `app.vault` (createFolder, create, rename, delete, read, modify)
- Provide plugin-friendly equivalents for QuickAdd helpers (suggester, inputPrompt, notice, yesNoPrompt)
-- Keep the same directory conventions (University → Courses, Attachments, Notes, Scans)

Repository preparation (what to copy into the plugin project)
- Copy your `95_Scripts` folder (or at minimum `95_Scripts/quickAdd/jinxx-quickadd.js` and `95_Scripts/config.json`) into the plugin repo as a read-only reference. Suggested path inside your plugin repo:
	- `reference/95_Scripts/...` or `study-vault/reference/95_Scripts/...`
- This copy is for developer convenience (to keep the original script as a behaviour reference). The plugin must reimplement behaviour using Obsidian APIs; do not execute QuickAdd code directly.

IMPORTANT: Excluded / Deferred features for this transition
- Do NOT implement any scanning/PDF-related features (PDF merging, scan-session detection, OCR, or file-watching) in this migration. Those features are out of scope for this phase and should be planned and implemented later once the core course and config workflows are stable.

Constraints & assumptions
- This plugin will run in desktop Obsidian (Electron) and can use Obsidian plugin APIs. Node APIs may be available but use them only for non-mobile-only features.
- The existing `config.json` file lives at `95_Scripts/config.json` in the vault. The plugin will read that file for `BaseFolders` and `Scans.WatchFolders` configuration.
- QuickAdd helper functions (suggester, inputPrompt, etc.) are NOT available in a standalone plugin and must be replaced by Obsidian UI primitives (modals, SuggestModal, Notice).

Mapping QuickAdd helpers → Obsidian equivalents
- quickAddApi.suggester(display[], values[], placeholder) → FuzzySuggestModal subclass that returns the chosen value (or null on cancel). See `SimpleSuggester` example below.
- quickAddApi.inputPrompt(prompt, default?) → Small Modal with a single-line input (Promise-based) or use `new PromptModal(app, prompt)` helper.
- quickAddApi.yesNoPrompt(prompt) → Modal with Yes/No buttons resolving to true/false.
- quickAddApi.notice(msg) → `new Notice(msg)`
- app.vault.* → same Obsidian API: use `this.app.vault` inside plugin classes.

Suggested plugin structure
- study-vault/ (plugin repo root)
	- manifest.json
	- package.json (dev tooling, build scripts)
	- src/
		- main.ts        // plugin entry (implements Obsidian's Plugin class)
		- ui/
			- SimpleSuggester.ts  // thin wrapper around FuzzySuggestModal
			- PromptModal.ts      // small single-input modal for text prompts
			- YesNoModal.ts       // confirm modal
		- services/
			- ConfigService.ts    // reads/writes `95_Scripts/config.json` via App.vault
			- CourseService.ts    // encapsulates course operations (create, delete, archive, rename, list)
			- ArchiveService.ts   // archive/restore helpers
		- commands/
			- ManageCoursesCommand.ts  // registers command to open the manage UI
			- AddCourseCommand.ts      // optional separate command
		- utils/
			- file.ts (helpers for safe write/atomic rename/exists)
	- README.md

Minimal feature-by-feature porting notes

1) Action registration and command palette
- QuickAdd exposes a top-level suggest-and-dispatch flow; in the plugin create one or more commands:
	- A main command: `StudyVault: Open Tools` which opens a `SimpleSuggester` listing the same actions that were registered in `jinxx-quickadd.js` (Add Course, Edit Config, Manage Courses, etc.).
	- Optionally register each action as its own command (Add Course, Manage Courses) for users who prefer the command palette.

2) Config loading (loadConfig)
- Implement `ConfigService.readConfig()` that reads the vault-relative path `95_Scripts/config.json` using `this.app.vault.getAbstractFileByPath()` and `this.app.vault.read(file)`. If missing, create it with `{}` similar to the script.
- Keep same normalization (replace backslashes with '/'). Return parsed JSON.

3) Suggester and prompts
- Implement `SimpleSuggester` (see example below) and `PromptModal` and `YesNoModal` for interaction. Each should return a Promise so plugin code can `await` user input.

4) Course operations
- Implement `CourseService` with methods:
	- listCourses(): returns course names (reads `BaseFolders.University/Courses` and lists .md files)
	- createCourse(courseName, template?): replicates `addCourse` behavior (create note + Attachments/Notes/Scans subfolders + create lecture subfolders per `LectureSubfolderOptions`)
	- deleteCourse(courseName): uses the `deleteFolderRecursively` pattern (use vault API to delete files/folders in correct order)
	- archiveCourse(courseName): move files into `BaseFolders.University/Archive/<course>_<timestamp>/...` as in the script
	- renameCourse(oldName, newName): rename note and per-course folders; if destination exists, prompt archive/rename as the script does

Keep the same acceptance criteria: no accidental overwrites, confirm destructive actions, produce a compact summary object for notices.

5) Restore / Manage loop
- Implement `ManageCoursesCommand` which uses `listCourses()` and the `SimpleSuggester` to present choices, then show a second-level suggester with options (Delete, Archive, Restore, Rename). Use the same flow logic as the script but driven by plugin commands & modals.

6) File operations and atomic writes
- Use `app.vault.read/modify/create/rename/delete`. For atomic replace (for example replacing an existing PDF after merging), write to a temp file in the destination folder (e.g., `<dest>.tmp`) then `app.vault.rename` to move into place. If working with binary data, use the Vault adapter's `app.vault.adapter.writeBinary` and `readBinary`.

7) Templater integration
- Detect Templater plugin by checking `this.app.plugins.plugins['templater-obsidian']` or by scanning `this.app.plugins.plugins` for a plugin whose manifest name contains `templater`.
- Preferred approach: if Templater exposes an `api` object in its instance, call `templaterInstance.api` methods per their documentation.
- Fallback approach: create temporary note, insert templater template text and variables, call `this.app.commands.executeCommandById(<templater-command-id>)` to trigger rendering, then read the file.

8) Logging and error handling
- Use `console.error` for debugging and `new Notice()` to show friendly errors to users. Keep stack traces in console.

Simple API helper examples (TypeScript snippets)

SimpleSuggester (wrap FuzzySuggestModal)
```ts
import { App, FuzzySuggestModal } from 'obsidian';

export class SimpleSuggester<T> extends FuzzySuggestModal<T> {
	private items: T[];
	private getText: (t: T) => string;
	private resolver: (v: T | null) => void;

	constructor(app: App, items: T[], getText: (t: T) => string, placeholder?: string) {
		super(app);
		this.items = items;
		this.getText = getText;
		if (placeholder) this.inputEl.setAttribute('placeholder', placeholder);
	}

	getItems(): T[] { return this.items; }
	getItemText(item: T): string { return this.getText(item); }
	onChooseItem(item: T): void { if (this.resolver) this.resolver(item); this.close(); }
	onClose(): void { super.onClose(); if (this.resolver) { this.resolver(null); this.resolver = () => {}; } }

	openAndChoose(): Promise<T | null> { return new Promise(resolve => { this.resolver = resolve; this.open(); }); }
}
```

PromptModal (single-line input)
```ts
import { App, Modal } from 'obsidian';

export class PromptModal extends Modal {
	private promptText: string;
	private resolve: (s: string | null) => void;
	constructor(app: App, promptText: string, defaultValue = '') { super(app); this.promptText = promptText; }
	onOpen() { /* render input, OK/Cancel, wire events to this.resolve */ }
	onClose() { /* cleanup and ensure resolve(null) if not resolved */ }
	openPrompt(): Promise<string | null> { return new Promise(r => { this.resolve = r; this.open(); }); }
}
```

Migration checklist for each script function
- [ ] Register equivalent plugin commands for each top-level action in `_actions`.
- [ ] Replace `quickAddApi.suggester` with `SimpleSuggester` and `quickAddApi.inputPrompt` with `PromptModal`.
- [ ] Port `loadConfig()` to `ConfigService.readConfig()` using `app.vault`.
- [ ] Implement `CourseService` functions matching the script's logic (create, delete, archive, restore, rename).
- [ ] Implement `deleteFolderRecursively` using `app.vault` APIs (delete files first, then folders deepest-first).
- [ ] Port the interactive `manageCourses` flow into `ManageCoursesCommand` using nested suggesters/modals.

Acceptance criteria (how to verify)
- Commands appear in Obsidian's Command Palette and perform the same workflows as the QuickAdd script.
- Creating a course produces a note at `BaseFolders.University/Courses/<Course>.md` and matching folders under `Attachments`, `Notes`, and `Scans`.
- Deleting/archive/restore/rename produce the same folder layout changes and Notices as the script.
- Config editing reads/writes `95_Scripts/config.json` identically.

Testing & smoke tests
- Manual test plan:
	1. Run `StudyVault: Open Tools` and pick `Add Course` → create sample course `TEST101` → verify files/folders created.
	2. Use `Manage Courses` → pick `TEST101` → choose `Delete` → verify deletion.
	3. Create a course and `Archive` it → check `Archive/<Course>_<timestamp>` exists and contains folders.
	4. Restore archived snapshot via `Manage Courses` → verify folders moved back and archive removed.
	5. Edit config via plugin command and confirm `95_Scripts/config.json` updates.

Acceptance automation ideas
- Write unit tests for `ConfigService` and `CourseService` by mocking `app.vault` (harder inside Obsidian, but possible with a small adapter wrapper).

Final notes
- Start with a small scaffold: implement `SimpleSuggester`, `PromptModal`, `ConfigService`, and one command `Manage Courses`. Once UX and APIs are validated, port `addCourse`, `deleteCourse`, `archiveCourse`, `restoreCourse`, and `renameCourse` one-by-one, testing after each.
- Keep the original QuickAdd script as a reference in `95_Scripts/quickAdd/jinxx-quickadd.js` and consider shipping the plugin's build outputs to `.obsidian/plugins/study-vault/` for instant enable/disable across machines.

