/**
 * Public API for the Jinxx Tools plugin.
 * 
 * Other plugins can access this API via:
 * 
 * @example
 * ```typescript
 * const jinxxTools = app.plugins.plugins['jinxx-tools'];
 * if (jinxxTools?.api) {
 *   const config = jinxxTools.api.getBaseFolders();
 *   console.log('Courses path:', config.fullCoursesPath);
 * }
 * ```
 * 
 * @remarks
 * This API provides read-only access to Jinxx Tools configuration and course data.
 * All methods are safe to call and will not modify any data.
 * 
 * @public
 */
export interface JinxxToolsAPI {
  /**
   * Get the base folder configuration.
   * 
   * @returns Object containing university folder path and courses subfolder
   * 
   * @example
   * ```typescript
   * const folders = api.getBaseFolders();
   * console.log(folders.universityFolder); // "20_University"
   * console.log(folders.coursesSubfolder); // "Courses"
   * console.log(folders.fullCoursesPath); // "20_University/Courses"
   * ```
   */
  getBaseFolders(): {
    universityFolder: string;
    coursesSubfolder: string;
    fullCoursesPath: string;
  };

  /**
   * Get a list of all course names in the courses folder.
   * 
   * @returns Promise resolving to an array of course folder names
   * 
   * @example
   * ```typescript
   * const courses = await api.getCourses();
   * console.log(courses); // ["Calculus", "Physics", "Chemistry"]
   * ```
   */
  getCourses(): Promise<string[]>;

  /**
   * Check if a specific course exists.
   * 
   * @param courseName - The name of the course to check
   * @returns Promise resolving to true if the course folder exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = await api.courseExists("Calculus");
   * if (exists) {
   *   console.log("Calculus course exists!");
   * }
   * ```
   */
  courseExists(courseName: string): Promise<boolean>;

  /**
   * Get the full path to a course folder.
   * 
   * @param courseName - The name of the course
   * @returns The complete path to the course folder (e.g., "20_University/Courses/Calculus")
   * 
   * @remarks
   * This method returns the expected path even if the course doesn't exist.
   * Use {@link courseExists} to verify existence.
   * 
   * @example
   * ```typescript
   * const path = api.getCoursePath("Calculus");
   * console.log(path); // "20_University/Courses/Calculus"
   * ```
   */
  getCoursePath(courseName: string): string;

  /**
   * Get the full paths to all course-related folders.
   * 
   * @param courseName - The name of the course
   * @returns Object containing paths to course file, notes, attachments, and scans folders
   * 
   * @example
   * ```typescript
   * const paths = api.getCoursePaths("Calculus");
   * console.log(paths.courseFile);        // "20_University/Courses/Calculus.md"
   * console.log(paths.notesFolder);       // "20_University/Notes/Calculus"
   * console.log(paths.attachmentsFolder); // "20_University/Attachments/Calculus"
   * console.log(paths.scansFolder);       // "20_University/Scans/Calculus"
   * ```
   */
  getCoursePaths(courseName: string): {
    courseFile: string;
    notesFolder: string;
    attachmentsFolder: string;
    scansFolder: string;
  };

  /**
   * Get all base folders configured in the plugin.
   * 
   * @returns Object containing all base folder paths
   * 
   * @example
   * ```typescript
   * const allFolders = api.getAllBaseFolders();
   * console.log(allFolders.Home);       // "00_Home"
   * console.log(allFolders.University); // "20_University"
   * console.log(allFolders.Templates);  // "90_Templates"
   * ```
   */
  getAllBaseFolders(): {
    Home: string;
    Garden: string;
    University: string;
    Work: string;
    Books: string;
    Templates: string;
  };

  /**
   * Check if the scanning feature is configured and available.
   * 
   * @returns True if at least one watch folder is configured
   * 
   * @example
   * ```typescript
   * if (api.isScanningEnabled()) {
   *   console.log("Scanning is available");
   * }
   * ```
   */
  isScanningEnabled(): boolean;

  /**
   * Get the list of configured scanner watch folders.
   * 
   * @returns Array of file system paths being monitored for scans
   * 
   * @example
   * ```typescript
   * const watchFolders = api.getScanWatchFolders();
   * console.log(watchFolders); // ["C:\\Dev\\Scans"]
   * ```
   */
  getScanWatchFolders(): string[];
}
