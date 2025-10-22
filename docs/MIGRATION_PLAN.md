# Migration plan: jinxx-quickadd.js → Obsidian plugin

This document captures the step-by-step plan to port the `jinxx-quickadd.js` QuickAdd script into a standalone Obsidian plugin. It mirrors the notes in `reference/95_Scripts/docs/obsidian_plugin_transition.md` and provides a concrete roadmap and priorities.

Goals
- Preserve behaviour for course creation, management (archive/delete/rename/restore), and config-driven folder locations.
- Replace QuickAdd UI helpers with Obsidian UI primitives (SuggestModal, Modal, Notice).
- Keep scanning/PDF features deferred to a later phase.

High-level steps
1. Add UI primitives: `SimpleSuggester`, `PromptModal`, `YesNoModal` (done).
2. Implement `ConfigService` (`readConfig`, `writeConfig`) (done).
3. Implement low-level file helpers: `ensureFolder`, `deleteFolderRecursively`, `buildCompactSummary`.
4. Implement `CourseService` core operations: list, create, delete, archive, rename, restore.
5. Implement Manage Courses UI command and actions.
6. Implement Edit Config interactive UI (navigable JSON editor via suggesters and prompts).
7. Implement Templater integration (best-effort, optional fallback).
8. Tests, smoke checks, documentation and packaging.

Priorities for first iteration
- Provide command palette commands: `Study: Open Tools`, `Study: Add Course`, `Study: Manage Courses`, `Study: Edit Config`.
- Implement `readConfig`/`writeConfig` and ensure `95_Scripts/config.json` is created and editable.
- Implement `listCourses()` and a Manage UI that lists courses and shows operations (without destructive operations enabled yet).

Acceptance criteria
- Commands appear in Command Palette and run without uncaught exceptions.
- Creating a course produces expected folders and note structure (manual test required).
- Editing config updates `95_Scripts/config.json` in the vault.

Notes
- Keep the original QuickAdd script under `reference/95_Scripts` as a behaviour reference.
- Defer scanning/OCR and any file-watcher features until core flows are stable.
