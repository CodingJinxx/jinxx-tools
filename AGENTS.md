# Jinxx Tools - Obsidian Plugin Development Guide

## Project Overview

**Jinxx Tools** is a course management and PDF scanning plugin for Obsidian.

- **Type**: Obsidian Community Plugin (TypeScript → bundled JavaScript)
- **Target**: Desktop-only (uses Node.js `fs` module for scanning)
- **Entry point**: `main.ts` compiled to `main.js` and loaded by Obsidian
- **Required artifacts**: `main.js`, `manifest.json`, and `styles.css`
- **Core features**:
  - Course lifecycle management (create, delete, archive, restore, rename)
  - PDF scanning with live monitoring and merge capabilities
  - Template system with Templater integration
  - Customizable folder structures for notes organization

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on npm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- To use eslint install eslint from terminal: `npm install -g eslint`
- To use eslint to analyze this project use this command: `eslint main.ts`
- eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder: `eslint ./src/`

## File & Folder Conventions

**This Project's Structure**:
```
jinxx-tools/
├── main.ts                     # Plugin entry (lifecycle, command registration ONLY)
├── src/
│   ├── services/               # Business logic (NO UI interaction)
│   │   ├── ConfigService.ts    # Settings I/O
│   │   ├── CourseService.ts    # Course CRUD operations
│   │   └── ScanService.ts      # PDF scanning & merging
│   ├── settings/
│   │   └── SettingTab.ts       # Settings UI + data model
│   ├── ui/                     # Modal-based UI components
│   │   ├── SimpleSuggester.ts  # Fuzzy picker wrapper
│   │   ├── PromptModal.ts      # Text input
│   │   ├── YesNoModal.ts       # Confirmation
│   │   └── LiveScanMonitorModal.ts  # Scan session UI
│   ├── commands/               # Advanced commands (rarely used)
│   │   └── editConfig.ts
│   └── utils/
│       └── file.ts             # File operations (ensureFolder, delete, etc.)
├── docs/                       # Documentation
└── publish/                    # Release artifacts
```

**Key Principles**:
- **`main.ts` is minimal**: Only lifecycle, command registration, and high-level coordination
- **Services are stateless**: No UI imports, pure business logic
- **UI components are modals**: All user interaction via Modal subclasses
- **Settings in SettingTab**: One source of truth for data model + UI
- **Utils are pure functions**: No app/plugin dependencies

**Do Not**:
- Put business logic in `main.ts` (delegate to services)
- Import UI components in services (pass data, not modals)
- Commit build artifacts (`main.js`, `node_modules/`)
- Create large files (split at ~300 lines)

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):  
  - `id` (plugin ID; for local dev it should match the folder name)  
  - `name`  
  - `version` (Semantic Versioning `x.y.z`)  
  - `minAppVersion`  
  - `description`  
  - `isDesktopOnly` (boolean)  
  - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Project-Specific Context

### This Plugin's Domain
- **Course management** for academic note-taking (university students)
- **Desktop-only**: Uses Node.js `fs` module for PDF scanning
- **Settings storage**: Plugin data (`.obsidian/plugins/jinxx-tools/data.json`), not external JSON
- **UI pattern**: Heavy use of modal-based interactions (no sidebars or custom views)
- **Dependencies**: `pdf-lib` for PDF manipulation (no external services)

### Code Organization Rules

**Services** (`src/services/`):
- Stateless business logic
- NO UI imports (no `Modal`, `Notice`, etc.)
- Return result objects: `{ ok: boolean; reason?: string; ...data }`
- Example: `CourseService`, `ScanService`, `ConfigService`

**UI Components** (`src/ui/`):
- Modals and interactive elements
- Can call services but contain minimal logic
- Always return `Promise<T | null>` (null = cancelled)
- Example: `SimpleSuggester`, `PromptModal`, `YesNoModal`

**Commands** (registered in `main.ts`):
- Minimal implementation in command callback
- Delegate to services immediately
- Handle result object and show notices
- Example: `handleAddCourse()` → `CourseService.createCourse()`

**Settings** (`src/settings/SettingTab.ts`):
- Data model (`JinxxToolsSettings` interface)
- UI for all settings (no manual JSON editing)
- Save immediately on change (no "Apply" button)

### What NOT to Change

**Breaking Changes for Users**:
- Plugin ID: `jinxx-tools` (stable forever)
- Command IDs: `jinxx-*` (never rename after release)
- Settings structure: Adding fields OK, removing/renaming breaks users
- Folder naming: `University`, `Courses`, `Notes`, `Attachments`, `Scans` (user expectations)

**Architecture Patterns**:
- Keep `main.ts` minimal (lifecycle + commands only)
- Services never import UI
- Modals return promises with null for cancellation
- File operations use atomic writes (write to `.tmp`, then rename)

### Testing Checklist for This Plugin

When making changes, manually test:

**Course Operations**:
- [ ] Create course with/without template
- [ ] Create with notes subfolder layout
- [ ] Delete course (verify all folders removed)
- [ ] Archive course (verify timestamped snapshot)
- [ ] Restore course (verify conflict resolution)
- [ ] Rename course (verify all folders renamed)

**Scanning Workflow**:
- [ ] Start scan session → scan documents → end session
- [ ] Live monitoring modal shows detected files
- [ ] Reorder files → verify page order in output
- [ ] Merge to new PDF → verify output
- [ ] Append to existing PDF → verify appended
- [ ] Archive originals (if enabled) → verify moved

**Settings**:
- [ ] Edit base folders → reload → verify persisted
- [ ] Add/remove notes subfolder options
- [ ] Add/remove course templates
- [ ] Add/remove watch folders

**Interactive Flows**:
- [ ] Manage Courses loop (list → select → action → return)
- [ ] Template selection with preview
- [ ] Collision handling (archive/rename existing)

### Key Dependencies

**Runtime**:
- `pdf-lib@^1.17.1`: PDF merging and manipulation (bundled)
- Node.js `fs`: File system operations for scanning (desktop-only)
- Obsidian Vault API: All vault file operations

**Optional Integration**:
- Templater plugin: Auto-render template variables (best-effort, no error if missing)

### Common Pitfalls

1. **Don't show "Cancelled" errors**: Users expect no notice when they cancel
   ```ts
   if (res.reason !== 'cancelled') {
     new Notice(`Failed: ${res.reason}`);
   }
   ```

2. **Always use atomic writes for files**:
   ```ts
   await writeFile(`${path}.tmp`, data);
   await rename(`${path}.tmp`, path);
   ```

3. **Delete folders deepest-first**: Use `deleteFolderRecursively` helper

4. **Check for null before using vault objects**:
   ```ts
   const folder = this.app.vault.getAbstractFileByPath(path) as TFolder | null;
   if (!folder) return { ok: false, reason: 'folder-not-found' };
   ```

5. **Command IDs are permanent**: Never rename after release

## Agent Do/Don't

**Do**:
- Add commands with stable IDs (prefix: `jinxx-`, kebab-case)
- Delegate business logic to services immediately
- Return result objects from services: `{ ok, reason?, ...data }`
- Show notices only for non-cancelled errors
- Use helpers: `SimpleSuggester`, `PromptModal`, `YesNoModal`, `ensureFolder`
- Write atomic (write `.tmp` → rename)
- Test manually with the checklist above

**Don't**:
- Put business logic in `main.ts` (only coordination)
- Import UI components in services
- Show notices for cancelled operations
- Rename command IDs after release
- Change plugin ID or settings structure (breaking change)
- Commit `main.js` or `node_modules/` to git
- Create files >300 lines (split into smaller modules)

## Common Patterns in This Project

### Using SimpleSuggester (Fuzzy Picker)
```ts
import { SimpleSuggester } from './src/ui/SimpleSuggester';

const courses = ['Calculus', 'Physics', 'Chemistry'];
const suggester = new SimpleSuggester(
  this.app,
  courses,
  (c: string) => c,  // Display function
  'Select a course'   // Placeholder
);

const chosen = await suggester.openAndChoose();
if (chosen) {
  // User selected a course
}
```

### Using PromptModal (Text Input)
```ts
import { PromptModal } from './src/ui/PromptModal';

const modal = new PromptModal(this.app, 'Enter course name');
const courseName = await modal.openPrompt();
if (courseName) {
  // User entered a name
}
```

### Using YesNoModal (Confirmation)
```ts
import { YesNoModal } from './src/ui/YesNoModal';

const modal = new YesNoModal(this.app, 'Are you sure you want to delete this course?');
const confirmed = await modal.openPrompt();
if (confirmed) {
  // User confirmed
}
```

### File Operations
```ts
import { ensureFolder, deleteFolderRecursively, buildCompactSummary } from './src/utils/file';

// Ensure folder exists (creates parents recursively)
await ensureFolder(this.app, 'University/Courses');

// Delete folder recursively (files first, then folders deepest-first)
const summary = { deletedFiles: [], deletedFolders: [], failed: [] };
await deleteFolderRecursively(this.app, folder, summary);

// Build human-readable summary
const compact = buildCompactSummary(summary);
new Notice(`Deleted — ${compact}`);
```

### Service Result Pattern
```ts
// Services return result objects
async createCourse(): Promise<{ ok: boolean; reason?: string }> {
  try {
    // ... operation logic
    return { ok: true };
  } catch (e) {
    console.error('createCourse failed', e);
    return { ok: false, reason: String(e.message || e) };
  }
}

// UI handles results
const res = await courseService.createCourse();
if (res.ok) {
  new Notice('Course created successfully');
} else if (res.reason !== 'cancelled') {
  // Don't show error for user cancellations
  new Notice(`Failed: ${res.reason}`);
}
```

### Adding a Command
```ts
// In main.ts onload()
this.addCommand({
  id: 'jinxx-your-command',      // NEVER change after release
  name: 'Your Command',
  callback: async () => {
    await this.handleYourCommand();
  }
});

// Handler method (delegate to service)
async handleYourCommand() {
  const service = new CourseService(this);
  const res = await service.yourOperation();
  if (res.ok) {
    new Notice('Success');
  } else if (res.reason !== 'cancelled') {
    new Notice(`Failed: ${res.reason}`);
  }
}
```

### Settings Pattern
```ts
// In SettingTab.display()
new Setting(containerEl)
  .setName('Your Setting')
  .setDesc('Description of what this does')
  .addText((text) =>
    text
      .setValue(this.plugin.settings.yourSetting)
      .onChange(async (value) => {
        this.plugin.settings.yourSetting = value;
        await this.plugin.saveSettings();
      })
  );

// Access in services
const config = await this.cfg.readConfig();
const value = config.yourSetting;
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
