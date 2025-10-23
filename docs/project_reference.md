# Jinxx Tools — Technical Reference

**Version**: 1.0.0  
**Last Updated**: October 23, 2025  
**Target Obsidian API**: 0.15.0+

This document serves as the authoritative technical reference for developers working on the Jinxx Tools plugin. It covers architecture, implementation patterns, data models, and extension guidelines.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Core Systems](#core-systems)
5. [Data Models](#data-models)
6. [Key Abstractions & Patterns](#key-abstractions--patterns)
7. [Extension Guide](#extension-guide)
8. [Build & Deployment](#build--deployment)
9. [Testing](#testing)
10. [Migration History](#migration-history)

---

## Project Overview

**Jinxx Tools** is a course management and PDF scanning plugin for Obsidian. It provides:

- **Course lifecycle management**: Create, delete, archive, restore, rename courses
- **Automated folder structure**: Courses, Notes, Attachments, Scans folders per course
- **Template system**: Apply templates to course notes with Templater integration
- **PDF scanning**: Live monitoring, merge/append PDFs, stability checks
- **Flexible settings**: Notes subfolder layouts, course templates, scanner configurations

**Platform**: Desktop-only (uses Node.js `fs` module for scanning)  
**Dependencies**: `pdf-lib` for PDF manipulation (bundled)

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         main.ts                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Plugin Entry Point                                     │ │
│  │  - onload() / onunload()                                │ │
│  │  - Command registration                                 │ │
│  │  - Settings tab initialization                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Services    │ │   UI Layer    │ │   Settings    │
    └───────────────┘ └───────────────┘ └───────────────┘
            │               │               │
    ┌───────┼───────┐       │       ┌───────┴───────┐
    ▼       ▼       ▼       ▼       ▼               ▼
 Config  Course   Scan   Modals   SettingTab   Utils
Service Service Service         (Suggester,
                                 Prompt, etc.)
```

### Component Responsibilities

#### **main.ts** (Plugin Entry Point)
- Plugin lifecycle management (`onload`, `onunload`)
- Command registration (8 commands total)
- Coordination between services and UI
- High-level workflow orchestration (e.g., `handleManageCourses`)

#### **Services Layer** (`src/services/`)
Stateless business logic with no direct UI interaction:

- **ConfigService**: Read/write plugin settings via `plugin.loadData()` / `plugin.saveData()`
- **CourseService**: Course CRUD operations (create, delete, archive, restore, rename)
- **ScanService**: PDF scanning session management, file detection, merging

#### **UI Layer** (`src/ui/`)
Modal-based interactions with users:

- **SimpleSuggester**: Fuzzy search picker (wraps `FuzzySuggestModal`)
- **PromptModal**: Text input with OK/Cancel
- **YesNoModal**: Confirmation dialog
- **LiveScanMonitorModal**: Real-time PDF detection and merge UI
- **LectureOptionEditorModal**: Edit notes subfolder layouts
- **CourseTemplateEditorModal**: Edit course templates
- **FolderStructureModal**: Visual folder tree editor
- **PreviewModal**: Display template previews

#### **Settings** (`src/settings/`)
- **SettingTab**: Plugin settings UI with add/remove/edit controls

#### **Utils** (`src/utils/`)
- **file.ts**: File operations (`ensureFolder`, `deleteFolderRecursively`, `buildCompactSummary`)

---

## File Structure

```
jinxx-tools/
├── main.ts                             # Plugin entry point
├── manifest.json                       # Plugin metadata (id, version, etc.)
├── package.json                        # npm dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── esbuild.config.mjs                  # Build configuration
├── deploy.mjs                          # Deployment script
├── styles.css                          # Plugin styles
├── src/
│   ├── commands/
│   │   └── editConfig.ts               # JSON config editor (not exposed)
│   ├── services/
│   │   ├── ConfigService.ts            # Settings I/O
│   │   ├── CourseService.ts            # Course operations
│   │   └── ScanService.ts              # PDF scanning
│   ├── settings/
│   │   └── SettingTab.ts               # Settings UI + data model
│   ├── ui/
│   │   ├── SimpleSuggester.ts          # Fuzzy picker wrapper
│   │   ├── PromptModal.ts              # Text input modal
│   │   ├── YesNoModal.ts               # Confirmation modal
│   │   ├── LiveScanMonitorModal.ts     # Scan session UI
│   │   ├── LectureOptionEditorModal.ts # Edit notes layouts
│   │   ├── CourseTemplateEditorModal.ts# Edit course templates
│   │   ├── FolderStructureModal.ts     # Folder tree editor
│   │   └── PreviewModal.ts             # Template preview
│   └── utils/
│       └── file.ts                     # File system helpers
├── docs/
│   ├── project_reference.md            # This file
│   ├── changelog.md                    # Change history
│   ├── migration_complete.md           # Migration notes
│   ├── update_summary.md               # Recent updates
│   └── scan_feature.md                 # Scan feature docs
└── publish/                            # Release artifacts
    └── jinxx-tools/
        ├── main.js
        ├── manifest.json
        └── styles.css
```

### Module Dependencies

```
main.ts
  → CourseService → ConfigService, file utils, UI modals
  → ScanService → ConfigService, pdf-lib
  → SettingTab → UI modals (editors)
  → UI modals (SimpleSuggester, PromptModal, YesNoModal)
```

**Key Principles**:
- Services never import UI components (no `Modal` in services)
- UI components may call services but don't contain business logic
- `main.ts` coordinates high-level flows but delegates implementation

---

## Core Systems

### 1. Settings System

**Location**: [`src/settings/SettingTab.ts`](../src/settings/SettingTab.ts)

**Data Model**: `JinxxToolsSettings` interface

```typescript
interface JinxxToolsSettings {
  BaseFolders: {
    Home: string;
    Garden: string;
    University: string;
    Work: string;
    Books: string;
    Templates: string;
  };
  NotesSubfolderOptions: Record<string, LectureSubfolderOption>;
  Templates: {
    Course: Record<string, CourseTemplate>;
  };
  Scans: {
    WatchFolders: string[];
    stabilityDelayMs: number;
    stabilityRetries: number;
    keepOriginals: boolean;
    archiveAfterMerge: boolean;
    archiveFolderPath: string;
    mergeLibrary: 'pdf-lib' | 'ghostscript';
    makeBackupBeforeAppend: boolean;
  };
}
```

**Storage**: `.obsidian/plugins/jinxx-tools/data.json` (via `plugin.loadData()` / `plugin.saveData()`)

**Defaults**: `DEFAULT_SETTINGS` constant in `SettingTab.ts`

**Lifecycle**:
1. `onload()`: Load settings from disk, merge with defaults
2. Settings tab: User modifies settings via UI
3. `onChange` handlers: Save immediately on each change (debounced where appropriate)
4. Services: Read settings via `ConfigService.readConfig()`

**Key Patterns**:
- Settings are **deeply merged** with defaults to handle new fields
- Settings tab uses **live editing**: changes save immediately, no "Apply" button
- Add/Remove buttons for dynamic lists (Notes options, Templates, Watch folders)

---

### 2. Course Management System

**Location**: [`src/services/CourseService.ts`](../src/services/CourseService.ts)

**Operations**:

#### Create Course
```typescript
async createCourse(): Promise<{ ok: boolean; reason?: string }>
```
1. Prompt for course name
2. Check if course already exists (any of: note, folders)
3. Prompt for template selection (optional)
4. Prompt for notes subfolder layout (optional, or auto-select from template)
5. Create course note with template content
6. Invoke Templater API if available (best-effort)
7. Create folder structure:
   - `University/Courses/<CourseName>.md`
   - `University/Attachments/<CourseName>/`
   - `University/Notes/<CourseName>/` (+ subfolders if selected)
   - `University/Scans/<CourseName>/`

**Edge Cases**:
- Existing course: Return `already-exists` error
- Template file not found: Use default note content, show notice
- Templater not installed: Skip rendering (no error)

#### Delete Course
```typescript
async deleteCourse(params?: { courseName?: string }): Promise<{ ok: boolean; reason?: string; compact?: string }>
```
1. Prompt for course name (if not provided)
2. Confirm deletion via `YesNoModal`
3. Delete course note (if exists)
4. Delete folders recursively: Attachments, Notes, Scans
5. Return summary of deleted files/folders

**Recursion**: `deleteFolderRecursively` deletes files first, then subfolders deepest-first

#### Archive Course
```typescript
async archiveCourse(params?: { courseName?: string }): Promise<{ ok: boolean; reason?: string; path?: string }>
```
1. Prompt for course name (if not provided)
2. Confirm archival via `YesNoModal`
3. Generate timestamped folder: `Archive/<CourseName>_YYYY-MM-DD_HH-MM-SS`
4. Create archive structure: `Archive/<snapshot>/Courses|Notes|Attachments|Scans/`
5. Move course note and folders into archive snapshot

**Timestamp Format**: `YYYY-MM-DD_HH-MM-SS` (filesystem-safe)

#### Restore Course
```typescript
async restoreCourse(params?: { courseName?: string }): Promise<{ ok: boolean; reason?: string; snapshot?: string }>
```
1. List all archive snapshots for course (matches `<CourseName>_*` folders)
2. Prompt user to select snapshot
3. Check if destination exists (course with same name)
4. If exists, offer: **Abort** or **Rename restore**
5. Recreate folder structure in `University/`
6. Move files from archive back to `University/`
7. Delete archive snapshot after successful restore

**Conflict Resolution**:
- **Rename restore**: Prompt for new name, restore under new name
- **Abort**: Cancel operation

#### Rename Course
```typescript
async renameCourse(params?: { oldName?: string; newName?: string }): Promise<{ ok: boolean; reason?: string; compact?: string }>
```
1. Prompt for old name and new name
2. Check if destination exists
3. If destination exists, offer:
   - **Abort rename**
   - **Archive existing**: Archive destination course first
   - **Rename existing**: Prompt for alternate name for destination
4. Rename course note and all folders
5. Return summary of moves

**Collision Handling**: Recursive (can rename existing → archive → rename again)

---

### 3. Scan System

**Location**: [`src/services/ScanService.ts`](../src/services/ScanService.ts)

**Session Lifecycle**:

```
Start Session
  → Take snapshot (before)
  → User scans documents
  → End session (take snapshot after)
  → Detect new files (compare snapshots)
  → Wait for stability (file size unchanged)
  → User reviews in LiveScanMonitorModal
  → Merge or append PDFs
  → Archive originals (optional)
```

#### Session Data
```typescript
interface ScanSession {
  sessionId: string;
  startedAt: string;
  scanRoot: string;         // Watch folder (e.g., C:\Scans\Canon)
  dayFolder: string;        // Day subfolder (e.g., 2025_10_23)
  snapshotBefore: FileSnapshot;
  snapshotAfter?: FileSnapshot;
  newFiles?: ScanFile[];
}
```

#### Key Methods

**`startSession()`**:
- Find first accessible watch folder
- Get or create day folder (`YYYY_MM_DD`)
- Take snapshot of all PDFs in day folder (recursive)
- Store session in `currentSession`

**`endSession()`**:
- Take snapshot after
- Detect new files (present in after but not before)
- Run stability checks on each new file
- Return list of `ScanFile` objects

**`waitForStability(file)`**:
- Check file size, wait `stabilityDelayMs`, check again
- If size unchanged: Mark as stable
- If size changed or locked: Retry up to `stabilityRetries` times
- If max retries exceeded: Mark as unstable, set error

**`mergeFiles(inputFiles, outputPath)`**:
- Load each PDF with `pdf-lib`
- Copy all pages into new `PDFDocument`
- Atomic write: Save to `.tmp`, then rename

**`appendToFile(inputFiles, targetPath)`**:
- Load existing PDF
- Create backup if `makeBackupBeforeAppend` is true
- Append pages from input files
- Atomic write

**`archiveFiles(files)`**:
- Create archive folder (default: `{scanRoot}/archive`)
- Move files to archive folder

#### Ordering Logic
Files are ordered by:
1. **Numeric sequence** in filename (e.g., `IMG_0001`, `IMG_0002`)
2. **Modification time** (fallback)

User can manually reorder in the UI.

#### UI Integration
`LiveScanMonitorModal` provides:
- Real-time status ("Waiting for PDFs...")
- File list with checkboxes (include/exclude)
- ↑↓ buttons to reorder
- "Merge PDFs" button
- Progress indicators during merge

---

### 4. Template System

**Configuration**: `JinxxToolsSettings.Templates.Course`

**Template Definition**:
```typescript
interface CourseTemplate {
  Label: string;                    // Display name
  TemplateFile: string;             // Path relative to Templates folder
  NotesSubfolderOption?: string;    // Auto-apply notes layout (optional)
}
```

**Workflow**:
1. User creates course
2. Plugin prompts for template (or "(None)")
3. If template selected:
   - Read template file from `Templates/<TemplateFile>`
   - Use content as note content
   - If `NotesSubfolderOption` set: Auto-select that layout (skip prompt)
4. If Templater installed:
   - Invoke Templater API to render template variables
   - Best-effort (no error if Templater not available)

**Templater Integration** (Best-Effort):
```typescript
// Detect Templater plugin
const pluginRegistry = app.plugins.plugins;
const templaterInstance = pluginRegistry['templater-obsidian'];

// Invoke rendering API
if (templaterInstance?.api?.overwrite_file_commands) {
  await templaterInstance.api.overwrite_file_commands(createdFile);
}
```

**Fallback**: If Templater not found or rendering fails, course is created with raw template content (user can manually trigger Templater later).

---

## Data Models

### Settings (`JinxxToolsSettings`)
See [Core Systems → Settings System](#1-settings-system)

### Course Entry
```typescript
interface CourseEntry {
  name: string;       // Course name (basename of .md file)
  path: string;       // Full path to .md file
  file: TFile;        // Obsidian file object
}
```

### Summary Object
Used for operation results (delete, rename):
```typescript
interface Summary {
  createdFolders?: string[];
  deletedFiles?: string[];
  deletedFolders?: string[];
  moved?: Array<{ from: string; to: string }>;
  failed?: Array<{ path: string; error: string; attemptedDest?: string }>;
}
```

**Helper**: `buildCompactSummary(summary)` → Human-readable string (e.g., "3 files deleted, 2 folders moved")

### Scan Session
```typescript
interface ScanSession {
  sessionId: string;
  startedAt: string;
  scanRoot: string;
  dayFolder: string;
  snapshotBefore: FileSnapshot;
  snapshotAfter?: FileSnapshot;
  newFiles?: ScanFile[];
}

interface FileSnapshot {
  [absolutePath: string]: {
    size: number;
    mtime: number;
  };
}

interface ScanFile {
  path: string;
  name: string;
  size: number;
  mtime: number;
  stable: boolean;
  error?: string;
}
```

---

## Key Abstractions & Patterns

### SimpleSuggester (Fuzzy Picker)
**Location**: [`src/ui/SimpleSuggester.ts`](../src/ui/SimpleSuggester.ts)

**Usage**:
```typescript
const suggester = new SimpleSuggester(
  app,
  items,                      // Array of any type
  (item) => item.toString(),  // Display function
  'Placeholder text'          // Optional
);

const chosen = await suggester.openAndChoose();
if (chosen) {
  // User selected an item
} else {
  // User cancelled
}
```

**Implementation**:
- Extends `FuzzySuggestModal<T>`
- Returns `Promise<T | null>` (null if cancelled)
- Prevents duplicate resolution (resolved flag)

**Pattern**: Use for any list selection (courses, templates, options)

---

### PromptModal (Text Input)
**Location**: [`src/ui/PromptModal.ts`](../src/ui/PromptModal.ts)

**Usage**:
```typescript
const modal = new PromptModal(app, 'Enter course name', 'Default Value');
const result = await modal.openPrompt();
if (result) {
  // User entered text
} else {
  // User cancelled
}
```

**Features**:
- Enter key submits
- Escape key cancels
- Auto-focus and select text
- Returns `Promise<string | null>`

---

### YesNoModal (Confirmation)
**Location**: [`src/ui/YesNoModal.ts`](../src/ui/YesNoModal.ts)

**Usage**:
```typescript
const modal = new YesNoModal(app, 'Are you sure?');
const confirmed = await modal.openPrompt();
if (confirmed) {
  // User clicked Yes
} else {
  // User clicked No or closed
}
```

**Returns**: `Promise<boolean>` (true = Yes, false = No/Cancel)

---

### File Operation Patterns

#### Atomic Writes
Always write to `.tmp` file, then rename:
```typescript
const tempPath = `${outputPath}.tmp`;
await writeFile(tempPath, data);
await rename(tempPath, outputPath);
```

#### Recursive Folder Deletion
**Pattern**: Delete files first, then folders deepest-first
```typescript
await deleteFolderRecursively(app, folder, summary);
```

#### Ensuring Folders Exist
```typescript
await ensureFolder(app, folderPath, summary);
```
Creates parent folders recursively if needed.

---

### Error Handling Conventions

**Services return result objects**:
```typescript
{ ok: boolean; reason?: string; ...otherData }
```

**UI handles errors**:
```typescript
const res = await service.doOperation();
if (res.ok) {
  new Notice('Success');
} else if (res.reason !== 'cancelled') {
  new Notice(`Failed: ${res.reason}`);
}
```

**Principle**: Don't show "Cancelled" errors (user initiated cancellation)

---

### Notice Patterns

**Success**:
```typescript
new Notice('Course created successfully');
```

**Failure** (only if not user-cancelled):
```typescript
if (res.reason !== 'cancelled') {
  new Notice(`Failed: ${res.reason}`);
}
```

**Detailed summaries**:
```typescript
new Notice(`Deleted course — ${res.compact}`);
// Example: "3 files deleted, 2 folders moved"
```

---

## Extension Guide

### Adding a New Command

1. **Register command in `main.ts`**:
```typescript
this.addCommand({
  id: 'jinxx-your-command',
  name: 'Your Command',
  callback: async () => {
    await this.handleYourCommand();
  }
});
```

2. **Implement handler** (delegate to service):
```typescript
async handleYourCommand() {
  const cs = new CourseService(this);
  const res = await cs.yourOperation();
  if (res.ok) {
    new Notice('Success');
  } else if (res.reason !== 'cancelled') {
    new Notice(`Failed: ${res.reason}`);
  }
}
```

3. **Command ID conventions**:
- Prefix: `jinxx-`
- Kebab-case: `jinxx-add-course`, `jinxx-delete-course`
- **Never change IDs** after release (breaking change for users)

---

### Adding a New Setting

1. **Update `JinxxToolsSettings` interface** in [`src/settings/SettingTab.ts`](../src/settings/SettingTab.ts):
```typescript
export interface JinxxToolsSettings {
  // ... existing fields
  yourNewSetting: string;
}
```

2. **Update `DEFAULT_SETTINGS`**:
```typescript
export const DEFAULT_SETTINGS: JinxxToolsSettings = {
  // ... existing fields
  yourNewSetting: 'default value',
};
```

3. **Add UI in `SettingTab.display()`**:
```typescript
new Setting(containerEl)
  .setName('Your New Setting')
  .setDesc('Description of what this setting does')
  .addText((text) =>
    text
      .setPlaceholder('placeholder')
      .setValue(this.plugin.settings.yourNewSetting)
      .onChange(async (value) => {
        this.plugin.settings.yourNewSetting = value;
        await this.plugin.saveSettings();
      })
  );
```

4. **Access in services**:
```typescript
const config = await this.cfg.readConfig();
const yourSetting = config.yourNewSetting;
```

---

### Adding a New UI Component

1. **Create modal file** in `src/ui/`:
```typescript
// src/ui/YourModal.ts
import { App, Modal } from 'obsidian';

export class YourModal extends Modal {
  private resolver: ((v: YourType | null) => void) | null = null;
  private resolved = false;

  constructor(app: App, /* params */) {
    super(app);
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    // Build UI
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
    if (!this.resolved && this.resolver) {
      this.resolved = true;
      this.resolver(null);
    }
    this.resolver = null;
  }

  openAndGetResult(): Promise<YourType | null> {
    return new Promise(resolve => {
      this.resolved = false;
      this.resolver = resolve;
      this.open();
    });
  }
}
```

2. **Use in command handlers**:
```typescript
const modal = new YourModal(this.app, params);
const result = await modal.openAndGetResult();
if (result) {
  // Process result
}
```

---

### Adding a New Course Operation

1. **Implement in `CourseService`**:
```typescript
async yourOperation(params?: { ... }): Promise<{ ok: boolean; reason?: string; ... }> {
  try {
    // Your logic here
    return { ok: true };
  } catch (e) {
    console.error('yourOperation failed', e);
    return { ok: false, reason: String(e.message || e) };
  }
}
```

2. **Add command** (see [Adding a New Command](#adding-a-new-command))

3. **Add to Manage Courses menu** (optional):
```typescript
// In handleManageCourses loop
const opts = ['✖️ Close', '📄 Scan', '🗑️ Delete', '📦 Archive', '🆕 Your Operation'];
const action = await actionSugg.openAndChoose();
if (action === '🆕 Your Operation') {
  const res = await cs.yourOperation({ courseName });
  if (res.ok) new Notice('Success');
  continue;
}
```

---

### Testing Practices

**Manual Testing** (no automated tests currently):

1. **Unit-level**: Test individual operations
   - Create course → verify folders
   - Delete course → verify deletion
   - Archive → verify snapshot
   - Restore → verify restoration

2. **Integration**: Test workflows
   - Create → Archive → Restore → Delete
   - Create with template → verify Templater rendering
   - Scan session → merge PDFs → verify output

3. **Edge Cases**:
   - Existing course (collision handling)
   - Missing template file
   - Locked files during scan
   - Cancelled operations (no error notices)

4. **Settings Persistence**:
   - Change setting → reload Obsidian → verify persisted
   - Add/remove dynamic items (templates, watch folders)

**See**: [Testing Checklist](#testing-checklist) below

---

## Build & Deployment

### Build Process

**Tool**: esbuild (configured in [`esbuild.config.mjs`](../esbuild.config.mjs))

**Commands**:
```bash
# Development (watch mode)
npm run dev

# Production build
npm run build

# Deploy to vault (see deploy.mjs)
npm run deploy
```

**Build Steps**:
1. TypeScript → JavaScript (via esbuild, no `tsc` emit)
2. Bundle all modules into `main.js`
3. Include external dependency (`pdf-lib`)
4. Copy `manifest.json` and `styles.css` to output

**Output**: `main.js`, `manifest.json`, `styles.css` at project root

---

### Development Workflow

1. **Edit source files** in `src/`
2. **Run `npm run dev`** (watch mode)
3. **Reload Obsidian** (Ctrl+R or disable/enable plugin)
4. **Test changes** in vault
5. **Check console** (Ctrl+Shift+I) for errors

**Hot Reload**: esbuild rebuilds automatically on file changes

---

### Deployment to Vault

**Manual**:
```bash
# Build
npm run build

# Copy to vault
cp main.js manifest.json styles.css "<Vault>/.obsidian/plugins/jinxx-tools/"
```

**Automated** (via `deploy.mjs`):
```bash
npm run deploy
```

Edit [`deploy.mjs`](../deploy.mjs) to set vault path:
```javascript
const VAULT_PATH = 'C:\\Dev\\Lambda Vault\\Lambda Vault\\.obsidian\\plugins\\jinxx-tools';
```

---

### Release Preparation

1. **Bump version** in [`manifest.json`](../manifest.json):
```json
{
  "version": "1.1.0"
}
```

2. **Update [`versions.json`](../versions.json)**:
```json
{
  "1.1.0": "0.15.0"
}
```

3. **Build production**:
```bash
npm run build
```

4. **Create GitHub release**:
   - Tag: `1.1.0` (no leading `v`)
   - Attach: `main.js`, `manifest.json`, `styles.css`

5. **Update changelog**: [`docs/changelog.md`](changelog.md)

---

## Testing

### Testing Checklist

#### Course Management

**Create Course**:
- [ ] Create course without template → Verify folders
- [ ] Create course with template → Verify content
- [ ] Create course with notes layout → Verify subfolders
- [ ] Create course with Templater → Verify rendering
- [ ] Create existing course → Verify "already exists" error

**Delete Course**:
- [ ] Delete course → Verify all files/folders removed
- [ ] Delete non-existent course → Verify error
- [ ] Cancel deletion → Verify no changes

**Archive Course**:
- [ ] Archive course → Verify timestamped snapshot
- [ ] Archive multiple times → Verify multiple snapshots
- [ ] Cancel archive → Verify no changes

**Restore Course**:
- [ ] Restore course → Verify restoration to original location
- [ ] Restore with collision → Test "Rename restore"
- [ ] Restore with collision → Test "Abort"
- [ ] Cancel restore → Verify no changes

**Rename Course**:
- [ ] Rename course → Verify all folders renamed
- [ ] Rename with collision → Test "Archive existing"
- [ ] Rename with collision → Test "Rename existing"
- [ ] Cancel rename → Verify no changes

#### Scanning

**Session Lifecycle**:
- [ ] Start session → Verify snapshot taken
- [ ] Scan documents → Verify detection
- [ ] End session → Verify new files listed
- [ ] Stability check → Verify unstable files marked

**Merge & Append**:
- [ ] Merge 3 PDFs → Verify output
- [ ] Append 2 PDFs to existing → Verify appended
- [ ] Reorder files → Verify page order
- [ ] Exclude files → Verify not included
- [ ] Archive originals → Verify moved to archive
- [ ] Backup before append → Verify backup created

**Edge Cases**:
- [ ] No watch folders configured → Verify error
- [ ] Watch folder not accessible → Verify error
- [ ] No day folder → Verify auto-creation
- [ ] No PDFs detected → Verify message
- [ ] Locked file → Verify unstable marking

#### Settings

**Base Folders**:
- [ ] Edit University folder → Verify saved
- [ ] Reload Obsidian → Verify persisted

**Notes Subfolder Options**:
- [ ] Add new option → Verify appears in list
- [ ] Edit option → Verify changes saved
- [ ] Remove option → Verify removed

**Course Templates**:
- [ ] Add new template → Verify appears in list
- [ ] Edit template → Verify changes saved
- [ ] Link template to notes layout → Verify auto-applied
- [ ] Remove template → Verify removed

**Scans**:
- [ ] Add watch folder → Verify saved
- [ ] Remove watch folder → Verify removed
- [ ] Edit stability settings → Verify applied

**Reset**:
- [ ] Reset to defaults → Verify all settings restored

#### Integration

**Full Workflow**:
- [ ] Create course → Archive → Restore → Delete
- [ ] Create with template → Scan document → Merge PDF
- [ ] Manage Courses loop → Test all actions

---

## Migration History

### QuickAdd Script → Plugin (October 2025)

**Migrated**:
- All course management functions (create, delete, archive, restore, rename)
- Folder structure conventions (University/Courses, Notes, Attachments, Scans)
- Template system with Templater integration
- Notes subfolder layouts

**Added**:
- Live PDF scanning workflow (was deferred in migration)
- Full settings UI (no manual JSON editing)
- Direct commands for all operations
- Enhanced error handling and notices
- Archive/restore conflict resolution

**Changed**:
- Settings storage: `config.json` → `data.json` (plugin data)
- No external JSON file (fully integrated into plugin settings)
- UI: QuickAdd suggester → Obsidian modals

**Deferred** (from original migration plan):
- OCR processing (still not implemented)
- Folder watching for automatic scan processing (manual session-based instead)

---

## Appendix

### Common Gotchas

1. **Type assertions**: Obsidian API uses `unknown` types; cast safely:
```typescript
const folder = this.app.vault.getAbstractFileByPath(path) as TFolder | null;
```

2. **Plugin instance**: Services receive `Plugin` type; access `app` via cast:
```typescript
this.app = (plugin as unknown as { app: App }).app;
```

3. **Async operations**: Always `await` vault operations:
```typescript
await this.app.vault.create(path, content);  // ✅
this.app.vault.create(path, content);        // ❌ (no await)
```

4. **Folder children**: Type is `unknown[]`, cast carefully:
```typescript
const children = (folder as unknown as { children?: unknown[] }).children || [];
```

5. **Command IDs**: Never change after release (breaking change for users' command palette)

---

### Useful Resources

- [Obsidian API Docs](https://docs.obsidian.md)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**End of Technical Reference**
