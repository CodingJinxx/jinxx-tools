# Migration Prompt — QuickAdd → Obsidian Plugin (detailed)

Use this prompt to instruct an AI or developer to migrate the QuickAdd user script `jinxx-quickadd.js` into a standalone Obsidian plugin. The migration must reproduce the script's current behavior exactly (UI flows, course management, config editing), replace the JSON config file workflow with a dedicated plugin settings page, and explicitly defer any scanning or PDF merging features to a future phase.

Important: This prompt is intentionally detailed. Follow it exactly unless the user asks otherwise.

---

PROJECT CONTEXT
- Vault root: c:\Dev\Lambda Vault\Lambda Vault
- Reference script to port: `95_Scripts/quickAdd/jinxx-quickadd.js` (copy of original code is available in the vault)
- Existing config file: `95_Scripts/config.json` (currently used by the script)
- The migration should NOT implement any scanning, PDF merging, OCR, or folder-watching. Those are out-of-scope.

TARGET: Obsidian plugin
- Plugin id (recommended): `jinxx-tools` (folder `.obsidian/plugins/jinxx-tools/`) — you may change this only after confirming with the user.
- Plugin display name (manifest.name): `Jinxx Tools` (or another name confirmed by user).
- Language: TypeScript (preferred). Use the official Obsidian sample plugin template as the base.
- Build: use the sample plugin's build pipeline (Vite/rollup provided in the template). The final build artifact must be installable by copying into `<vault>/.obsidian/plugins/<plugin-id>/`.

HIGH-LEVEL OBJECTIVE
- Reproduce the QuickAdd script's functionality exactly, specifically:
  - Add Course (create note + `Attachments`, `Notes`, `Scans` per course and optional lecture subfolders)
  - Edit Config (migrate from editing `95_Scripts/config.json` to a plugin settings page that edits equivalent fields and persists via plugin data)
  - Manage Courses (list courses from `BaseFolders.University/Courses`, allow Delete / Archive / Restore / Rename with the same semantics & confirmations)
  - Delete Course (recursive deletion same as `deleteFolderRecursively` in the script)
  - Archive Course (move to `BaseFolders.University/Archive/<course>_timestamp/...` preserving files)
  - Restore Course (reverse of archive; allow rename-on-restore if destination exists)
  - Rename Course (handle destination exists by offering Archive existing or Rename existing flows)
- Maintain the same UX flows: fuzzy suggester lists, simple text prompts, yes/no confirmations, and Notices.

IMPORTANT CONSTRAINT: Replace JSON config usage with plugin settings
- The plugin must provide a Settings tab (via `addSettingTab`) exposing the same configuration that `95_Scripts/config.json` currently contains, including at minimum:
  - BaseFolders (Home, Garden, University, Work, Books, Templates)
  - LectureSubfolderOptions (retain the same structure and allow editing basic labels / template choices)
  - Templates (allow editing the mapping keys or selected template names)
  - Scans.WatchFolders — keep as a setting but mark it read-only or leave it optional (scanning deferred)
- Persist settings via `this.saveData()` / `this.loadData()` plugin data API, *not* by writing to `95_Scripts/config.json`.
- However, on first install the plugin should attempt to read `95_Scripts/config.json` (if it exists) and migrate values into the plugin settings automatically. Do not delete the JSON file — only read and copy values into plugin settings on first run.

DELIVERABLES (for each run of the AI)
1. A plugin scaffold under `study-vault-plugin/` (or repo name you choose) with:
   - `manifest.json` (id, name, version, minAppVersion)
   - `package.json` and build config (matching Obsidian sample plugin)
   - `src/main.ts` implementing `Plugin` subclass and registering commands
   - `src/ui/SimpleSuggester.ts` (FuzzySuggestModal wrapper) and `src/ui/PromptModal.ts` and `src/ui/YesNoModal.ts`
   - `src/services/ConfigService.ts` and `src/services/CourseService.ts` implementing core behaviour using `this.app.vault`
   - `src/settings/SettingTab.ts` implementing the plugin Settings UI and data migration from `95_Scripts/config.json`
   - README.md with build & install instructions and a note that scanning is deferred
2. Unit-ish smoke tests or manual test script documentation (see Acceptance Criteria below) — at minimum detailed manual verification steps.
3. A commit (or patch) that places a copy of the original QuickAdd files into the plugin repo at `reference/95_Scripts/` so the reference code is available.

STEP-BY-STEP IMPLEMENTATION TASKS (strict order)
0) Repository preparation (precondition for migration)
   - Copy `95_Scripts/` into `reference/95_Scripts/` inside the new plugin project. Preserve file contents exactly.
   - Record the path used for later debugging.

1) Project scaffold
   - Initialize plugin using the Obsidian sample plugin template.
   - Set `manifest.json` id to `jinxx-tools` (or chosen id) and name to `Jinxx Tools`.
   - Add TypeScript files as listed in Deliverables.

2) Implement Settings storage and migration
   - Implement `PluginSettings` interface matching the structure of `95_Scripts/config.json` relevant parts.
   - On plugin `onload`: call `this.loadData()` to get persisted settings. If settings are empty, attempt to read `95_Scripts/config.json` using `this.app.vault.getAbstractFileByPath('95_Scripts/config.json')` and `app.vault.read(file)`; if present, parse and map values to plugin settings, then `this.saveData()`.
   - Implement `SettingTab` UI allowing editing all settings. Use text inputs, drop-downs, and repeaters as needed. When settings change, call `this.saveData()`.

3) Implement UI helpers
   - `SimpleSuggester` as shown in `obsidian_plugin_transition.md` (generic typed wrapper around `FuzzySuggestModal` with a `openAndChoose()` Promise method).
   - `PromptModal` for single-line input with `openPrompt()` returning Promise<string|null>.
   - `YesNoModal` for confirm dialogs with OK/Cancel returning Promise<boolean>.

4) Implement ConfigService
   - Provide read-only accessors to plugin settings and to the vault-based config fallback (for migration only).
   - Provide helper methods for normalizing paths (replace backslashes, ensure trailing slashes not used, build paths like `${BaseFolders.University}/Courses`).

5) Implement CourseService with parity to QuickAdd
   - Methods:
     - listCourses(): read files under `${universityFolder}/Courses` returning names (strip `.md`).
     - createCourse(courseName, lectureSubfolderKey?): create Note at `${universityFolder}/Courses/${courseName}.md` and folders under `${universityFolder}/Attachments/${courseName}`, `${universityFolder}/Notes/${courseName}`, `${universityFolder}/Scans/${courseName}`. If lecture subfolder template selected in settings, create nested folders accordingly. Use `ensureFolder` helper.
     - deleteCourse(courseName): implement robust recursive delete: delete files under the folder first, then delete child folders deepest-first, then delete folder. Return a compact summary object describing changes.
     - archiveCourse(courseName): make a timestamped archive folder under `${universityFolder}/Archive/${courseName}_${timestamp}` and move/rename files/folders into it.
     - restoreCourse(courseName, snapshotName, destName?): move files from snapshot back into University structure. Support renaming if destination exists.
     - renameCourse(oldName, newName): handle collision logic as in script: offer Archive existing or Rename existing.

   - All methods must mirror the same user confirmations and fallbacks as the script (e.g., prompt if destination exists, do not overwrite silently).

6) Implement ManageCourses command and main action suggester
   - Register a command `Jinxx Tools: Open Tools` that opens a `SimpleSuggester` listing actions: Add Course, Edit Settings, Manage Courses, Restore Archive, etc.
   - Recreate the `manageCourses` interactive loop: show list of courses, let user pick one, then present actions (Close, Delete, Archive, Restore, Rename) with icons if desired. Use PromptModal/YesNoModal for confirmations.

7) Implement Edit Settings UI
   - Instead of editing JSON, present a Settings tab with live inputs bound to plugin settings. Provide a Save/Reset to default buttons.
   - Provide a small migration notice if values were imported from `95_Scripts/config.json` on first run.

8) Logging, notices, and error handling
   - Use `new Notice()` for user-visible messages; use console.error for stack traces. Where the script used `quiet` notices, preserve the same messages.

9) Tests & manual verification
   - Perform manual verification steps in Acceptance Criteria. Provide a test report of each step.

ACCEPTANCE CRITERIA (must pass all)
- The plugin exposes a command `Jinxx Tools: Open Tools` showing the action list and each action works.
- Creating a course creates a `.md` note at `${BaseFolders.University}/Courses/<Course>.md` and matching `Attachments`, `Notes`, `Scans` folders under `${BaseFolders.University}`.
- Delete / Archive / Restore / Rename behave identically to the QuickAdd script (no silent overwrites; confirmations shown; archive snapshots created with timestamp; restore moves files back).
- Settings are editable via the plugin Settings tab, saved via `this.saveData()`, and loaded on plugin start via `this.loadData()`.
- On a fresh install where no plugin settings exist, the plugin reads `95_Scripts/config.json` (if present) and migrates values into plugin settings automatically.
- No scanning or PDF merging features are implemented or tested; any mention of them in code or UI is absent or clearly marked as deferred.

DELIVERY FORMAT
- The AI should produce a commit-style patch (or a list of files with contents) for the plugin scaffold and implementation files listed in Deliverables. Each file should be valid TypeScript and build with the sample plugin's build config.
- Provide clear build and deploy instructions (PowerShell examples to copy built plugin into vault `.obsidian/plugins`), and a short manual test script demonstrating acceptance criteria.

FAILURE MODES & HOW TO REPORT THEM
- If any vault API call fails (missing folder, permission error), the plugin should show a Notice describing the failure and log stack trace to console.
- If a migration from `95_Scripts/config.json` fails (malformed JSON), the plugin must ignore it, create default settings, and show a Notice explaining migration failed.

EXTRA NOTES FOR THE AGENT
- Use the original QuickAdd script at `reference/95_Scripts/quickAdd/jinxx-quickadd.js` as the single source-of-truth for behavior. Port logical flow line-by-line where possible.
- Prefer using Obsidian's `Vault` APIs and modal UI primitives — do not attempt to import or execute QuickAdd-specific helper functions directly.
- Keep changes minimal and conservative: the goal is parity with existing script behaviour, not refactoring or improvement (except replacing JSON settings with a proper plugin Settings tab as required).

---

If the AI completes the tasks above, produce a short checklist of the files created and a log of where the original QuickAdd functions were mapped to plugin functions.
