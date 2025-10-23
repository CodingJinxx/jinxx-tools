import { App } from 'obsidian';
import { JinxxToolsAPI } from './PublicAPI';
import { ConfigService } from '../services/ConfigService';
import { CourseService } from '../services/CourseService';
import type { Plugin } from 'obsidian';

/**
 * Implementation of the Jinxx Tools public API.
 * 
 * @internal
 */
export class JinxxToolsAPIImpl implements JinxxToolsAPI {
  private app: App;
  private configService: ConfigService;
  private courseService: CourseService;

  constructor(
    app: App,
    configService: ConfigService,
    courseService: CourseService
  ) {
    this.app = app;
    this.configService = configService;
    this.courseService = courseService;
  }

  getBaseFolders(): {
    universityFolder: string;
    coursesSubfolder: string;
    fullCoursesPath: string;
  } {
    try {
      // Read config synchronously by accessing the plugin settings directly
      const plugin = this.configService.plugin as unknown as {
        settings?: {
          BaseFolders?: {
            Home?: string;
            Garden?: string;
            University?: string;
            Work?: string;
            Books?: string;
            Templates?: string;
          };
        };
      };
      const baseFolders = plugin.settings?.BaseFolders || {};
      const universityFolder = baseFolders.University || '20_University';
      const coursesSubfolder = 'Courses';
      const fullCoursesPath = `${universityFolder}/${coursesSubfolder}`;

      return {
        universityFolder,
        coursesSubfolder,
        fullCoursesPath
      };
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get base folders', error);
      // Return safe defaults
      return {
        universityFolder: '20_University',
        coursesSubfolder: 'Courses',
        fullCoursesPath: '20_University/Courses'
      };
    }
  }

  async getCourses(): Promise<string[]> {
    try {
      const courses = await this.courseService.discoverCourses();
      // Return a copy to prevent external modification
      return [...courses];
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get courses', error);
      return [];
    }
  }

  async courseExists(courseName: string): Promise<boolean> {
    if (!courseName) {
      return false;
    }

    try {
      const courses = await this.courseService.discoverCourses();
      return courses.includes(courseName);
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to check course existence', error);
      return false;
    }
  }

  getCoursePath(courseName: string): string {
    if (!courseName) {
      return '';
    }

    try {
      const { fullCoursesPath } = this.getBaseFolders();
      return `${fullCoursesPath}/${courseName}`;
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get course path', error);
      return '';
    }
  }

  getCoursePaths(courseName: string): {
    courseFile: string;
    notesFolder: string;
    attachmentsFolder: string;
    scansFolder: string;
  } {
    if (!courseName) {
      return {
        courseFile: '',
        notesFolder: '',
        attachmentsFolder: '',
        scansFolder: ''
      };
    }

    try {
      const { universityFolder } = this.getBaseFolders();

      return {
        courseFile: `${universityFolder}/Courses/${courseName}.md`,
        notesFolder: `${universityFolder}/Notes/${courseName}`,
        attachmentsFolder: `${universityFolder}/Attachments/${courseName}`,
        scansFolder: `${universityFolder}/Scans/${courseName}`
      };
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get course paths', error);
      return {
        courseFile: '',
        notesFolder: '',
        attachmentsFolder: '',
        scansFolder: ''
      };
    }
  }

  getAllBaseFolders(): {
    Home: string;
    Garden: string;
    University: string;
    Work: string;
    Books: string;
    Templates: string;
  } {
    try {
      const plugin = this.configService.plugin as unknown as {
        settings?: {
          BaseFolders?: {
            Home?: string;
            Garden?: string;
            University?: string;
            Work?: string;
            Books?: string;
            Templates?: string;
          };
        };
      };

      const baseFolders = plugin.settings?.BaseFolders || {};

      // Return a copy with defaults
      return {
        Home: baseFolders.Home || '00_Home',
        Garden: baseFolders.Garden || '10_Garden',
        University: baseFolders.University || '20_University',
        Work: baseFolders.Work || '30_Work',
        Books: baseFolders.Books || '80_Books',
        Templates: baseFolders.Templates || '90_Templates'
      };
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get all base folders', error);
      // Return safe defaults
      return {
        Home: '00_Home',
        Garden: '10_Garden',
        University: '20_University',
        Work: '30_Work',
        Books: '80_Books',
        Templates: '90_Templates'
      };
    }
  }

  isScanningEnabled(): boolean {
    try {
      const plugin = this.configService.plugin as unknown as {
        settings?: {
          Scans?: {
            WatchFolders?: string[];
          };
        };
      };

      const watchFolders = plugin.settings?.Scans?.WatchFolders || [];
      return watchFolders.length > 0;
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to check scanning status', error);
      return false;
    }
  }

  getScanWatchFolders(): string[] {
    try {
      const plugin = this.configService.plugin as unknown as {
        settings?: {
          Scans?: {
            WatchFolders?: string[];
          };
        };
      };

      const watchFolders = plugin.settings?.Scans?.WatchFolders || [];
      // Return a copy to prevent external modification
      return [...watchFolders];
    } catch (error) {
      console.error('JinxxToolsAPI: Failed to get scan watch folders', error);
      return [];
    }
  }
}
