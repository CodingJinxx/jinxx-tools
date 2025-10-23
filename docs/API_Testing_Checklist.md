# API Testing Checklist

Complete checklist for testing the Jinxx Tools public API before release.

## Prerequisites

- [ ] Plugin builds successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Plugin loaded in Obsidian test vault
- [ ] At least one course created for testing
- [ ] Scanner watch folder configured (for scanning tests)

## 1. API Availability Tests

### Basic Access
- [ ] Open developer console (Ctrl+Shift+I)
- [ ] Run: `app.plugins.plugins['jinxx-tools']`
- [ ] Verify: Returns plugin object (not undefined)
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api`
- [ ] Verify: Returns API object (not undefined)

### Type Check
- [ ] Run: `typeof app.plugins.plugins['jinxx-tools'].api`
- [ ] Verify: Returns "object"

## 2. Configuration Methods

### getBaseFolders()
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getBaseFolders()`
- [ ] Verify: Returns object with 3 properties
- [ ] Verify: `universityFolder` is a string
- [ ] Verify: `coursesSubfolder` equals "Courses"
- [ ] Verify: `fullCoursesPath` equals `universityFolder + "/Courses"`
- [ ] Verify: Values match settings configuration

**Expected Result**:
```javascript
{
  universityFolder: "20_University",
  coursesSubfolder: "Courses",
  fullCoursesPath: "20_University/Courses"
}
```

### getAllBaseFolders()
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getAllBaseFolders()`
- [ ] Verify: Returns object with 6 properties
- [ ] Verify: Has `Home`, `Garden`, `University`, `Work`, `Books`, `Templates`
- [ ] Verify: All values are strings
- [ ] Verify: Values match settings configuration

**Expected Result**:
```javascript
{
  Home: "00_Home",
  Garden: "10_Garden",
  University: "20_University",
  Work: "30_Work",
  Books: "80_Books",
  Templates: "90_Templates"
}
```

## 3. Course Query Methods

### getCourses()
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.getCourses()`
- [ ] Verify: Returns array
- [ ] Verify: Array length matches number of courses in vault
- [ ] Verify: All items are strings
- [ ] Verify: Course names match actual course files

**Expected Result** (if you have 3 courses):
```javascript
["Calculus", "Physics", "Chemistry"]
```

### courseExists() - Existing Course
- [ ] Create test course named "TestCourse123"
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.courseExists("TestCourse123")`
- [ ] Verify: Returns `true`

### courseExists() - Non-Existent Course
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.courseExists("NonExistentCourse999")`
- [ ] Verify: Returns `false`

### courseExists() - Empty String
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.courseExists("")`
- [ ] Verify: Returns `false`
- [ ] Verify: No error thrown

### courseExists() - Invalid Input
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.courseExists(null)`
- [ ] Verify: Returns `false`
- [ ] Verify: No error thrown

## 4. Path Methods

### getCoursePath() - Valid Course
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getCoursePath("TestCourse123")`
- [ ] Verify: Returns string
- [ ] Verify: Format is `"<university>/Courses/<courseName>"`
- [ ] Verify: Path matches expected location

**Expected Result**:
```javascript
"20_University/Courses/TestCourse123"
```

### getCoursePath() - Empty String
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getCoursePath("")`
- [ ] Verify: Returns empty string `""`
- [ ] Verify: No error thrown

### getCoursePaths() - Valid Course
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getCoursePaths("TestCourse123")`
- [ ] Verify: Returns object with 4 properties
- [ ] Verify: Has `courseFile`, `notesFolder`, `attachmentsFolder`, `scansFolder`
- [ ] Verify: All values are strings
- [ ] Verify: Paths follow expected format

**Expected Result**:
```javascript
{
  courseFile: "20_University/Courses/TestCourse123.md",
  notesFolder: "20_University/Notes/TestCourse123",
  attachmentsFolder: "20_University/Attachments/TestCourse123",
  scansFolder: "20_University/Scans/TestCourse123"
}
```

### getCoursePaths() - Empty String
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getCoursePaths("")`
- [ ] Verify: Returns object with all empty strings
- [ ] Verify: No error thrown

## 5. Scanning Methods

### isScanningEnabled() - With Watch Folders
- [ ] Ensure at least one watch folder is configured in settings
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.isScanningEnabled()`
- [ ] Verify: Returns `true`

### isScanningEnabled() - Without Watch Folders
- [ ] Remove all watch folders in settings (temporarily)
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.isScanningEnabled()`
- [ ] Verify: Returns `false`
- [ ] Restore watch folders

### getScanWatchFolders() - With Configured Folders
- [ ] Ensure at least one watch folder is configured
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getScanWatchFolders()`
- [ ] Verify: Returns array
- [ ] Verify: Array length matches configured folders
- [ ] Verify: All items are strings
- [ ] Verify: Paths match settings

**Expected Result**:
```javascript
["C:\\Dev\\Scans"]
```

### getScanWatchFolders() - Without Configured Folders
- [ ] Remove all watch folders in settings (temporarily)
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getScanWatchFolders()`
- [ ] Verify: Returns empty array `[]`
- [ ] Restore watch folders

## 6. Integration Tests

### Create File in Course Notes Folder
- [ ] Run the following in console:
  ```javascript
  (async () => {
    const api = app.plugins.plugins['jinxx-tools'].api;
    const paths = api.getCoursePaths('TestCourse123');
    const notePath = `${paths.notesFolder}/API-Test-Note.md`;
    await app.vault.create(notePath, '# API Test\n\nThis was created via the API.');
    console.log('Created:', notePath);
  })();
  ```
- [ ] Verify: File created successfully
- [ ] Verify: File appears in correct location
- [ ] Verify: File has correct content
- [ ] Clean up: Delete test file

### List All Course Files
- [ ] Run the following in console:
  ```javascript
  (async () => {
    const api = app.plugins.plugins['jinxx-tools'].api;
    const courses = await api.getCourses();
    console.log('Courses:', courses.length);
    for (const course of courses) {
      const paths = api.getCoursePaths(course);
      const allFiles = app.vault.getFiles();
      const courseFiles = allFiles.filter(f => 
        f.path.startsWith(paths.notesFolder) ||
        f.path.startsWith(paths.attachmentsFolder) ||
        f.path === paths.courseFile
      );
      console.log(`${course}: ${courseFiles.length} files`);
    }
  })();
  ```
- [ ] Verify: Lists all courses
- [ ] Verify: File counts are reasonable
- [ ] Verify: No errors in console

### Check Before Create Pattern
- [ ] Run the following in console:
  ```javascript
  (async () => {
    const api = app.plugins.plugins['jinxx-tools'].api;
    const courseName = 'TestCourse123';
    
    if (await api.courseExists(courseName)) {
      console.log('✅ Course exists');
      const paths = api.getCoursePaths(courseName);
      console.log('Notes folder:', paths.notesFolder);
    } else {
      console.log('❌ Course does not exist');
    }
  })();
  ```
- [ ] Verify: Correctly identifies course existence
- [ ] Verify: Returns correct paths

## 7. Error Handling Tests

### API Not Available (Plugin Disabled)
- [ ] Disable Jinxx Tools plugin in settings
- [ ] Run: `app.plugins.plugins['jinxx-tools']?.api`
- [ ] Verify: Returns `undefined`
- [ ] Re-enable plugin

### Invalid Course Name
- [ ] Run: `await app.plugins.plugins['jinxx-tools'].api.courseExists("Invalid/Course:Name")`
- [ ] Verify: Returns `false`
- [ ] Verify: No errors in console

### Null/Undefined Input
- [ ] Run: `app.plugins.plugins['jinxx-tools'].api.getCoursePath(undefined)`
- [ ] Verify: Returns empty string
- [ ] Verify: No errors thrown
- [ ] Check console for logged errors

## 8. Performance Tests

### Repeated Synchronous Calls
- [ ] Run the following in console:
  ```javascript
  console.time('getBaseFolders x1000');
  for (let i = 0; i < 1000; i++) {
    app.plugins.plugins['jinxx-tools'].api.getBaseFolders();
  }
  console.timeEnd('getBaseFolders x1000');
  ```
- [ ] Verify: Completes in under 100ms
- [ ] Verify: No memory leaks

### Repeated Async Calls
- [ ] Run the following in console:
  ```javascript
  (async () => {
    console.time('getCourses x100');
    for (let i = 0; i < 100; i++) {
      await app.plugins.plugins['jinxx-tools'].api.getCourses();
    }
    console.timeEnd('getCourses x100');
  })();
  ```
- [ ] Verify: Completes in under 1 second
- [ ] Verify: No memory leaks

## 9. Data Isolation Tests

### Modifying Returned Array
- [ ] Run the following in console:
  ```javascript
  (async () => {
    const api = app.plugins.plugins['jinxx-tools'].api;
    const courses1 = await api.getCourses();
    courses1.push('FAKE_COURSE');
    const courses2 = await api.getCourses();
    console.log('Modified array:', courses1);
    console.log('Fresh array:', courses2);
    console.log('Contains fake course:', courses2.includes('FAKE_COURSE'));
  })();
  ```
- [ ] Verify: Second call does not contain 'FAKE_COURSE'
- [ ] Verify: API returns independent copies

### Modifying Returned Object
- [ ] Run the following in console:
  ```javascript
  const api = app.plugins.plugins['jinxx-tools'].api;
  const folders1 = api.getBaseFolders();
  folders1.universityFolder = 'FAKE_FOLDER';
  const folders2 = api.getBaseFolders();
  console.log('Modified object:', folders1);
  console.log('Fresh object:', folders2);
  console.log('Contains fake folder:', folders2.universityFolder === 'FAKE_FOLDER');
  ```
- [ ] Verify: Second call does not contain 'FAKE_FOLDER'
- [ ] Verify: API returns independent copies

## 10. Type Safety Tests

### TypeScript Return Types
- [ ] Run the following in console:
  ```javascript
  const api = app.plugins.plugins['jinxx-tools'].api;
  
  console.log('getBaseFolders returns object:', typeof api.getBaseFolders() === 'object');
  console.log('getCourses returns Promise:', api.getCourses() instanceof Promise);
  console.log('courseExists returns Promise:', api.courseExists('test') instanceof Promise);
  console.log('getCoursePath returns string:', typeof api.getCoursePath('test') === 'string');
  console.log('getCoursePaths returns object:', typeof api.getCoursePaths('test') === 'object');
  console.log('getAllBaseFolders returns object:', typeof api.getAllBaseFolders() === 'object');
  console.log('isScanningEnabled returns boolean:', typeof api.isScanningEnabled() === 'boolean');
  console.log('getScanWatchFolders returns Array:', Array.isArray(api.getScanWatchFolders()));
  ```
- [ ] Verify: All type checks pass

## 11. Documentation Tests

### README.md
- [ ] Open `README.md`
- [ ] Verify: "Plugin API" section exists
- [ ] Verify: Quick example is present
- [ ] Verify: Links to `docs/API.md`

### docs/API.md
- [ ] Open `docs/API.md`
- [ ] Verify: All 8 methods documented
- [ ] Verify: Examples for each method
- [ ] Verify: Complete usage example
- [ ] Verify: Use cases section
- [ ] Verify: Troubleshooting section

### docs/API_Testing.md
- [ ] Open `docs/API_Testing.md`
- [ ] Verify: Test scripts are present
- [ ] Verify: Instructions are clear
- [ ] Copy a test script and run in console
- [ ] Verify: Script works as documented

### docs/API_QuickRef.md
- [ ] Open `docs/API_QuickRef.md`
- [ ] Verify: All methods listed
- [ ] Verify: Common patterns section
- [ ] Verify: Quick examples are accurate

## 12. Real-World Scenario Tests

### Scenario 1: Another Plugin Creates Notes
- [ ] Simulate another plugin creating a note in course folder
- [ ] Use API to get course paths
- [ ] Create note using Obsidian vault API
- [ ] Verify: Note appears in correct location

### Scenario 2: Display Course Dashboard
- [ ] Use API to get all courses
- [ ] For each course, get paths
- [ ] Count files in each folder
- [ ] Display summary
- [ ] Verify: Information is accurate

### Scenario 3: Scanning Integration
- [ ] Use API to check if scanning is enabled
- [ ] Get scan watch folders
- [ ] Get scan folder for a specific course
- [ ] Verify: All information matches settings

## Sign-Off

### Developer Sign-Off
- [ ] All tests pass
- [ ] No errors in console
- [ ] Documentation is complete
- [ ] Code follows project conventions

**Tested By**: _________________  
**Date**: _________________  
**Version**: _________________

### Notes

(Add any issues, observations, or recommendations here)

---

## Test Results Summary

### Passed: ____ / ____
### Failed: ____ / ____
### Skipped: ____ / ____

**Overall Status**: ☐ PASS | ☐ FAIL | ☐ PARTIAL

**Ready for Release**: ☐ YES | ☐ NO | ☐ WITH FIXES
