# Jinxx Tools API - Quick Reference

One-page reference for the Jinxx Tools plugin API.

## Access Pattern

```typescript
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;

if (!jinxxTools?.api) {
  console.error('Jinxx Tools plugin not available');
  return;
}

const api = jinxxTools.api;
```

## API Methods

### Configuration Methods

#### `getBaseFolders()`
```typescript
const folders = api.getBaseFolders();
// Returns: { universityFolder: string, coursesSubfolder: string, fullCoursesPath: string }
// Example: { universityFolder: "20_University", coursesSubfolder: "Courses", fullCoursesPath: "20_University/Courses" }
```

#### `getAllBaseFolders()`
```typescript
const allFolders = api.getAllBaseFolders();
// Returns: { Home: string, Garden: string, University: string, Work: string, Books: string, Templates: string }
// Example: { Home: "00_Home", University: "20_University", Templates: "90_Templates", ... }
```

### Course Query Methods

#### `getCourses()`
```typescript
const courses = await api.getCourses();
// Returns: Promise<string[]>
// Example: ["Calculus", "Physics", "Chemistry"]
```

#### `courseExists(courseName: string)`
```typescript
const exists = await api.courseExists("Calculus");
// Returns: Promise<boolean>
// Example: true
```

### Path Methods

#### `getCoursePath(courseName: string)`
```typescript
const path = api.getCoursePath("Calculus");
// Returns: string
// Example: "20_University/Courses/Calculus"
```

#### `getCoursePaths(courseName: string)`
```typescript
const paths = api.getCoursePaths("Calculus");
// Returns: { courseFile: string, notesFolder: string, attachmentsFolder: string, scansFolder: string }
// Example: {
//   courseFile: "20_University/Courses/Calculus.md",
//   notesFolder: "20_University/Notes/Calculus",
//   attachmentsFolder: "20_University/Attachments/Calculus",
//   scansFolder: "20_University/Scans/Calculus"
// }
```

### Scanning Methods

#### `isScanningEnabled()`
```typescript
const enabled = api.isScanningEnabled();
// Returns: boolean
// Example: true
```

#### `getScanWatchFolders()`
```typescript
const folders = api.getScanWatchFolders();
// Returns: string[]
// Example: ["C:\\Dev\\Scans"]
```

## Common Patterns

### Create File in Course Folder

```typescript
const api = jinxxTools.api;

// Get course paths
const paths = api.getCoursePaths("Calculus");

// Create note in notes folder
const notePath = `${paths.notesFolder}/Lecture-01.md`;
await this.app.vault.create(notePath, "# Lecture 1");
```

### List All Courses with Iteration

```typescript
const api = jinxxTools.api;

// Get all courses
const courses = await api.getCourses();

// Process each course
for (const course of courses) {
  const paths = api.getCoursePaths(course);
  console.log(`Course: ${course}`);
  console.log(`  Notes: ${paths.notesFolder}`);
}
```

### Check Course Before Creating Files

```typescript
const api = jinxxTools.api;

// Check if course exists
if (await api.courseExists("Calculus")) {
  const paths = api.getCoursePaths("Calculus");
  // Safe to create files
  await this.app.vault.create(`${paths.notesFolder}/note.md`, "content");
} else {
  console.error("Course does not exist");
}
```

### Get All Course Files

```typescript
const api = jinxxTools.api;

// Get paths for a course
const paths = api.getCoursePaths("Calculus");

// Get all files in vault
const allFiles = this.app.vault.getFiles();

// Filter to course files
const courseFiles = allFiles.filter(f => 
  f.path.startsWith(paths.notesFolder) ||
  f.path.startsWith(paths.attachmentsFolder) ||
  f.path.startsWith(paths.scansFolder) ||
  f.path === paths.courseFile
);

console.log(`Found ${courseFiles.length} files in Calculus course`);
```

### Check Scanning Configuration

```typescript
const api = jinxxTools.api;

if (api.isScanningEnabled()) {
  const folders = api.getScanWatchFolders();
  console.log(`Scanning enabled with ${folders.length} watch folders`);
  folders.forEach(f => console.log(`  Watching: ${f}`));
} else {
  console.log("Scanning not configured");
}
```

## Error Handling

All API methods handle errors gracefully:

- **Never throw errors** - Always return safe defaults
- **Empty arrays** for list methods that fail
- **Empty strings** for path methods that fail
- **false** for boolean methods that fail
- **Errors logged to console** for debugging

```typescript
// No try-catch needed - API handles errors
const courses = await api.getCourses(); // Returns [] on error
const exists = await api.courseExists(""); // Returns false
const path = api.getCoursePath(""); // Returns ""
```

## Type Safety

For TypeScript plugins, you can define types:

```typescript
interface JinxxToolsPlugin {
  api: {
    getBaseFolders(): { universityFolder: string; coursesSubfolder: string; fullCoursesPath: string };
    getCourses(): Promise<string[]>;
    courseExists(courseName: string): Promise<boolean>;
    getCoursePath(courseName: string): string;
    getCoursePaths(courseName: string): { courseFile: string; notesFolder: string; attachmentsFolder: string; scansFolder: string };
    getAllBaseFolders(): { Home: string; Garden: string; University: string; Work: string; Books: string; Templates: string };
    isScanningEnabled(): boolean;
    getScanWatchFolders(): string[];
  };
}

const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as JinxxToolsPlugin | undefined;
```

## Best Practices

1. **Always check if API is available**
   ```typescript
   if (!jinxxTools?.api) return;
   ```

2. **Verify course exists before operations**
   ```typescript
   if (!await api.courseExists(courseName)) return;
   ```

3. **Use Obsidian vault API to verify paths**
   ```typescript
   const folder = this.app.vault.getAbstractFileByPath(paths.notesFolder);
   if (!folder) {
     // Create folder or show error
   }
   ```

4. **Show user-friendly errors**
   ```typescript
   if (!jinxxTools?.api) {
     new Notice('Please install Jinxx Tools plugin');
     return;
   }
   ```

## Console Testing

Quick test in developer console (Ctrl+Shift+I):

```javascript
// Check availability
console.log('API:', app.plugins.plugins['jinxx-tools']?.api);

// Get folders
console.log(app.plugins.plugins['jinxx-tools'].api.getBaseFolders());

// Get courses
app.plugins.plugins['jinxx-tools'].api.getCourses().then(console.log);
```

## Full Documentation

- Complete API reference: `docs/API.md`
- Testing guide: `docs/API_Testing.md`
- Implementation details: `docs/API_Implementation_Summary.md`

## Support

- Issues: [GitHub Issues](https://github.com/CodingJinxx/jinxx-tools/issues)
- Docs: [docs/API.md](../docs/API.md)

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Plugin**: Jinxx Tools (Desktop Only)
