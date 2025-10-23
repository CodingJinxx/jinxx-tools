# Jinxx Tools Plugin API

## Overview

The Jinxx Tools plugin exposes a public API that allows other Obsidian plugins to programmatically access course configuration and data. This API provides read-only access to plugin settings and course information.

### Purpose

- **Integration**: Enable other plugins to integrate with Jinxx Tools course management
- **Read-only**: Safe access to configuration without risk of corruption
- **Type-safe**: Full TypeScript type definitions included
- **Desktop-only**: This plugin and its API are desktop-only (uses Node.js modules)

### Who Should Use This API

- Plugin developers who want to create files in course folders
- Plugins that display course information
- Tools that integrate with the academic note-taking workflow
- Automation scripts that need to query course structure

### Stability Guarantees

- The API follows semantic versioning
- Breaking changes will only occur in major version bumps (e.g., 2.0.0 → 3.0.0)
- Deprecation notices will be given at least one minor version in advance
- New methods may be added in minor versions (non-breaking)

## Installation Check

Before using the API, always check if the Jinxx Tools plugin is installed and enabled:

```typescript
// Check if plugin is available
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;

if (!jinxxTools) {
  console.error('Jinxx Tools plugin is not installed or enabled');
  return;
}

if (!jinxxTools.api) {
  console.error('Jinxx Tools API is not available (plugin may be outdated)');
  return;
}

// Now you can safely use the API
const api = jinxxTools.api;
```

## API Reference

### `getBaseFolders()`

Get the base folder configuration for course management.

**Signature:**
```typescript
getBaseFolders(): {
  universityFolder: string;
  coursesSubfolder: string;
  fullCoursesPath: string;
}
```

**Returns:**
- `universityFolder`: The root university folder (default: `"20_University"`)
- `coursesSubfolder`: The subfolder for course files (always `"Courses"`)
- `fullCoursesPath`: Combined path to courses (e.g., `"20_University/Courses"`)

**Example:**
```typescript
const folders = api.getBaseFolders();
console.log(folders.universityFolder);   // "20_University"
console.log(folders.coursesSubfolder);   // "Courses"
console.log(folders.fullCoursesPath);    // "20_University/Courses"
```

**Error Handling:**
- Returns safe defaults if configuration is unavailable
- Never throws errors

---

### `getCourses()`

Get a list of all course names in the courses folder.

**Signature:**
```typescript
getCourses(): Promise<string[]>
```

**Returns:**
- Promise resolving to an array of course names (folder names without `.md` extension)

**Example:**
```typescript
const courses = await api.getCourses();
console.log(courses); // ["Calculus", "Physics", "Chemistry"]

// Use in a loop
for (const course of courses) {
  console.log(`Found course: ${course}`);
}
```

**Error Handling:**
- Returns empty array `[]` if courses cannot be read
- Logs errors to console
- Never throws errors

---

### `courseExists(courseName)`

Check if a specific course exists.

**Signature:**
```typescript
courseExists(courseName: string): Promise<boolean>
```

**Parameters:**
- `courseName`: The name of the course to check

**Returns:**
- Promise resolving to `true` if the course exists, `false` otherwise

**Example:**
```typescript
const exists = await api.courseExists("Calculus");
if (exists) {
  console.log("Calculus course exists!");
} else {
  console.log("Calculus course not found");
}
```

**Error Handling:**
- Returns `false` if courseName is empty or undefined
- Returns `false` if an error occurs during lookup
- Logs errors to console
- Never throws errors

---

### `getCoursePath(courseName)`

Get the full path to a course folder.

**Signature:**
```typescript
getCoursePath(courseName: string): string
```

**Parameters:**
- `courseName`: The name of the course

**Returns:**
- The complete path to the course folder (e.g., `"20_University/Courses/Calculus"`)

**Example:**
```typescript
const path = api.getCoursePath("Calculus");
console.log(path); // "20_University/Courses/Calculus"

// Use with Obsidian vault API
const folder = this.app.vault.getAbstractFileByPath(path);
if (folder) {
  console.log("Course folder exists");
}
```

**Important Notes:**
- Returns the expected path even if the course doesn't exist
- Use `courseExists()` to verify existence before using the path
- Returns empty string if courseName is empty or undefined

**Error Handling:**
- Returns empty string on error
- Logs errors to console
- Never throws errors

---

### `getCoursePaths(courseName)`

Get the full paths to all course-related folders.

**Signature:**
```typescript
getCoursePaths(courseName: string): {
  courseFile: string;
  notesFolder: string;
  attachmentsFolder: string;
  scansFolder: string;
}
```

**Parameters:**
- `courseName`: The name of the course

**Returns:**
- `courseFile`: Path to the course markdown file (e.g., `"20_University/Courses/Calculus.md"`)
- `notesFolder`: Path to the notes folder (e.g., `"20_University/Notes/Calculus"`)
- `attachmentsFolder`: Path to the attachments folder (e.g., `"20_University/Attachments/Calculus"`)
- `scansFolder`: Path to the scans folder (e.g., `"20_University/Scans/Calculus"`)

**Example:**
```typescript
const paths = api.getCoursePaths("Calculus");
console.log(paths.courseFile);        // "20_University/Courses/Calculus.md"
console.log(paths.notesFolder);       // "20_University/Notes/Calculus"
console.log(paths.attachmentsFolder); // "20_University/Attachments/Calculus"
console.log(paths.scansFolder);       // "20_University/Scans/Calculus"

// Check which folders exist
const vault = this.app.vault;
const notesFolderExists = !!vault.getAbstractFileByPath(paths.notesFolder);
console.log(`Notes folder exists: ${notesFolderExists}`);
```

**Important Notes:**
- Returns paths even if the course or folders don't exist
- Use Obsidian's vault API to verify existence before using

**Error Handling:**
- Returns empty strings for all paths on error
- Returns empty strings if courseName is empty or undefined
- Logs errors to console
- Never throws errors

---

### `getAllBaseFolders()`

Get all base folders configured in the plugin.

**Signature:**
```typescript
getAllBaseFolders(): {
  Home: string;
  Garden: string;
  University: string;
  Work: string;
  Books: string;
  Templates: string;
}
```

**Returns:**
- Object containing all base folder paths with their default values if not configured

**Example:**
```typescript
const allFolders = api.getAllBaseFolders();
console.log(allFolders.Home);       // "00_Home"
console.log(allFolders.University); // "20_University"
console.log(allFolders.Templates);  // "90_Templates"

// Create a file in the templates folder
const templatePath = `${allFolders.Templates}/my-template.md`;
await this.app.vault.create(templatePath, "# Template");
```

**Error Handling:**
- Returns safe defaults if configuration is unavailable
- Never throws errors

---

### `isScanningEnabled()`

Check if the scanning feature is configured and available.

**Signature:**
```typescript
isScanningEnabled(): boolean
```

**Returns:**
- `true` if at least one watch folder is configured, `false` otherwise

**Example:**
```typescript
if (api.isScanningEnabled()) {
  console.log("Scanning is available");
  const folders = api.getScanWatchFolders();
  console.log(`Watching ${folders.length} folder(s)`);
} else {
  console.log("Scanning is not configured");
}
```

**Error Handling:**
- Returns `false` on error
- Logs errors to console
- Never throws errors

---

### `getScanWatchFolders()`

Get the list of configured scanner watch folders.

**Signature:**
```typescript
getScanWatchFolders(): string[]
```

**Returns:**
- Array of file system paths being monitored for scans

**Example:**
```typescript
const watchFolders = api.getScanWatchFolders();
console.log(watchFolders); // ["C:\\Dev\\Scans", "D:\\Scanner"]

for (const folder of watchFolders) {
  console.log(`Monitoring: ${folder}`);
}
```

**Error Handling:**
- Returns empty array `[]` on error
- Logs errors to console
- Never throws errors

---

## Complete Usage Example

Here's a complete example showing how to safely use the API in your plugin:

```typescript
import { Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'create-course-note',
      name: 'Create Note in Course',
      callback: async () => {
        await this.createCourseNote();
      }
    });
  }

  async createCourseNote() {
    // Step 1: Check if Jinxx Tools is available
    const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
    
    if (!jinxxTools) {
      console.error('Jinxx Tools plugin is not installed');
      return;
    }

    if (!jinxxTools.api) {
      console.error('Jinxx Tools API is not available');
      return;
    }

    const api = jinxxTools.api;

    // Step 2: Get list of courses
    const courses = await api.getCourses();
    
    if (courses.length === 0) {
      console.log('No courses found');
      return;
    }

    // Step 3: Use first course (in real plugin, you'd prompt user)
    const courseName = courses[0];
    
    // Step 4: Verify course exists
    const exists = await api.courseExists(courseName);
    if (!exists) {
      console.log(`Course ${courseName} does not exist`);
      return;
    }

    // Step 5: Get course paths
    const paths = api.getCoursePaths(courseName);
    
    // Step 6: Create a note in the notes folder
    const notePath = `${paths.notesFolder}/My New Note.md`;
    
    try {
      // Check if notes folder exists
      const notesFolder = this.app.vault.getAbstractFileByPath(paths.notesFolder);
      
      if (!notesFolder) {
        // Create notes folder if it doesn't exist
        await this.app.vault.createFolder(paths.notesFolder);
      }
      
      // Create the note
      await this.app.vault.create(notePath, `# My New Note\n\nCreated in ${courseName}`);
      console.log(`Created note: ${notePath}`);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }
}
```

## Use Cases

### 1. Plugin that Creates Files in Course Folders

```typescript
// Get the notes folder for a course
const paths = api.getCoursePaths("Calculus");
const notePath = `${paths.notesFolder}/Lecture-01.md`;

// Create a file
await this.app.vault.create(notePath, "# Lecture 1");
```

### 2. Plugin that Displays Course Information

```typescript
// Get all courses
const courses = await api.getCourses();

// Display in UI
const courseList = courses.map(c => `- ${c}`).join('\n');
console.log(`Courses:\n${courseList}`);
```

### 3. Plugin that Integrates with Scanning

```typescript
// Check if scanning is available
if (api.isScanningEnabled()) {
  const watchFolders = api.getScanWatchFolders();
  console.log(`Monitoring ${watchFolders.length} scanner folders`);
  
  // Get scan folder for a course
  const paths = api.getCoursePaths("Physics");
  console.log(`Scans will be saved to: ${paths.scansFolder}`);
}
```

### 4. Automated Course Backup

```typescript
async function backupAllCourses() {
  const api = jinxxTools.api;
  const courses = await api.getCourses();
  
  for (const course of courses) {
    const paths = api.getCoursePaths(course);
    
    // Get all files in course folders
    const allFiles = app.vault.getFiles();
    const courseFiles = allFiles.filter(f => 
      f.path.startsWith(paths.notesFolder) ||
      f.path.startsWith(paths.attachmentsFolder) ||
      f.path === paths.courseFile
    );
    
    console.log(`Backing up ${courseFiles.length} files for ${course}`);
    // ... backup logic
  }
}
```

## Troubleshooting

### API Returns Empty Data

**Problem:** API methods return empty arrays or empty strings.

**Solutions:**
1. Verify Jinxx Tools plugin is enabled in Obsidian settings
2. Check that courses have been created using Jinxx Tools commands
3. Verify the plugin version supports the API (v1.0.0+)
4. Check console for error messages

### Type Errors in TypeScript

**Problem:** TypeScript complains about `jinxx-tools` types.

**Solution:**
```typescript
// Use type assertion to access plugins
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;

// Or create a type definition
interface JinxxToolsPlugin {
  api: {
    getCourses(): Promise<string[]>;
    // ... other methods
  };
}

const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as JinxxToolsPlugin;
```

### Plugin Not Found

**Problem:** `jinxxTools` is undefined.

**Solutions:**
1. Ensure Jinxx Tools is installed and enabled
2. Add plugin dependency check in your plugin manifest
3. Show user-friendly error message

```typescript
if (!jinxxTools) {
  new Notice('This feature requires the Jinxx Tools plugin. Please install and enable it.');
  return;
}
```

## Version History

### v1.0.0 (Initial Release)
- Initial public API release
- Read-only access to configuration and course data
- Eight API methods for course management integration

## Future API Additions (Planned)

The following methods may be added in future versions (non-breaking):

- `getTemplates()`: Get list of course templates
- `getNotesSubfolderOptions()`: Get configured notes layouts
- `getCourseMetadata(courseName)`: Get additional course information
- `getArchiveSnapshots(courseName)`: Get list of archived versions

These additions will not break existing code and will be released in minor version bumps.

## Support

If you encounter issues with the API:

1. Check this documentation for proper usage patterns
2. Review the console for error messages
3. Report issues on the GitHub repository: [CodingJinxx/jinxx-tools](https://github.com/CodingJinxx/jinxx-tools)
4. Include your plugin version, Jinxx Tools version, and code example

## License

This API is part of the Jinxx Tools plugin and follows the same license terms.
