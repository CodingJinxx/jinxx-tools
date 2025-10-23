# Testing the Jinxx Tools API

This guide shows how to test the Jinxx Tools API from the Obsidian developer console.

## Opening the Developer Console

- **Windows/Linux**: Press `Ctrl+Shift+I`
- **macOS**: Press `Cmd+Option+I`

Or go to **View → Toggle Developer Tools**

## Basic API Access Test

Copy and paste this code into the console:

```javascript
// Test 1: Check if plugin is available
const jinxxTools = app.plugins.plugins['jinxx-tools'];
console.log('Plugin available:', !!jinxxTools);
console.log('API available:', !!jinxxTools?.api);

// Test 2: Get base folders
if (jinxxTools?.api) {
  const folders = jinxxTools.api.getBaseFolders();
  console.log('Base folders:', folders);
  console.log('Full courses path:', folders.fullCoursesPath);
}
```

Expected output:
```
Plugin available: true
API available: true
Base folders: {
  universityFolder: "20_University",
  coursesSubfolder: "Courses",
  fullCoursesPath: "20_University/Courses"
}
Full courses path: 20_University/Courses
```

## Test All API Methods

```javascript
// Comprehensive API test
(async function testJinxxToolsAPI() {
  const jinxxTools = app.plugins.plugins['jinxx-tools'];
  
  if (!jinxxTools) {
    console.error('❌ Jinxx Tools plugin not found');
    return;
  }
  
  if (!jinxxTools.api) {
    console.error('❌ Jinxx Tools API not available');
    return;
  }
  
  const api = jinxxTools.api;
  console.log('✅ API available');
  
  // Test getBaseFolders()
  console.log('\n--- getBaseFolders() ---');
  const folders = api.getBaseFolders();
  console.log('University folder:', folders.universityFolder);
  console.log('Courses subfolder:', folders.coursesSubfolder);
  console.log('Full courses path:', folders.fullCoursesPath);
  
  // Test getAllBaseFolders()
  console.log('\n--- getAllBaseFolders() ---');
  const allFolders = api.getAllBaseFolders();
  console.log('All base folders:', allFolders);
  
  // Test getCourses()
  console.log('\n--- getCourses() ---');
  const courses = await api.getCourses();
  console.log('Courses:', courses);
  console.log('Course count:', courses.length);
  
  if (courses.length > 0) {
    const testCourse = courses[0];
    
    // Test courseExists()
    console.log('\n--- courseExists() ---');
    const exists = await api.courseExists(testCourse);
    console.log(`Course "${testCourse}" exists:`, exists);
    
    // Test with non-existent course
    const notExists = await api.courseExists('NonExistentCourse12345');
    console.log('Non-existent course exists:', notExists);
    
    // Test getCoursePath()
    console.log('\n--- getCoursePath() ---');
    const coursePath = api.getCoursePath(testCourse);
    console.log(`Path for "${testCourse}":`, coursePath);
    
    // Test getCoursePaths()
    console.log('\n--- getCoursePaths() ---');
    const paths = api.getCoursePaths(testCourse);
    console.log('Course file:', paths.courseFile);
    console.log('Notes folder:', paths.notesFolder);
    console.log('Attachments folder:', paths.attachmentsFolder);
    console.log('Scans folder:', paths.scansFolder);
  } else {
    console.log('⚠️  No courses found. Create a course first to test course-specific methods.');
  }
  
  // Test isScanningEnabled()
  console.log('\n--- isScanningEnabled() ---');
  const scanningEnabled = api.isScanningEnabled();
  console.log('Scanning enabled:', scanningEnabled);
  
  // Test getScanWatchFolders()
  console.log('\n--- getScanWatchFolders() ---');
  const watchFolders = api.getScanWatchFolders();
  console.log('Watch folders:', watchFolders);
  console.log('Watch folder count:', watchFolders.length);
  
  console.log('\n✅ All API tests completed');
})();
```

## Test Error Handling

Test that the API handles errors gracefully:

```javascript
// Test with invalid input
(async function testErrorHandling() {
  const api = app.plugins.plugins['jinxx-tools']?.api;
  
  if (!api) {
    console.error('API not available');
    return;
  }
  
  console.log('--- Testing error handling ---');
  
  // Test with empty string
  const empty = await api.courseExists('');
  console.log('courseExists(""):', empty); // Should be false
  
  // Test with null (converted to empty string)
  const path = api.getCoursePath('');
  console.log('getCoursePath(""):', path); // Should be empty string
  
  // Test with undefined
  const paths = api.getCoursePaths('');
  console.log('getCoursePaths("") returns empty object:', 
    paths.courseFile === '' && 
    paths.notesFolder === '' && 
    paths.attachmentsFolder === '' && 
    paths.scansFolder === ''
  );
  
  console.log('✅ Error handling test completed (no crashes)');
})();
```

## Test API from Another Plugin Context

If you're developing a plugin that uses the API, test it like this:

```javascript
// Simulate accessing API from another plugin
(async function testPluginIntegration() {
  // This simulates what another plugin would do
  const jinxxTools = app.plugins.plugins['jinxx-tools'];
  
  if (!jinxxTools) {
    console.error('Jinxx Tools not found. Install and enable it first.');
    return;
  }
  
  if (!jinxxTools.api) {
    console.error('Jinxx Tools API not available. Update to latest version.');
    return;
  }
  
  const api = jinxxTools.api;
  
  // Example: Create a note in the first course's notes folder
  const courses = await api.getCourses();
  
  if (courses.length === 0) {
    console.log('No courses found. Create a course first.');
    return;
  }
  
  const courseName = courses[0];
  const paths = api.getCoursePaths(courseName);
  
  console.log(`Creating test note in ${courseName}...`);
  
  // Check if notes folder exists
  const notesFolder = app.vault.getAbstractFileByPath(paths.notesFolder);
  if (!notesFolder) {
    console.error(`Notes folder doesn't exist: ${paths.notesFolder}`);
    return;
  }
  
  // Create a test note
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const notePath = `${paths.notesFolder}/API-Test-${timestamp}.md`;
  
  try {
    await app.vault.create(notePath, `# API Test Note\n\nCreated at: ${new Date().toLocaleString()}\n\nThis note was created using the Jinxx Tools API.`);
    console.log('✅ Test note created successfully:', notePath);
  } catch (error) {
    console.error('❌ Failed to create note:', error);
  }
})();
```

## Test API Response Types

Verify that the API returns the expected data types:

```javascript
// Type checking test
(async function testAPITypes() {
  const api = app.plugins.plugins['jinxx-tools']?.api;
  
  if (!api) {
    console.error('API not available');
    return;
  }
  
  console.log('--- Testing API return types ---');
  
  // Test getBaseFolders returns object with correct structure
  const folders = api.getBaseFolders();
  console.log('getBaseFolders returns object:', typeof folders === 'object');
  console.log('Has universityFolder:', typeof folders.universityFolder === 'string');
  console.log('Has coursesSubfolder:', typeof folders.coursesSubfolder === 'string');
  console.log('Has fullCoursesPath:', typeof folders.fullCoursesPath === 'string');
  
  // Test getCourses returns array
  const courses = await api.getCourses();
  console.log('getCourses returns array:', Array.isArray(courses));
  console.log('All items are strings:', courses.every(c => typeof c === 'string'));
  
  // Test courseExists returns boolean
  const exists = await api.courseExists('TestCourse');
  console.log('courseExists returns boolean:', typeof exists === 'boolean');
  
  // Test getCoursePath returns string
  const path = api.getCoursePath('TestCourse');
  console.log('getCoursePath returns string:', typeof path === 'string');
  
  // Test getCoursePaths returns object
  const paths = api.getCoursePaths('TestCourse');
  console.log('getCoursePaths returns object:', typeof paths === 'object');
  console.log('All paths are strings:', 
    typeof paths.courseFile === 'string' &&
    typeof paths.notesFolder === 'string' &&
    typeof paths.attachmentsFolder === 'string' &&
    typeof paths.scansFolder === 'string'
  );
  
  // Test getAllBaseFolders returns object
  const allFolders = api.getAllBaseFolders();
  console.log('getAllBaseFolders returns object:', typeof allFolders === 'object');
  console.log('Has all expected folders:', 
    'Home' in allFolders &&
    'Garden' in allFolders &&
    'University' in allFolders &&
    'Work' in allFolders &&
    'Books' in allFolders &&
    'Templates' in allFolders
  );
  
  // Test isScanningEnabled returns boolean
  const scanEnabled = api.isScanningEnabled();
  console.log('isScanningEnabled returns boolean:', typeof scanEnabled === 'boolean');
  
  // Test getScanWatchFolders returns array
  const watchFolders = api.getScanWatchFolders();
  console.log('getScanWatchFolders returns array:', Array.isArray(watchFolders));
  console.log('All items are strings:', watchFolders.every(f => typeof f === 'string'));
  
  console.log('✅ All type checks passed');
})();
```

## Performance Test

Test API performance with repeated calls:

```javascript
// Performance test
(async function testAPIPerformance() {
  const api = app.plugins.plugins['jinxx-tools']?.api;
  
  if (!api) {
    console.error('API not available');
    return;
  }
  
  console.log('--- Testing API performance ---');
  
  // Test synchronous methods
  console.time('getBaseFolders x1000');
  for (let i = 0; i < 1000; i++) {
    api.getBaseFolders();
  }
  console.timeEnd('getBaseFolders x1000');
  
  console.time('getAllBaseFolders x1000');
  for (let i = 0; i < 1000; i++) {
    api.getAllBaseFolders();
  }
  console.timeEnd('getAllBaseFolders x1000');
  
  console.time('getCoursePath x1000');
  for (let i = 0; i < 1000; i++) {
    api.getCoursePath('TestCourse');
  }
  console.timeEnd('getCoursePath x1000');
  
  console.time('getCoursePaths x1000');
  for (let i = 0; i < 1000; i++) {
    api.getCoursePaths('TestCourse');
  }
  console.timeEnd('getCoursePaths x1000');
  
  // Test async methods
  console.time('getCourses x100');
  for (let i = 0; i < 100; i++) {
    await api.getCourses();
  }
  console.timeEnd('getCourses x100');
  
  console.time('courseExists x100');
  for (let i = 0; i < 100; i++) {
    await api.courseExists('TestCourse');
  }
  console.timeEnd('courseExists x100');
  
  console.log('✅ Performance test completed');
})();
```

## Expected Results

### Successful Test Output

```
✅ API available

--- getBaseFolders() ---
University folder: 20_University
Courses subfolder: Courses
Full courses path: 20_University/Courses

--- getAllBaseFolders() ---
All base folders: {Home: "00_Home", Garden: "10_Garden", University: "20_University", Work: "30_Work", Books: "80_Books", Templates: "90_Templates"}

--- getCourses() ---
Courses: ["Calculus", "Physics", "Chemistry"]
Course count: 3

--- courseExists() ---
Course "Calculus" exists: true
Non-existent course exists: false

--- getCoursePath() ---
Path for "Calculus": 20_University/Courses/Calculus

--- getCoursePaths() ---
Course file: 20_University/Courses/Calculus.md
Notes folder: 20_University/Notes/Calculus
Attachments folder: 20_University/Attachments/Calculus
Scans folder: 20_University/Scans/Calculus

--- isScanningEnabled() ---
Scanning enabled: true

--- getScanWatchFolders() ---
Watch folders: ["C:\\Dev\\Scans"]
Watch folder count: 1

✅ All API tests completed
```

## Troubleshooting

### Plugin not found
- Ensure Jinxx Tools is installed and enabled
- Reload Obsidian (Ctrl+R)

### API not available
- Update to the latest version of Jinxx Tools
- Check console for errors during plugin load

### Methods return empty data
- Create at least one course first
- Configure scanner watch folders in settings
- Check that university folder path is correct in settings

## Next Steps

After verifying the API works in the console:

1. Review the full API documentation: `docs/API.md`
2. Implement the API in your plugin code
3. Add proper error handling and user feedback
4. Test with real-world use cases
