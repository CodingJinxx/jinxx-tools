# Getting Started with the Jinxx Tools API

Quick start guide for plugin developers who want to integrate with Jinxx Tools.

## 5-Minute Quick Start

### Step 1: Check if Jinxx Tools is Available

```typescript
// In your plugin's code
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;

if (!jinxxTools) {
  console.error('Jinxx Tools not installed');
  return;
}

if (!jinxxTools.api) {
  console.error('Jinxx Tools API not available (update plugin)');
  return;
}

// You're ready to use the API!
const api = jinxxTools.api;
```

### Step 2: Get Course List

```typescript
const courses = await api.getCourses();
console.log('Found courses:', courses);
// Output: ["Calculus", "Physics", "Chemistry"]
```

### Step 3: Get Course Paths

```typescript
const paths = api.getCoursePaths('Calculus');
console.log('Course paths:', paths);
// Output: {
//   courseFile: "20_University/Courses/Calculus.md",
//   notesFolder: "20_University/Notes/Calculus",
//   attachmentsFolder: "20_University/Attachments/Calculus",
//   scansFolder: "20_University/Scans/Calculus"
// }
```

### Step 4: Create Files in Course Folders

```typescript
// Create a note in the course notes folder
const notePath = `${paths.notesFolder}/My New Note.md`;
await this.app.vault.create(notePath, '# My New Note\n\nContent here');
```

That's it! You're now using the Jinxx Tools API.

---

## Common Use Cases

### 1. Create Notes in Course Folders

```typescript
async createCourseNote(courseName: string, noteTitle: string, content: string) {
  const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
  
  if (!jinxxTools?.api) {
    new Notice('Jinxx Tools plugin required');
    return;
  }
  
  const api = jinxxTools.api;
  
  // Check if course exists
  if (!await api.courseExists(courseName)) {
    new Notice(`Course "${courseName}" not found`);
    return;
  }
  
  // Get paths
  const paths = api.getCoursePaths(courseName);
  
  // Create note
  const notePath = `${paths.notesFolder}/${noteTitle}.md`;
  await this.app.vault.create(notePath, content);
  
  new Notice(`Created note in ${courseName}`);
}

// Usage
await this.createCourseNote('Calculus', 'Lecture 5', '# Lecture 5\n\nNotes here');
```

### 2. List All Courses with File Counts

```typescript
async showCourseDashboard() {
  const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
  
  if (!jinxxTools?.api) {
    new Notice('Jinxx Tools plugin required');
    return;
  }
  
  const api = jinxxTools.api;
  
  // Get all courses
  const courses = await api.getCourses();
  
  // Count files for each course
  const allFiles = this.app.vault.getFiles();
  
  for (const course of courses) {
    const paths = api.getCoursePaths(course);
    
    const courseFiles = allFiles.filter(f =>
      f.path.startsWith(paths.notesFolder) ||
      f.path.startsWith(paths.attachmentsFolder) ||
      f.path === paths.courseFile
    );
    
    console.log(`${course}: ${courseFiles.length} files`);
  }
}
```

### 3. Course Selector Modal

```typescript
import { FuzzySuggestModal } from 'obsidian';

class CourseSelector extends FuzzySuggestModal<string> {
  courses: string[];
  onSelect: (course: string) => void;
  
  constructor(app: App, courses: string[], onSelect: (course: string) => void) {
    super(app);
    this.courses = courses;
    this.onSelect = onSelect;
  }
  
  getItems(): string[] {
    return this.courses;
  }
  
  getItemText(course: string): string {
    return course;
  }
  
  onChooseItem(course: string, evt: MouseEvent | KeyboardEvent) {
    this.onSelect(course);
  }
}

// Usage
async selectCourseAndCreate() {
  const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
  
  if (!jinxxTools?.api) {
    new Notice('Jinxx Tools plugin required');
    return;
  }
  
  const api = jinxxTools.api;
  const courses = await api.getCourses();
  
  if (courses.length === 0) {
    new Notice('No courses found');
    return;
  }
  
  // Show course selector
  new CourseSelector(this.app, courses, async (selectedCourse) => {
    const paths = api.getCoursePaths(selectedCourse);
    // Do something with the selected course...
    console.log('Selected:', selectedCourse);
    console.log('Paths:', paths);
  }).open();
}
```

### 4. Automatic Course Detection from Active File

```typescript
async getCurrentCourse(): Promise<string | null> {
  const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
  
  if (!jinxxTools?.api) {
    return null;
  }
  
  const api = jinxxTools.api;
  const activeFile = this.app.workspace.getActiveFile();
  
  if (!activeFile) {
    return null;
  }
  
  // Get all courses
  const courses = await api.getCourses();
  
  // Find which course the active file belongs to
  for (const course of courses) {
    const paths = api.getCoursePaths(course);
    
    if (
      activeFile.path.startsWith(paths.notesFolder) ||
      activeFile.path.startsWith(paths.attachmentsFolder) ||
      activeFile.path === paths.courseFile
    ) {
      return course;
    }
  }
  
  return null;
}

// Usage
const currentCourse = await this.getCurrentCourse();
if (currentCourse) {
  console.log('Current course:', currentCourse);
} else {
  console.log('Not in a course folder');
}
```

---

## Best Practices

### 1. Always Check Availability

```typescript
// ✅ Good
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
if (!jinxxTools?.api) {
  new Notice('Please install Jinxx Tools plugin');
  return;
}

// ❌ Bad
const api = this.app.plugins.plugins['jinxx-tools'].api; // Crashes if not installed
```

### 2. Verify Course Exists Before Operations

```typescript
// ✅ Good
if (await api.courseExists(courseName)) {
  // Safe to proceed
}

// ❌ Bad - assumes course exists
const paths = api.getCoursePaths(courseName); // Returns paths even if course doesn't exist
```

### 3. Use Obsidian's Vault API to Verify Paths

```typescript
// ✅ Good
const paths = api.getCoursePaths(courseName);
const notesFolder = this.app.vault.getAbstractFileByPath(paths.notesFolder);

if (!notesFolder) {
  // Folder doesn't exist, create it or show error
  await this.app.vault.createFolder(paths.notesFolder);
}

// ❌ Bad - assumes folder exists
await this.app.vault.create(`${paths.notesFolder}/note.md`, 'content'); // Might fail
```

### 4. Show User-Friendly Errors

```typescript
// ✅ Good
if (!jinxxTools?.api) {
  new Notice('This feature requires the Jinxx Tools plugin. Please install and enable it.');
  return;
}

// ❌ Bad
if (!jinxxTools?.api) {
  console.error('API not available'); // User doesn't see this
}
```

### 5. Handle Empty Course Lists

```typescript
// ✅ Good
const courses = await api.getCourses();
if (courses.length === 0) {
  new Notice('No courses found. Create a course first.');
  return;
}

// ❌ Bad
const courses = await api.getCourses();
const firstCourse = courses[0]; // Crashes if empty
```

---

## TypeScript Type Definitions

For better type safety in TypeScript projects:

```typescript
interface JinxxToolsPlugin {
  api: {
    getBaseFolders(): {
      universityFolder: string;
      coursesSubfolder: string;
      fullCoursesPath: string;
    };
    getCourses(): Promise<string[]>;
    courseExists(courseName: string): Promise<boolean>;
    getCoursePath(courseName: string): string;
    getCoursePaths(courseName: string): {
      courseFile: string;
      notesFolder: string;
      attachmentsFolder: string;
      scansFolder: string;
    };
    getAllBaseFolders(): {
      Home: string;
      Garden: string;
      University: string;
      Work: string;
      Books: string;
      Templates: string;
    };
    isScanningEnabled(): boolean;
    getScanWatchFolders(): string[];
  };
}

// Usage
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as JinxxToolsPlugin | undefined;

if (jinxxTools?.api) {
  // TypeScript now knows the API structure
  const folders = jinxxTools.api.getBaseFolders(); // Type: { universityFolder: string, ... }
}
```

---

## Error Handling

The API never throws errors - it returns safe defaults:

```typescript
// Empty string for courseName
const path = api.getCoursePath(''); // Returns ""

// Non-existent course
const exists = await api.courseExists('FakeCourse'); // Returns false

// No courses
const courses = await api.getCourses(); // Returns []

// No watch folders
const folders = api.getScanWatchFolders(); // Returns []
```

You don't need try-catch blocks for API calls.

---

## Testing Your Integration

Use the developer console (Ctrl+Shift+I) to test:

```javascript
// Test API availability
const jinxxTools = app.plugins.plugins['jinxx-tools'];
console.log('API available:', !!jinxxTools?.api);

// Test getting courses
jinxxTools.api.getCourses().then(courses => {
  console.log('Courses:', courses);
});

// Test getting paths
const paths = jinxxTools.api.getCoursePaths('YourCourseName');
console.log('Paths:', paths);
```

---

## Complete Plugin Example

Here's a minimal plugin that uses the Jinxx Tools API:

```typescript
import { Plugin, Notice } from 'obsidian';

export default class MyJinxxIntegrationPlugin extends Plugin {
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
    // 1. Check if Jinxx Tools is available
    const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
    
    if (!jinxxTools?.api) {
      new Notice('This feature requires Jinxx Tools plugin');
      return;
    }
    
    const api = jinxxTools.api;
    
    // 2. Get courses
    const courses = await api.getCourses();
    
    if (courses.length === 0) {
      new Notice('No courses found. Create a course first.');
      return;
    }
    
    // 3. Use first course (in real plugin, you'd show a modal)
    const courseName = courses[0];
    
    // 4. Get paths
    const paths = api.getCoursePaths(courseName);
    
    // 5. Create note
    const timestamp = new Date().toISOString().split('T')[0];
    const notePath = `${paths.notesFolder}/Note-${timestamp}.md`;
    
    try {
      await this.app.vault.create(notePath, `# Note ${timestamp}\n\nCreated automatically`);
      new Notice(`Created note in ${courseName}`);
    } catch (error) {
      new Notice(`Failed to create note: ${error.message}`);
    }
  }
}
```

---

## Next Steps

1. **Read the full API documentation**: `docs/API.md`
2. **Try the examples**: Copy and test in developer console
3. **Build your integration**: Start with a simple use case
4. **Share your integration**: Help others by sharing examples

---

## Resources

- **Full API Reference**: [docs/API.md](API.md)
- **Quick Reference Card**: [docs/API_QuickRef.md](API_QuickRef.md)
- **Testing Guide**: [docs/API_Testing.md](API_Testing.md)
- **GitHub Issues**: https://github.com/CodingJinxx/jinxx-tools/issues

---

## Support

Need help? 
- Check the [API documentation](API.md)
- Report issues on [GitHub](https://github.com/CodingJinxx/jinxx-tools/issues)
- Ask in [Discussions](https://github.com/CodingJinxx/jinxx-tools/discussions)

---

**Happy coding!** 🚀
