# Prompt for Agent: Expose Plugin API for External Access

I need you to add a public API to this Obsidian plugin so that other plugins can programmatically access certain configuration values and functionality.

## Context

This is the Jinxx Tools plugin (`jinxx-tools`), which manages academic course folders and scanning features. Other plugins may need to:
- Read the base folders configuration (University folder, Courses folder path, etc.)
- Query available courses
- Check if certain features are enabled

Review the current codebase to understand:
- How settings are structured in SettingTab.ts and ConfigService.ts
- What configuration values exist and which should be exposed
- The plugin's current architecture

## Requirements

### 1. Create a Public API Interface

Create a new file `src/api/PublicAPI.ts` that defines:

```typescript
/**
 * Public API for the Jinxx Tools plugin.
 * Other plugins can access this API via:
 * 
 * const jinxxTools = app.plugins.plugins['jinxx-tools'];
 * if (jinxxTools?.api) {
 *   const config = jinxxTools.api.getBaseFolders();
 * }
 */
export interface JinxxToolsAPI {
  /**
   * Get the base folder configuration
   * @returns Object containing university folder path and courses subfolder
   */
  getBaseFolders(): {
    universityFolder: string;
    coursesSubfolder: string;
    fullCoursesPath: string;
  };

  /**
   * Get a list of all course names in the courses folder
   * @returns Array of course folder names
   */
  getCourses(): Promise<string[]>;

  /**
   * Check if a specific course exists
   * @param courseName - The name of the course to check
   * @returns True if the course folder exists
   */
  courseExists(courseName: string): Promise<boolean>;

  /**
   * Get the full path to a course folder
   * @param courseName - The name of the course
   * @returns The complete path to the course folder
   */
  getCoursePath(courseName: string): string;
}
```

### 2. Implement the API

Create `src/api/APIImpl.ts` that implements the interface:

```typescript
import { JinxxToolsAPI } from './PublicAPI';
import { ConfigService } from '../services/ConfigService';
import { CourseService } from '../services/CourseService';
import { App } from 'obsidian';

export class JinxxToolsAPIImpl implements JinxxToolsAPI {
  constructor(
    private app: App,
    private configService: ConfigService,
    private courseService: CourseService
  ) {}

  getBaseFolders() {
    // Implementation
  }

  async getCourses(): Promise<string[]> {
    // Implementation
  }

  async courseExists(courseName: string): Promise<boolean> {
    // Implementation
  }

  getCoursePath(courseName: string): string {
    // Implementation
  }
}
```

**Implementation Guidelines:**
- Use the existing `ConfigService` to read settings
- Use the existing `CourseService` for course-related operations
- Return copies of data, not references to internal state
- Handle errors gracefully (return empty arrays, empty strings, or false rather than throwing)
- Keep methods synchronous where possible for ease of use

### 3. Expose the API on the Plugin Instance

Modify main.ts to:
1. Import the API types and implementation
2. Add an `api` property to the plugin class
3. Initialize the API in `onload()`
4. Document how external plugins can access it

```typescript
import { JinxxToolsAPI } from './api/PublicAPI';
import { JinxxToolsAPIImpl } from './api/APIImpl';

export default class JinxxToolsPlugin extends Plugin {
  // ...existing code...
  
  /**
   * Public API for external plugins to access Jinxx Tools functionality.
   * 
   * Example usage from another plugin:
   * ```typescript
   * const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
   * if (jinxxTools?.api) {
   *   const folders = jinxxTools.api.getBaseFolders();
   *   console.log('Courses path:', folders.fullCoursesPath);
   * }
   * ```
   */
  public api: JinxxToolsAPI | undefined;

  async onload() {
    // ...existing initialization...
    
    // Initialize public API
    this.api = new JinxxToolsAPIImpl(
      this.app,
      this.configService,
      this.courseService
    );
    
    // ...rest of onload...
  }
}
```

### 4. Add API Documentation

Create `docs/API.md` documenting:

#### Purpose
- What the API is for
- Who should use it
- What guarantees it provides

#### Accessing the API

```typescript
// TypeScript example
const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
if (!jinxxTools) {
  console.error('Jinxx Tools plugin is not installed or enabled');
  return;
}

if (!jinxxTools.api) {
  console.error('Jinxx Tools API is not available');
  return;
}

// Now you can use the API
const config = jinxxTools.api.getBaseFolders();
```

#### API Reference

For each method:
- Function signature
- Parameters with types
- Return value with type
- Description
- Example usage
- Error handling behavior

#### Versioning and Stability

- The API follows semantic versioning
- Breaking changes will only occur in major version bumps
- Deprecation notices will be given at least one minor version in advance

#### Example Use Cases

Provide real-world examples:
1. Plugin that needs to create files in course folders
2. Plugin that wants to display course information
3. Plugin that integrates with the scanning workflow

### 5. Add TypeScript Declaration File

Create `src/api/index.ts` as the main export point:

```typescript
export { JinxxToolsAPI } from './PublicAPI';
export { JinxxToolsAPIImpl } from './APIImpl';
```

Optionally create a `.d.ts` file for external consumers if needed.

### 6. Update README.md

Add a new section "Plugin API" that:
- Briefly mentions the API exists
- Links to `docs/API.md` for full documentation
- Shows a minimal example
- Notes that this is a desktop-only plugin

### 7. Add Tests/Examples

Create an example in `docs/API.md` showing:
- How to check if the plugin is available
- How to safely access the API
- How to handle missing plugin or API
- Common patterns for integration

## What NOT to Do

- **Do NOT expose write operations**: Only read operations should be in the initial API
- **Do NOT expose internal services directly**: Wrap them in the API implementation
- **Do NOT expose settings modification**: Keep the API read-only for now
- **Do NOT break existing functionality**: This should be purely additive

## Testing Checklist

After implementing:
1. Verify the plugin still loads and works normally
2. Test API access from the developer console:
   ```javascript
   const api = app.plugins.plugins['jinxx-tools'].api;
   console.log(api.getBaseFolders());
   api.getCourses().then(courses => console.log(courses));
   ```
3. Test with plugin disabled (should gracefully handle missing API)
4. Test all API methods return expected data types
5. Test API methods with edge cases (no courses, invalid course names, etc.)

## Deliverables

Provide the following files with complete implementations:

1. `src/api/PublicAPI.ts` - Interface definition
2. `src/api/APIImpl.ts` - Implementation
3. `src/api/index.ts` - Export aggregator
4. main.ts - Modified to expose API
5. `docs/API.md` - Complete API documentation
6. README.md - Updated with API section

Use proper TypeScript types throughout. Ensure all code follows the project's existing patterns and conventions. Include JSDoc comments for all public methods.

---

This prompt should guide an agent to properly implement a public API following Obsidian plugin best practices while maintaining the security and integrity of your plugin.