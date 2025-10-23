# Jinxx Tools

A comprehensive Obsidian plugin for managing university courses and study materials with integrated scanning capabilities. Streamline your academic workflow with structured course creation, flexible archiving, and PDF document management.

## Overview

Jinxx Tools helps students and academics organize their vault by:

- **Creating structured courses** with automatic folder hierarchies (Notes, Attachments, Scans)
- **Managing course lifecycles** with archive and restore functionality
- **Scanning documents** directly into course-specific PDF files
- **Templating** course notes with optional Templater integration
- **Organizing notes** with customizable subfolder layouts (Lectures, Exercises, etc.)

This plugin is ideal for university students who want to maintain a clean, organized vault with minimal manual file management.

## Features

### 📚 Course Management

Create and manage courses with a complete folder structure automatically generated for each course:

- **Course Note**: Markdown file in `University/Courses/`
- **Attachments Folder**: `University/Attachments/<CourseName>/`
- **Notes Folder**: `University/Notes/<CourseName>/` (with optional subfolders)
- **Scans Folder**: `University/Scans/<CourseName>/`

**Available Operations**:
- **Create**: Add new courses with optional templates and subfolder layouts
- **Delete**: Remove courses permanently (with confirmation)
- **Archive**: Move courses to timestamped archive snapshots
- **Restore**: Recover courses from archives (with rename on conflict)
- **Rename**: Change course names and update all related folders

### 📄 Scanning & PDF Management

Scan physical documents directly into your vault with live monitoring:

1. **Start a scan session** to establish a baseline
2. **Scan documents** using your physical scanner
3. **Live monitoring** detects new PDFs automatically
4. **Review & organize** files before merging:
   - Reorder pages with ↑↓ buttons
   - Exclude unwanted files
   - Choose target course
5. **Merge** into a single PDF or append to existing scan
6. **Automatic archiving** of original single-page PDFs (optional)

**Key Features**:
- Stability checks ensure files are fully written before processing
- Subfolder support for organizing scans (e.g., `Week1/`, `Lectures/`)
- Backup before append (optional)
- PDF merging powered by `pdf-lib` (no external dependencies)

### 📝 Template System

Use custom templates for course notes:

- Define multiple templates in settings
- Preview templates before applying
- Link templates to specific notes subfolder layouts
- Templater plugin integration for dynamic variables (automatic if installed)

### 🗂️ Archive System

Archive courses with timestamped snapshots:

- Format: `<CourseName>_YYYY-MM-DD_HH-MM-SS`
- Full structure preserved (Courses, Notes, Attachments, Scans)
- Restore with automatic conflict resolution
- Multiple snapshots per course supported

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for "Jinxx Tools"
3. Click **Install** then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/CodingJinxx/jinxx-tools/releases)
2. Create folder: `<VaultFolder>/.obsidian/plugins/jinxx-tools/`
3. Copy the three files into the folder
4. Reload Obsidian and enable the plugin in **Settings → Community plugins**

### Development Installation

```bash
# Clone into your vault's plugins folder
cd "<YourVault>/.obsidian/plugins"
git clone https://github.com/CodingJinxx/jinxx-tools.git
cd jinxx-tools

# Install dependencies
npm install

# Build for development (watch mode)
npm run dev

# OR build for production
npm run build
```

Then reload Obsidian and enable the plugin.

## Usage

### Initial Setup

1. Open **Settings → Jinxx Tools**
2. Configure **Base Folders** (defaults work for most users):
   - University: `20_University`
   - Templates: `90_Templates`
3. (Optional) Add **Notes Subfolder Options** for lecture layouts
4. (Optional) Configure **Course Templates**
5. (Optional) For scanning: Add **Scanner Watch Folders** (e.g., `C:\Scans\Canon`)

### Creating a Course

**Option 1: Main Menu**
1. Run command: `Jinxx Tools: Manage Courses` (Ctrl/Cmd+P)
2. Select **➕ Add Course**
3. Enter course name (e.g., "Calculus 101")
4. (Optional) Choose a template
5. (Optional) Select notes subfolder layout

**Option 2: Direct Command**
1. Run command: `Jinxx Tools: Add Course`
2. Follow prompts as above

**Result**: Creates:
```
20_University/
  Courses/
    Calculus 101.md
  Notes/
    Calculus 101/
      Lecture/      (if subfolder layout selected)
      Exercises/
  Attachments/
    Calculus 101/
  Scans/
    Calculus 101/
```

### Managing Courses

**Interactive Menu**:
1. Run `Jinxx Tools: Manage Courses`
2. Select a course from the list
3. Choose action:
   - **📄 Scan**: Start scanning workflow for this course
   - **🗑️ Delete**: Delete permanently (with confirmation)
   - **📦 Archive**: Move to archive with timestamp
   - **♻️ Restore**: Restore from a previous archive snapshot
   - **✏️ Rename**: Rename course and all folders

**Direct Commands** (also available):
- `Jinxx Tools: Delete Course`
- `Jinxx Tools: Archive Course`
- `Jinxx Tools: Restore Course`
- `Jinxx Tools: Rename Course`

### Scanning Documents

**Requirements**:
- Scanner configured to save PDFs to a watch folder (e.g., `C:\Scans\Canon`)
- Scanner creates day-based subfolders (e.g., `2025_10_23`) — auto-created if missing
- Desktop platform (uses Node.js fs module)

**Workflow**:

1. **Start Scan Session**:
   - Run `Jinxx Tools: Scan` or select **📄 Scan** from course menu
   - Select target course (or already selected if from course menu)
   - Choose: **📄 Create New Scan** or **📎 Append to Existing**
   - For new scans:
     - Select subfolder (root, existing, or create new)
     - Enter filename (e.g., "Lecture_Week1")

2. **Live Monitoring Modal Opens**:
   - Shows "Waiting for PDFs..." status
   - Scan your documents (plugin detects new PDFs automatically)
   - Files appear in the list as they're detected

3. **Review & Organize**:
   - ✅ Checkbox: Include/exclude files
   - ↑↓ Buttons: Reorder pages
   - Auto-ordered by numeric sequence (IMG_0001, IMG_0002) or modification time

4. **Merge**:
   - Click **Merge PDFs** button
   - Plugin merges all checked files in order
   - Original files archived if configured
   - Notice shows result with file count and path

**Settings** (optional):
- **Stability Delay**: Wait time between size checks (default: 1000ms)
- **Stability Retries**: Retries for locked files (default: 3)
- **Archive After Merge**: Move originals to archive folder
- **Backup Before Append**: Create backup before appending to existing PDF

### Customizing Settings

**Notes Subfolder Options**:
1. Go to **Settings → Jinxx Tools → Notes Subfolder Options**
2. Click **Edit** (pencil icon) on an existing option, or **Add New Notes Option**
3. Configure folder structure (e.g., `Lecture`, `Exercises`, `Test`)
4. Save

**Course Templates**:
1. Go to **Settings → Jinxx Tools → Course Templates**
2. Click **Edit** on an existing template, or **Add New Template**
3. Set:
   - **Label**: Display name (e.g., "Lecture Course")
   - **Template File**: Path in Templates folder (e.g., `course_template.md`)
   - **Notes Subfolder Option**: Auto-apply a notes layout (optional)
4. Save

**Scanner Folders**:
1. Go to **Settings → Jinxx Tools → Scans**
2. Click **Add Scanner Folder**
3. Enter absolute path (e.g., `C:\Scans\Canon`)
4. Configure stability and archiving options as needed

## Settings Reference

### Base Folders
- **University**: Root folder for courses (default: `20_University`)
- **Templates**: Folder for course templates (default: `90_Templates`)
- **Home**, **Garden**, **Work**, **Books**: Other organizational folders

### Notes Subfolder Options
Define nested folder structures for course notes. Each option has:
- **Label**: Display name shown in prompts
- **Folders**: Hierarchical structure (e.g., `{ Lecture: {}, Exercises: {} }`)

### Course Templates
Map templates to template files:
- **Label**: Display name
- **Template File**: Relative path in Templates folder
- **Notes Subfolder Option**: Auto-apply a subfolder layout (optional)

### Scans
- **Watch Folders**: Array of absolute paths where scanner saves PDFs
- **Stability Delay (ms)**: Wait time between file size checks (default: 1000)
- **Stability Retries**: Max retry attempts for locked files (default: 3)
- **Keep Original Files**: Don't delete single-page PDFs after merge
- **Archive After Merge**: Move originals to archive folder
- **Archive Folder Path**: Custom archive location (default: `{scanFolder}/archive`)
- **Backup Before Append**: Create backup before appending pages

## Troubleshooting

### Course creation fails
- **Error**: "A course with that name already exists"
- **Solution**: Delete or rename the existing course first

### Scanning: No PDFs detected
- **Check**: Scanner is saving to configured watch folder
- **Check**: Day folder exists (e.g., `2025_10_23`) or plugin has permission to create it
- **Check**: Files are PDFs (`.pdf` extension)
- **Try**: Restart scan session

### Scanning: Files shown as "Unstable"
- **Cause**: Scanner still writing file, or file locked by another program
- **Solution**: Wait a moment, then manually trigger detection, or exclude the file

### Templater not rendering
- **Check**: Templater plugin is installed and enabled
- **Check**: Template file contains valid Templater syntax
- **Note**: Plugin attempts auto-rendering; check console (Ctrl+Shift+I) for details

### Settings not persisting
- **Check**: Plugin has write permission to `.obsidian/plugins/jinxx-tools/data.json`
- **Try**: Reload Obsidian and verify settings

## Plugin API

Jinxx Tools exposes a public API that allows other Obsidian plugins to programmatically access course configuration and data. This enables integration with your academic workflow tools.

### Quick Example

```typescript
// Access the API from another plugin
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;

if (jinxxTools?.api) {
  // Get all courses
  const courses = await jinxxTools.api.getCourses();
  console.log('Available courses:', courses);

  // Get course paths
  const paths = jinxxTools.api.getCoursePaths('Calculus');
  console.log('Notes folder:', paths.notesFolder);

  // Create a file in the course notes folder
  const notePath = `${paths.notesFolder}/My Note.md`;
  await this.app.vault.create(notePath, '# My Note');
}
```

### Available Methods

- `getBaseFolders()`: Get university folder configuration
- `getCourses()`: List all course names
- `courseExists(courseName)`: Check if a course exists
- `getCoursePath(courseName)`: Get path to course folder
- `getCoursePaths(courseName)`: Get all paths (notes, attachments, scans, course file)
- `getAllBaseFolders()`: Get all configured base folders
- `isScanningEnabled()`: Check if scanning is configured
- `getScanWatchFolders()`: Get scanner watch folder paths

### Documentation

For complete API reference, usage examples, and integration patterns, see **[docs/API.md](docs/API.md)**.

### Use Cases

- **Create files in course folders**: Automatically place generated notes in the right location
- **Display course information**: Build dashboards or course overviews
- **Integrate with scanning**: Automate post-scan workflows
- **Course-aware tools**: Build plugins that understand your course structure

**Note**: This is a desktop-only plugin. The API is only available on desktop platforms.

## Development

For detailed technical documentation, architecture overview, and extension guidelines, see **[docs/project_reference.md](docs/project_reference.md)**.

### Build Commands

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build

# Deploy to vault (configured in deploy.mjs)
npm run deploy

# Lint
npm run lint

# Format
npm run format
```

### Project Structure

```
jinxx-tools/
├── main.ts                       # Plugin entry, lifecycle, command registration
├── manifest.json                 # Plugin metadata
├── package.json                  # Dependencies and scripts
├── src/
│   ├── services/
│   │   ├── ConfigService.ts      # Settings read/write
│   │   ├── CourseService.ts      # Course operations (CRUD)
│   │   └── ScanService.ts        # PDF scanning and merging
│   ├── settings/
│   │   └── SettingTab.ts         # Plugin settings UI
│   ├── ui/
│   │   ├── SimpleSuggester.ts    # Fuzzy search modal wrapper
│   │   ├── PromptModal.ts        # Text input modal
│   │   ├── YesNoModal.ts         # Confirmation modal
│   │   ├── LiveScanMonitorModal.ts # Live PDF scanning UI
│   │   └── ...                   # Other modals
│   └── utils/
│       └── file.ts               # File operations (ensureFolder, delete, etc.)
└── docs/                         # Documentation
```

### Testing Manually

See [docs/project_reference.md](docs/project_reference.md#testing-checklist) for comprehensive test scenarios.

**Quick Smoke Test**:
1. Create a course → Verify folders
2. Archive the course → Verify archive snapshot
3. Restore the course → Verify restoration
4. Delete the course → Verify deletion

## Migration from QuickAdd Script

This plugin is a complete migration of the `jinxx-quickadd.js` QuickAdd script with feature parity and improvements:

- **Migrated**: All course management functions
- **Added**: Live scanning workflow with UI
- **Added**: Full settings UI (no manual JSON editing)
- **Added**: Direct commands for all operations
- **Improved**: Error handling and user feedback
- **Improved**: Archive/restore conflict resolution

## Roadmap

- [ ] OCR integration for scanned documents
- [ ] Bulk operations (archive/delete multiple courses)
- [ ] Course statistics and analytics
- [ ] Export/import settings
- [ ] Mobile support (limited features)

## Support

- **Issues**: [GitHub Issues](https://github.com/CodingJinxx/jinxx-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CodingJinxx/jinxx-tools/discussions)
- **Documentation**: [docs/](docs/)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See [AGENTS.md](AGENTS.md) for coding guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**Jay Leimer** ([@CodingJinxx](https://github.com/CodingJinxx))

If you find this plugin helpful, consider [buying me a coffee](https://buymeacoffee.com/codingjinxx) ☕

## Acknowledgments

- Built on the [Obsidian API](https://docs.obsidian.md)
- PDF merging powered by [pdf-lib](https://pdf-lib.js.org/)
- Inspired by academic note-taking workflows
