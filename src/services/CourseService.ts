import { App, TFile, Notice, Plugin } from 'obsidian';
import { ConfigService } from './ConfigService';
import { ensureFolder, deleteFolderRecursively, buildCompactSummary, Summary } from '../utils/file';
import { PromptModal } from '../ui/PromptModal';
import { SimpleSuggester } from '../ui/SimpleSuggester';
import { YesNoModal } from '../ui/YesNoModal';

export interface CourseEntry {
  name: string;
  path: string;
  file: TFile;
}

export class CourseService {
  app: App;
  plugin: Plugin;
  cfg: ConfigService;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.app = (plugin as any).app as App;
    this.cfg = new ConfigService(plugin);
  }

  async listCourses(): Promise<CourseEntry[]> {
    const config = await this.cfg.readConfig();
    const universityFolder = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';
    const coursesFolderPath = `${universityFolder}/Courses`;
    const files = this.app.vault.getFiles().filter((f: any) => f.path.startsWith(coursesFolderPath + '/'));
    const out: CourseEntry[] = files.map((f: any) => ({ name: f.basename, path: f.path, file: f } as CourseEntry));
    return out;
  }

  async discoverCourses(): Promise<string[]> {
    const courses = await this.listCourses();
    return courses.map(c => c.name);
  }

  /**
   * Create a course: prompt for name, create note and attachments/notes/scans folders,
   * create notes subfolders per config NotesSubfolderOptions if user selects.
   */
  async createCourse(): Promise<{ ok: boolean; reason?: string }> {
    const config = await this.cfg.readConfig();
    const universityFolderName = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';

    // Ensure top-level university subfolders exist
    await ensureFolder(this.app, `${universityFolderName}/Courses`);
    await ensureFolder(this.app, `${universityFolderName}/Notes`);
    await ensureFolder(this.app, `${universityFolderName}/Attachments`);
    await ensureFolder(this.app, `${universityFolderName}/Scans`);

    const prompt = new PromptModal(this.app, 'Enter Course Name');
    const courseName = await prompt.openPrompt();
    if (!courseName) return { ok: false, reason: 'empty course name' };

    const courseFilePath = `${universityFolderName}/Courses/${courseName}.md`;
    const courseAttachmentsFolderPath = `${universityFolderName}/Attachments/${courseName}`;
    const courseNotesFolderPath = `${universityFolderName}/Notes/${courseName}`;
    const courseScansFolderPath = `${universityFolderName}/Scans/${courseName}`;

    // check if any of the paths exist
    const existingNote = this.app.vault.getAbstractFileByPath(courseFilePath);
    const existingAttachments = this.app.vault.getAbstractFileByPath(courseAttachmentsFolderPath);
    const existingNotes = this.app.vault.getAbstractFileByPath(courseNotesFolderPath);
    const existingScans = this.app.vault.getAbstractFileByPath(courseScansFolderPath);

    if (existingNote || existingAttachments || existingNotes || existingScans) {
      // If something exists, we should not automatically overwrite — return failure and let UI handle choices
      return { ok: false, reason: 'already-exists' };
    }

    // create note and folders
    try {
      // Build note content from configured templates if available
      let noteContent = `# ${courseName}\n\n*Course note for ${courseName}*`;
      let chosenTemplateKey: string | null = null;
      try {
        const templatesMap = (config && config.Templates && config.Templates.Course) ? config.Templates.Course : null;
        if (templatesMap) {
          const entries = Object.entries(templatesMap) as Array<[string, { Label?: string; TemplateFile?: string; NotesSubfolderOption?: string }]>
          if (entries.length > 0) {
            // Present template choices, showing friendly labels and a "None" option
            const keys = entries.map(e => e[0]);
            const display = entries.map(e => (e[1] && e[1].Label) ? e[1].Label : e[0]);
            const options = ['(None)'].concat(keys);
            const optionLabels = ['Skip templating (create empty note)'].concat(display);
            const sugg = new SimpleSuggester(this.app, options, (k: any) => (optionLabels[options.indexOf(k)] || String(k)), 'Choose course template (or None)');
            const chosen = await sugg.openAndChoose();
            if (chosen && chosen !== '(None)') {
              chosenTemplateKey = String(chosen);
              const tdef = (templatesMap as any)[chosenTemplateKey];
              if (tdef && tdef.TemplateFile) {
                const templatesFolder = (config && config.BaseFolders && config.BaseFolders.Templates) || '90_Templates';
                const templatePath = `${templatesFolder}/${tdef.TemplateFile}`;
                const fileNode = this.app.vault.getAbstractFileByPath(templatePath) as TFile | null;
                if (fileNode) {
                  try {
                    const rawTemplate = await this.app.vault.read(fileNode as TFile);
                    noteContent = rawTemplate;
                  } catch (e) {
                    console.warn('Failed to read template file', templatePath, e);
                    new Notice(`Failed to read template ${tdef.TemplateFile}`);
                  }
                } else {
                  new Notice(`Template file not found: ${templatePath}`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to load course template', e);
      }

      const createdFile = await this.app.vault.create(courseFilePath, noteContent) as TFile;

      // If Templater plugin is installed, attempt to invoke its API to render the template variables (best-effort)
      try {
        // Templater detection: check common plugin keys and look for an API object
        const pluginsAny: any = (this.app as any).plugins || {};
        const pluginCandidates = ['templater-obsidian', 'templater', 'templater-obsidian-plugin'];
        let templaterInstance: any = null;
        if (pluginsAny.plugins) {
          for (const key of pluginCandidates) {
            if (pluginsAny.plugins[key]) { 
              templaterInstance = pluginsAny.plugins[key]; 
              console.log('Found Templater plugin:', key);
              break; 
            }
          }
        }
        if (!templaterInstance && (this.app as any).plugins && (this.app as any).plugins.enabledPlugins) {
          // newer Obsidian plugin store shape: enabledPlugins is a Set
          for (const enabledItem of Array.from((this.app as any).plugins.enabledPlugins || []) as any[]) {
            const enabled = String(enabledItem);
            if (pluginCandidates.includes(enabled)) {
              templaterInstance = (this.app as any).plugins.plugins && (this.app as any).plugins.plugins[enabled];
              if (templaterInstance) {
                console.log('Found Templater plugin (via enabledPlugins):', enabled);
                break;
              }
            }
          }
        }

        if (templaterInstance) {
          console.log('Templater instance found, checking for API...');
          console.log('Templater keys:', Object.keys(templaterInstance));
          
          // Try different API patterns
          if (templaterInstance.templater?.overwrite_file_commands) {
            console.log('Using templater.overwrite_file_commands');
            await templaterInstance.templater.overwrite_file_commands(createdFile);
            new Notice('Templater: template rendered successfully');
          } else if (templaterInstance.templater?.append_template_to_active_file) {
            console.log('Using templater.append_template_to_active_file');
            await templaterInstance.templater.overwrite_active_file_commands();
            new Notice('Templater: template rendered successfully');
          } else if (templaterInstance.api) {
            console.log('Using Templater API');
            const api = templaterInstance.api;
            console.log('API methods:', Object.keys(api));
            
            // Try the different API methods with TFile object instead of path
            if (typeof api.overwrite_file_commands === 'function') {
              console.log('Calling api.overwrite_file_commands with file');
              await api.overwrite_file_commands(createdFile);
              new Notice('Templater: template rendered successfully');
            } else if (typeof api.render === 'function') {
              console.log('Calling api.render');
              await api.render(createdFile);
              new Notice('Templater: template rendered successfully');
            } else if (typeof api.render_file === 'function') {
              console.log('Calling api.render_file');
              await api.render_file(createdFile);
              new Notice('Templater: template rendered successfully');
            } else if (typeof api.run === 'function') {
              console.log('Calling api.run');
              await api.run(createdFile);
              new Notice('Templater: template rendered successfully');
            } else {
              console.warn('No compatible Templater API method found');
              console.log('Available methods:', Object.keys(api));
            }
          } else {
            console.warn('No Templater API found on instance');
          }
        } else {
          console.log('No Templater plugin found');
        }
      } catch (e) {
        console.error('Templater integration error:', e);
        new Notice('Templater: rendering failed (see console for details)');
      }
      await this.app.vault.createFolder(courseAttachmentsFolderPath);
      await this.app.vault.createFolder(courseNotesFolderPath);
      await this.app.vault.createFolder(courseScansFolderPath);

      // Notes subfolders
      try {
        const notesOpts = config.NotesSubfolderOptions || {};
        const keys = Object.keys(notesOpts || {});
        console.log('Notes options keys:', keys);
        let chosenKey: string | null = null;
        
        // Check if the chosen template has a NotesSubfolderOption configured
        if (chosenTemplateKey && config.Templates?.Course?.[chosenTemplateKey]?.NotesSubfolderOption) {
          chosenKey = config.Templates.Course[chosenTemplateKey].NotesSubfolderOption || null;
          console.log('Using template\'s NotesSubfolderOption:', chosenKey);
        } else if (keys.length > 0) {
          // Otherwise, prompt the user to choose
          const display = keys.map(k => (notesOpts[k] && notesOpts[k].Label) ? notesOpts[k].Label : k);
          const options = ['(None)', ...keys];
          const optionLabels = ['No subfolder layout', ...display];
          const sugg = new SimpleSuggester(this.app, options, (k: any) => optionLabels[options.indexOf(k)], 'Choose notes subfolder layout');
          const chosen = await sugg.openAndChoose();
          if (chosen && chosen !== '(None)') {
            chosenKey = chosen;
          }
          console.log('Chosen notes layout:', chosenKey);
        }
        
        if (chosenKey && notesOpts[chosenKey] && notesOpts[chosenKey].Folders) {
          const spec = notesOpts[chosenKey].Folders || {};
          console.log('Creating notes subfolders with spec:', spec);
          // recursively create folders under courseNotesFolderPath
          const createNested = async (basePath: string, specObj: any) => {
            const created: string[] = [];
            for (const name of Object.keys(specObj)) {
              const p = `${basePath}/${name}`;
              console.log('Creating notes subfolder:', p);
              if (!this.app.vault.getAbstractFileByPath(p)) {
                try { await this.app.vault.createFolder(p); created.push(p); } catch (e) { console.error('Failed to create folder:', p, e); }
              }
              const child = await createNested(p, specObj[name]);
              created.push(...child);
            }
            return created;
          };
          await createNested(courseNotesFolderPath, spec);
        } else {
          console.log('No notes subfolder layout chosen or available');
        }
      } catch (e) {
        console.error('Failed to create notes subfolders', e);
      }
      return { ok: true };
    } catch (e) {
      console.error('createCourse failed', e);
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  /**
   * Delete a course by name or params. If params.courseName is provided we'll resolve file/folders,
   * otherwise prompt the user using PromptModal.
   */
  async deleteCourse(params?: any): Promise<{ ok: boolean; reason?: string; summary?: Summary; compact?: string }> {
    try {
      let courseName = params && params.courseName;
      if (!courseName) {
        const prompt = new PromptModal(this.app, 'Course name to delete');
        courseName = await prompt.openPrompt();
      }
      if (!courseName) return { ok: false, reason: 'no-course-name' };

      const config = await this.cfg.readConfig();
      const universityFolderName = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';

      const courseFile = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${courseName}.md`) as TFile | null;
      const courseAttachmentsFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${courseName}`) as any || null;
      const courseNotesFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${courseName}`) as any || null;
      const courseScansFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${courseName}`) as any || null;

      // confirm
      const yesNo = new (require('../ui/YesNoModal').YesNoModal)(this.app, `Are you sure you want to delete '${courseName}'? This cannot be undone.`);
      const confirmed = await yesNo.openPrompt();
      if (!confirmed) return { ok: false, reason: 'cancelled' };

      const summary: Summary = { createdFolders: [], deletedFiles: [], deletedFolders: [], moved: [], failed: [] };

      // delete note
      if (courseFile) {
        try { await this.app.vault.delete(courseFile); summary.deletedFiles!.push(courseFile.path); } catch (e: any) { summary.failed!.push({ path: courseFile.path, error: String(e && e.message ? e.message : e) }); }
      }

      // delete folders recursively
      if (courseAttachmentsFolder) await deleteFolderRecursively(this.app, courseAttachmentsFolder, summary);
      if (courseNotesFolder) await deleteFolderRecursively(this.app, courseNotesFolder, summary);
      if (courseScansFolder) await deleteFolderRecursively(this.app, courseScansFolder, summary);

      const compact = buildCompactSummary(summary);
      return { ok: true, summary, compact };
    } catch (e: any) {
      console.error('deleteCourse failed', e);
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  /**
   * Archive a course: move note and folders into Archive/<course>_<timestamp>
   */
  async archiveCourse(params?: any): Promise<{ ok: boolean; reason?: string; path?: string }> {
    try {
      let courseName = params && params.courseName;
      if (!courseName) {
        const prompt = new PromptModal(this.app, 'Course name to archive');
        courseName = await prompt.openPrompt();
      }
      if (!courseName) return { ok: false, reason: 'no-course-name' };

      const config = await this.cfg.readConfig();
      const universityFolderName = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';

      const courseFile = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${courseName}.md`) as TFile | null;
      const courseAttachmentsFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${courseName}`) as any || null;
      const courseNotesFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${courseName}`) as any || null;
      const courseScansFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${courseName}`) as any || null;

      const yesNo = new (require('../ui/YesNoModal').YesNoModal)(this.app, `Archive '${courseName}'?`);
      const confirmed = await yesNo.openPrompt();
      if (!confirmed) return { ok: false, reason: 'cancelled' };

      function isoTimestampForFilename(d = new Date()) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
      }

      const archiveFolderPath = `${universityFolderName}/Archive/${courseName}_${isoTimestampForFilename()}`;
      await ensureFolder(this.app, archiveFolderPath);
      await ensureFolder(this.app, `${archiveFolderPath}/Courses`);
      await ensureFolder(this.app, `${archiveFolderPath}/Attachments`);
      await ensureFolder(this.app, `${archiveFolderPath}/Notes`);
      await ensureFolder(this.app, `${archiveFolderPath}/Scans`);

      if (courseFile) {
        const newCoursePath = `${archiveFolderPath}/Courses/${courseName}.md`;
        try { await this.app.vault.rename(courseFile, newCoursePath); } catch (e: any) { console.error('Failed to move course file', e); return { ok: false, reason: String(e && e.message ? e.message : e) }; }
      }
      if (courseAttachmentsFolder) {
        const newAttachmentsPath = `${archiveFolderPath}/Attachments/${courseName}`;
        try { await this.app.vault.rename(courseAttachmentsFolder, newAttachmentsPath); } catch (e: any) { console.error('Failed to move attachments folder', e); }
      }
      if (courseNotesFolder) {
        const newNotesPath = `${archiveFolderPath}/Notes/${courseName}`;
        try { await this.app.vault.rename(courseNotesFolder, newNotesPath); } catch (e: any) { console.error('Failed to move notes folder', e); }
      }
      if (courseScansFolder) {
        const newScansPath = `${archiveFolderPath}/Scans/${courseName}`;
        try { await this.app.vault.rename(courseScansFolder, newScansPath); } catch (e: any) { console.error('Failed to move scans folder', e); }
      }

      return { ok: true, path: archiveFolderPath };
    } catch (e: any) {
      console.error('archiveCourse failed', e);
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  /**
   * Rename a course from oldName to newName. Handles destination collisions by offering archive or rename existing.
   */
  async renameCourse(params?: any): Promise<{ ok: boolean; reason?: string; summary?: Summary; compact?: string }> {
    try {
      let oldName = params && params.oldName;
      let newName = params && params.newName;
      if (!oldName) {
        const p = new PromptModal(this.app, 'Current course name');
        oldName = await p.openPrompt();
      }
      if (!oldName) return { ok: false, reason: 'no-old-name' };
      if (!newName) {
        const p2 = new PromptModal(this.app, 'New course name');
        newName = await p2.openPrompt();
      }
      if (!newName) return { ok: false, reason: 'no-new-name' };

      const config = await this.cfg.readConfig();
      const universityFolderName = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';

      // resolve current and dest items
      const courseFile = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${oldName}.md`) as TFile | null;
      const destCourseFile = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${newName}.md`) as TFile | null;
      const courseAttachmentsFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${oldName}`) as any || null;
      const destAttachmentsFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${newName}`) as any || null;
      const courseNotesFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${oldName}`) as any || null;
      const destNotesFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${newName}`) as any || null;
      const courseScansFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${oldName}`) as any || null;
      const destScansFolder = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${newName}`) as any || null;

      const nothingPresent = !courseFile && !courseAttachmentsFolder && !courseNotesFolder && !courseScansFolder;
      if (nothingPresent) return { ok: false, reason: 'no-source' };

      const destExists = !!(destCourseFile || destAttachmentsFolder || destNotesFolder || destScansFolder);
      if (destExists) {
        const opts = ['Abort rename', 'Archive existing', 'Rename existing'];
        const sugg = new SimpleSuggester(this.app, opts, (o: any) => o, `Destination ${newName} exists. Choose action`);
        const pick = await sugg.openAndChoose();
        if (!pick || pick === 'Abort rename') return { ok: false, reason: 'destination-exists' };
        if (pick === 'Archive existing') {
          const archRes = await this.archiveCourse({ courseName: newName });
          if (!archRes || !archRes.ok) return { ok: false, reason: 'archive-failed' };
        } else if (pick === 'Rename existing') {
          // prompt for otherNew
          let otherNew: string | null = null;
          let attempts = 0;
          const destExistsForName = (name: string) => {
            const courseNote = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${name}.md`);
            const attachments = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${name}`);
            const notes = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${name}`);
            const scans = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${name}`);
            return !!(courseNote || attachments || notes || scans);
          };
          while (!otherNew && attempts < 5) {
            const p = new PromptModal(this.app, `New name for existing course '${newName}'`);
            otherNew = await p.openPrompt();
            if (!otherNew) return { ok: false, reason: 'no-other-name' };
            if (otherNew === oldName || otherNew === newName) { otherNew = null; attempts++; continue; }
            if (destExistsForName(otherNew)) { otherNew = null; attempts++; continue; }
            break;
          }
          if (!otherNew) return { ok: false, reason: 'rename-existing-failed' };
          const renameExistingRes = await this.renameCourse({ oldName: newName, newName: otherNew });
          if (!renameExistingRes || !renameExistingRes.ok) return { ok: false, reason: 'rename-existing-failed' };
        }
      }

      const summary: Summary = { createdFolders: [], deletedFiles: [], deletedFolders: [], moved: [], failed: [] };

      const ensureParent = async (p: string) => {
        const parts = p.split('/').slice(0, -1);
        let cur = '';
        for (const part of parts) {
          cur = cur ? `${cur}/${part}` : part;
          if (!this.app.vault.getAbstractFileByPath(cur)) {
            try { await this.app.vault.createFolder(cur); summary.createdFolders!.push(cur); } catch (_) { /* ignore */ }
          }
        }
      };

      if (courseFile) {
        const destPath = `${universityFolderName}/Courses/${newName}.md`;
        await ensureParent(destPath);
        try { await this.app.vault.rename(courseFile, destPath); summary.moved!.push({ from: courseFile.path, to: destPath }); } catch (e: any) { summary.failed!.push({ path: courseFile.path, error: String(e && e.message ? e.message : e), attemptedDest: destPath }); }
      }

      if (courseAttachmentsFolder) {
        const destPath = `${universityFolderName}/Attachments/${newName}`;
        try { await this.app.vault.rename(courseAttachmentsFolder, destPath); summary.moved!.push({ from: courseAttachmentsFolder.path, to: destPath }); } catch (e: any) { summary.failed!.push({ path: courseAttachmentsFolder.path, error: String(e && e.message ? e.message : e), attemptedDest: destPath }); }
      }

      if (courseNotesFolder) {
        const destPath = `${universityFolderName}/Notes/${newName}`;
        try { await this.app.vault.rename(courseNotesFolder, destPath); summary.moved!.push({ from: courseNotesFolder.path, to: destPath }); } catch (e: any) { summary.failed!.push({ path: courseNotesFolder.path, error: String(e && e.message ? e.message : e), attemptedDest: destPath }); }
      }

      if (courseScansFolder) {
        const destPath = `${universityFolderName}/Scans/${newName}`;
        try { await this.app.vault.rename(courseScansFolder, destPath); summary.moved!.push({ from: courseScansFolder.path, to: destPath }); } catch (e: any) { summary.failed!.push({ path: courseScansFolder.path, error: String(e && e.message ? e.message : e), attemptedDest: destPath }); }
      }

      const compact = buildCompactSummary(summary);
      return { ok: true, summary, compact };
    } catch (e: any) {
      console.error('renameCourse failed', e);
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  /**
   * Restore a course from an archive snapshot. Lists snapshots and restores selected snapshot.
   */
  async restoreCourse(params?: any): Promise<{ ok: boolean; reason?: string; snapshot?: string }> {
    try {
      let courseName = params && params.courseName;
      if (!courseName) {
        const p = new PromptModal(this.app, 'Course name to restore');
        courseName = await p.openPrompt();
      }
      if (!courseName) return { ok: false, reason: 'no-course-name' };

      const config = await this.cfg.readConfig();
      const universityFolderName = (config && config.BaseFolders && config.BaseFolders.University) || '20_University';
      const archiveRoot = `${universityFolderName}/Archive`;

      const allFiles = this.app.vault.getFiles();
      const archiveFolders = new Set<string>();
      for (const f of allFiles) {
        if (!f.path.startsWith(`${archiveRoot}/`)) continue;
        const rel = f.path.slice((archiveRoot + '/').length);
        const parts = rel.split('/');
        if (parts.length === 0) continue;
        const snapshotName = parts[0];
        if (snapshotName.startsWith(courseName + '_')) archiveFolders.add(snapshotName);
      }

      const snapshots = Array.from(archiveFolders).sort().reverse();
      if (snapshots.length === 0) return { ok: false, reason: 'no-snapshots' };

      const sugg = new SimpleSuggester(this.app, snapshots, (s: any) => s, `Restore snapshot for ${courseName}`);
      const chosen = await sugg.openAndChoose();
      if (!chosen) return { ok: false, reason: 'cancelled' };

      const snapshotRoot = `${archiveRoot}/${chosen}`;
      const types = ['Courses', 'Attachments', 'Notes', 'Scans'];

      const destExistsForName = (name: string) => {
        const courseNote = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Courses/${name}.md`);
        const attachments = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Attachments/${name}`);
        const notes = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Notes/${name}`);
        const scans = this.app.vault.getAbstractFileByPath(`${universityFolderName}/Scans/${name}`);
        return !!(courseNote || attachments || notes || scans);
      };

      let effectiveName = courseName;
      if (destExistsForName(effectiveName)) {
        const opts = ['Abort restore', 'Rename restore'];
        const pick = await new SimpleSuggester(this.app, opts, (o: any) => o, `Destination for ${effectiveName} exists. Abort or rename?`).openAndChoose();
        if (!pick || pick === 'Abort restore') return { ok: false, reason: 'destination-exists' };
        if (pick === 'Rename restore') {
          let newName: string | null = null;
          let attempts = 0;
          while (!newName && attempts < 5) {
            const p = new PromptModal(this.app, 'Enter new course name for restore');
            newName = await p.openPrompt();
            if (!newName) return { ok: false, reason: 'no-new-name' };
            if (destExistsForName(newName)) { newName = null; attempts++; continue; }
            break;
          }
          if (!newName) return { ok: false, reason: 'rename-failed' };
          effectiveName = newName;
        }
      }

      const summary: Summary = { createdFolders: [], deletedFiles: [], deletedFolders: [], moved: [], failed: [] };

      // Recreate empty folders from snapshot
      for (const t of types) {
        const snapFolderPath = `${snapshotRoot}/${t}`;
        const snapFolder = this.app.vault.getAbstractFileByPath(snapFolderPath) as any;
        if (snapFolder && Array.isArray(snapFolder.children)) {
          const walk = async (folder: any, relPrefix: string) => {
            for (const child of folder.children) {
              if (child && Array.isArray(child.children)) {
                const rel = relPrefix ? `${relPrefix}/${child.name}` : child.name;
                const relParts = rel.split('/');
                if (t === 'Courses') {
                  if (relParts[0] === courseName) relParts.shift();
                } else {
                  if (relParts[0] === courseName) relParts[0] = effectiveName;
                }
                if (relParts.length === 0) { await walk(child, relParts.join('/')); continue; }
                const destFolderPath = `${universityFolderName}/${t}/${relParts.join('/')}`;
                if (!this.app.vault.getAbstractFileByPath(destFolderPath)) {
                  try { await this.app.vault.createFolder(destFolderPath); summary.createdFolders!.push(destFolderPath); } catch (err: any) { summary.failed!.push({ path: destFolderPath, error: String(err && err.message ? err.message : err) }); }
                }
                await walk(child, rel);
              }
            }
          };
          if (t === 'Courses') {
            const topDest = `${universityFolderName}/Courses`;
            if (!this.app.vault.getAbstractFileByPath(topDest)) { try { await this.app.vault.createFolder(topDest); summary.createdFolders!.push(topDest); } catch (err: any) { summary.failed!.push({ path: topDest, error: String(err && err.message ? err.message : err) }); } }
          } else {
            const topDest = `${universityFolderName}/${t}/${effectiveName}`;
            if (!this.app.vault.getAbstractFileByPath(topDest)) { try { await this.app.vault.createFolder(topDest); summary.createdFolders!.push(topDest); } catch (err: any) { summary.failed!.push({ path: topDest, error: String(err && err.message ? err.message : err) }); } }
          }
          await walk(snapFolder, '');
        }
      }

      // Move files
      for (const t of types) {
        const prefix = `${snapshotRoot}/${t}/`;
        const matches = this.app.vault.getFiles().filter((f: any) => f.path.startsWith(prefix));
        for (const m of matches) {
          const rel = m.path.slice(prefix.length);
          const relParts = rel.split('/');
          let dest: string | null = null;
          if (t === 'Courses') {
            if (relParts.length === 1) {
              const fname = relParts[0];
              if (fname.toLowerCase() === `${courseName.toLowerCase()}.md`) dest = `${universityFolderName}/Courses/${effectiveName}.md`;
              else dest = `${universityFolderName}/Courses/${fname}`;
            } else {
              const rest = (relParts[0] === courseName) ? relParts.slice(1).join('/') : relParts.join('/');
              dest = `${universityFolderName}/Courses/${rest}`;
            }
          } else {
            if (relParts[0] === courseName) relParts[0] = effectiveName;
            const destPath = relParts.join('/');
            dest = `${universityFolderName}/${t}/${destPath}`;
          }
          // ensure parent folders
          const parentParts = dest.split('/').slice(0, -1);
          let curPath = '';
          for (const p of parentParts) {
            curPath = curPath ? `${curPath}/${p}` : p;
            if (!this.app.vault.getAbstractFileByPath(curPath)) {
              try { await this.app.vault.createFolder(curPath); } catch (_) { /* ignore */ }
            }
          }
          try { await this.app.vault.rename(m, dest); summary.moved!.push({ from: m.path, to: dest }); } catch (e: any) { summary.failed!.push({ path: m.path, error: String(e && e.message ? e.message : e), attemptedDest: dest }); }
        }
      }

      // Remove snapshot
      try {
        const snapshotFolder = this.app.vault.getAbstractFileByPath(snapshotRoot) as any;
        if (snapshotFolder) {
          try { await deleteFolderRecursively(this.app, snapshotFolder, summary); } catch (err: any) { summary.failed!.push({ path: snapshotRoot, error: String(err && err.message ? err.message : err) }); }
        }
      } catch (e: any) { summary.failed!.push({ path: snapshotRoot, error: String(e && e.message ? e.message : e) }); }

      console.log('restoreCourse summary', summary);
      return { ok: true, snapshot: chosen };
    } catch (e: any) {
      console.error('restoreCourse failed', e);
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }
}

