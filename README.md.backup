# Jinxx Tools

An Obsidian plugin for managing university courses and study materials. This plugin provides comprehensive course management features including creation, archiving, deletion, restoration, and renaming.

## Features

- **Course Management**: Create, delete, archive, restore, and rename courses
- **Folder Structure**: Automatically creates organized folder structures for each course (Courses, Attachments, Notes, Scans)
- **Lecture Subfolders**: Optionally create nested subfolder structures for lectures and exercises
- **Archive System**: Archive courses with timestamped snapshots for easy restoration
- **Template Support**: Use custom templates for course notes (integrates with Templater if installed)
- **Settings Migration**: Automatically migrates settings from legacy `95_Scripts/config.json` on first load

## Installation

### Development Installation

1. Clone this repository into your vault's plugins folder:
   ```powershell
   cd "C:\Dev\Lambda Vault\Lambda Vault\.obsidian\plugins"
   git clone https://github.com/CodingJinxx/jinxx-tools.git
   cd jinxx-tools
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Build the plugin:
   ```powershell
   npm run build
   ```

4. Reload Obsidian and enable the plugin in **Settings → Community plugins**

### Production Build

To create a production build:
```powershell
npm run build
```

The build artifacts (`main.js`, `manifest.json`, `styles.css`) will be generated in the plugin folder.

## Usage

### Main Command: Jinxx Tools: Open Tools

Run the command `Jinxx Tools: Open Tools` (Ctrl/Cmd+P) to access the main menu:

- **➕ Add Course**: Create a new course with folder structure
- **📚 Manage Courses**: Browse, archive, delete, rename, or restore courses
- **♻️ Restore Archive**: Restore files from an archive snapshot
- **⚙️ Edit Settings**: Open plugin settings

### Managing Courses

1. Open the tools menu
2. Select **Manage Courses**
3. Choose a course from the list
4. Select an action:
   - **Delete**: Permanently remove the course and all associated files
   - **Archive**: Move course to Archive with timestamp
   - **Restore**: Restore from a previous archive snapshot
   - **Rename**: Rename the course and all associated folders

### Adding a Course

1. Open the tools menu
2. Select **Add Course**
3. Enter the course name
4. Optionally select a course template
5. Optionally select a lecture subfolder layout

The plugin will create:
- A course note in `University/Courses/`
- Folders in `University/Attachments/<CourseName>`
- Folders in `University/Notes/<CourseName>`
- Folders in `University/Scans/<CourseName>`

### Settings

Configure the plugin in **Settings → Jinxx Tools**:

#### Base Folders
- Home, Garden, University, Work, Books, Templates folder paths

#### Lecture Subfolder Options
- Define nested folder structures for course notes
- Example: Lecture, Exercises, Test folders

#### Course Templates
- Map template names to template files
- Templates are stored in your Templates folder

#### Scans
- Watch folders for scanning (deferred feature; read-only for now)

## Migration from QuickAdd Script

This plugin is a migration of the QuickAdd user script `jinxx-quickadd.js`. On first load, it will automatically attempt to read settings from `95_Scripts/config.json` and migrate them to the plugin's internal settings storage.

**Note**: The original `config.json` file is never deleted or modified during migration.

## Deferred Features

The following features from the original QuickAdd script are **not yet implemented** and are deferred to a future version:

- PDF scanning and merging
- OCR processing
- Folder watching for automatic scan processing

## Development

### Build Commands

- **Development build (watch mode)**:
  ```powershell
  npm run dev
  ```

- **Production build**:
  ```powershell
  npm run build
  ```

### Project Structure

```
jinxx-tools/
├── main.ts                      # Plugin entry point
├── manifest.json                # Plugin metadata
├── src/
│   ├── commands/
│   │   └── editConfig.ts        # Interactive config editor
│   ├── services/
│   │   ├── ConfigService.ts     # Settings management
│   │   └── CourseService.ts     # Course operations
│   ├── settings/
│   │   └── SettingTab.ts        # Plugin settings UI
│   ├── ui/
│   │   ├── SimpleSuggester.ts   # Fuzzy suggester wrapper
│   │   ├── PromptModal.ts       # Text input modal
│   │   ├── YesNoModal.ts        # Confirmation modal
│   │   └── PreviewModal.ts      # Preview modal
│   └── utils/
│       └── file.ts              # File system utilities
└── reference/
    └── 95_Scripts/              # Original QuickAdd script reference
```

## Manual Testing

To verify the plugin works correctly, perform these acceptance tests:

### Test 1: Plugin loads and migrates settings
1. Ensure `95_Scripts/config.json` exists in your vault (if migrating from QuickAdd)
2. Enable the plugin
3. Open **Settings → Jinxx Tools**
4. Verify that settings were migrated (green notice should appear)

### Test 2: Create a course
1. Run `Jinxx Tools: Open Tools`
2. Select **Add Course**
3. Enter a course name (e.g., "Test Course")
4. Optionally select a template
5. Verify folders are created in University/Courses, Notes, Attachments, Scans

### Test 3: Manage courses
1. Run `Jinxx Tools: Open Tools`
2. Select **Manage Courses**
3. Select a course
4. Try each action (Delete, Archive, Restore, Rename)
5. Verify each operation works correctly

### Test 4: Archive and restore
1. Create a test course
2. Archive it via **Manage Courses**
3. Verify archive folder created in `University/Archive/<CourseName>_<timestamp>`
4. Restore the course
5. Verify course is restored to original location

### Test 5: Settings persistence
1. Open **Settings → Jinxx Tools**
2. Modify a base folder path
3. Save settings
4. Reload Obsidian
5. Verify settings persisted

## Function Mapping (QuickAdd → Plugin)

| QuickAdd Function | Plugin Implementation |
|-------------------|----------------------|
| `addCourse` | `CourseService.createCourse()` |
| `editConfig` | `runEditConfig()` + Settings Tab |
| `deleteCourse` | `CourseService.deleteCourse()` |
| `archiveCourse` | `CourseService.archiveCourse()` |
| `restoreCourse` | `CourseService.restoreCourse()` |
| `renameCourse` | `CourseService.renameCourse()` |
| `manageCourses` | `JinxxToolsPlugin.handleManageCourses()` |
| `ensureFolder` | `utils/file.ensureFolder()` |
| `deleteFolderRecursively` | `utils/file.deleteFolderRecursively()` |
| `buildCompactSummary` | `utils/file.buildCompactSummary()` |
| QuickAdd suggester | `SimpleSuggester.openAndChoose()` |
| QuickAdd inputPrompt | `PromptModal.openPrompt()` |
| QuickAdd yesNoPrompt | `YesNoModal.openPrompt()` |

## License

MIT

## Author

Jay Leimer ([@CodingJinxx](https://github.com/CodingJinxx))

## Support

If you find this plugin helpful, consider [buying me a coffee](https://buymeacoffee.com/codingjinxx)!
