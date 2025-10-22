import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type JinxxToolsPlugin from '../../main';
import { LectureOptionEditorModal } from '../ui/LectureOptionEditorModal';
import { SimpleSuggester } from '../ui/SimpleSuggester';
import { CourseTemplateEditorModal } from '../ui/CourseTemplateEditorModal';
import { PromptModal } from '../ui/PromptModal';

export interface LectureSubfolderOption {
  Label: string;
  Folders: Record<string, any>;
}

export interface CourseTemplate {
  Label: string;
  TemplateFile: string;
  NotesSubfolderOption?: string;
}

export interface JinxxToolsSettings {
  BaseFolders: {
    Home: string;
    Garden: string;
    University: string;
    Work: string;
    Books: string;
    Templates: string;
  };
  NotesSubfolderOptions: Record<string, LectureSubfolderOption>;
  Templates: {
    Course: Record<string, CourseTemplate>;
  };
  Scans: {
    WatchFolders: string[];
  };
}

export const DEFAULT_SETTINGS: JinxxToolsSettings = {
  BaseFolders: {
    Home: '00_Home',
    Garden: '10_Garden',
    University: '20_University',
    Work: '30_Work',
    Books: '80_Books',
    Templates: '90_Templates',
  },
  NotesSubfolderOptions: {
    Default: {
      Label: 'None',
      Folders: {},
    },
    LectureAndExercises: {
      Label: 'Subfolders for Lectures and Exercises',
      Folders: {
        Lecture: {},
        Exercises: {},
      },
    },
  },
  Templates: {
    Course: {
      Default: {
        Label: 'Default Course Template',
        TemplateFile: 'default_coursetemplate.md',
      },
      LectureAndExercises: {
        Label: 'Course with Lectures and Exercises',
        TemplateFile: 'default_coursetemplate.md',
        NotesSubfolderOption: 'LectureAndExercises',
      },
    },
  },
  Scans: {
    WatchFolders: [],
  },
};

export class JinxxToolsSettingTab extends PluginSettingTab {
  plugin: JinxxToolsPlugin;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(app: App, plugin: JinxxToolsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private debounce(key: string, callback: () => void, delay: number = 500) {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(callback, delay);
    this.debounceTimers.set(key, timer);
  }

  private countFolders(folders: Record<string, any>): number {
    let count = 0;
    const countRecursive = (obj: Record<string, any>) => {
      for (const key of Object.keys(obj)) {
        count++;
        if (obj[key] && typeof obj[key] === 'object') {
          countRecursive(obj[key]);
        }
      }
    };
    countRecursive(folders);
    return count;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Jinxx Tools Settings' });



    // Base Folders Section
    containerEl.createEl('h3', { text: 'Base Folders' });
    containerEl.createEl('p', {
      text: 'Configure the root folders for each category.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Home Folder')
      .setDesc('Path to the Home folder')
      .addText((text) =>
        text
          .setPlaceholder('00_Home')
          .setValue(this.plugin.settings.BaseFolders.Home)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.Home = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Garden Folder')
      .setDesc('Path to the Garden folder')
      .addText((text) =>
        text
          .setPlaceholder('10_Garden')
          .setValue(this.plugin.settings.BaseFolders.Garden)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.Garden = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('University Folder')
      .setDesc('Path to the University folder (used for course management)')
      .addText((text) =>
        text
          .setPlaceholder('20_University')
          .setValue(this.plugin.settings.BaseFolders.University)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.University = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Work Folder')
      .setDesc('Path to the Work folder')
      .addText((text) =>
        text
          .setPlaceholder('30_Work')
          .setValue(this.plugin.settings.BaseFolders.Work)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.Work = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Books Folder')
      .setDesc('Path to the Books folder')
      .addText((text) =>
        text
          .setPlaceholder('80_Books')
          .setValue(this.plugin.settings.BaseFolders.Books)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.Books = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Templates Folder')
      .setDesc('Path to the Templates folder')
      .addText((text) =>
        text
          .setPlaceholder('90_Templates')
          .setValue(this.plugin.settings.BaseFolders.Templates)
          .onChange(async (value) => {
            this.plugin.settings.BaseFolders.Templates = value;
            await this.plugin.saveSettings();
          })
      );

    // Notes Subfolder Options
    containerEl.createEl('h3', { text: 'Notes Subfolder Options' });
    containerEl.createEl('p', {
      text: 'Define subfolder structures for course notes.',
      cls: 'setting-item-description',
    });

    const lectureOptsDiv = containerEl.createDiv({ cls: 'jinxx-lecture-options' });
    const lectureKeys = Object.keys(this.plugin.settings.NotesSubfolderOptions);
    for (const key of lectureKeys) {
      const opt = this.plugin.settings.NotesSubfolderOptions[key];
      
      const setting = new Setting(lectureOptsDiv)
        .setName(opt.Label || key)
        .setDesc(`${this.countFolders(opt.Folders)} folders configured`);

      setting.addButton((btn) =>
        btn
          .setIcon('pencil')
          .setTooltip('Edit this lecture option')
          .onClick(() => {
            const modal = new LectureOptionEditorModal(
              this.app,
              key,
              opt,
              async (newKey, newOption) => {
                // If key changed, delete old and create new
                if (newKey !== key) {
                  delete this.plugin.settings.NotesSubfolderOptions[key];
                }
                this.plugin.settings.NotesSubfolderOptions[newKey] = newOption;
                await this.plugin.saveSettings();
                this.display();
              },
              async () => {
                delete this.plugin.settings.NotesSubfolderOptions[key];
                await this.plugin.saveSettings();
                this.display();
              }
            );
            modal.open();
          })
      );
    }

    new Setting(lectureOptsDiv)
      .setName('Add New Notes Option')
      .setDesc('Create a new notes subfolder layout')
      .addButton((btn) =>
        btn.setButtonText('Add').onClick(async () => {
          const key = `Option${Object.keys(this.plugin.settings.NotesSubfolderOptions).length + 1}`;
          this.plugin.settings.NotesSubfolderOptions[key] = {
            Label: `New Option ${Object.keys(this.plugin.settings.NotesSubfolderOptions).length + 1}`,
            Folders: {},
          };
          await this.plugin.saveSettings();
          this.display();
        })
      );

    // Course Templates
    containerEl.createEl('h3', { text: 'Course Templates' });
    containerEl.createEl('p', {
      text: 'Manage course templates.',
      cls: 'setting-item-description',
    });

    const templatesDiv = containerEl.createDiv({ cls: 'jinxx-course-templates' });
    const templateKeys = Object.keys(this.plugin.settings.Templates.Course);
    for (const key of templateKeys) {
      const tmpl = this.plugin.settings.Templates.Course[key];
      
      // Get the label of the selected Notes Subfolder Option
      const notesOptLabel = tmpl.NotesSubfolderOption 
        ? (this.plugin.settings.NotesSubfolderOptions[tmpl.NotesSubfolderOption]?.Label || tmpl.NotesSubfolderOption)
        : '(None)';
      
      const setting = new Setting(templatesDiv)
        .setName(tmpl.Label || key)
        .setDesc(`File: ${tmpl.TemplateFile || '(none)'} | Notes Layout: ${notesOptLabel}`);

      setting.addButton((btn) =>
        btn
          .setIcon('pencil')
          .setTooltip('Edit this course template')
          .onClick(() => {
            const modal = new CourseTemplateEditorModal(
              this.app,
              this.plugin,
              key,
              tmpl,
              async (newKey, newTemplate) => {
                // If key changed, delete old and create new
                if (newKey !== key) {
                  delete this.plugin.settings.Templates.Course[key];
                }
                this.plugin.settings.Templates.Course[newKey] = newTemplate;
                await this.plugin.saveSettings();
                this.display();
              },
              async () => {
                delete this.plugin.settings.Templates.Course[key];
                await this.plugin.saveSettings();
                this.display();
              }
            );
            modal.open();
          })
      );
    }

    new Setting(templatesDiv)
      .setName('Add New Template')
      .setDesc('Create a new course template')
      .addButton((btn) =>
        btn.setButtonText('Add').onClick(async () => {
          const key = `Template${Object.keys(this.plugin.settings.Templates.Course).length + 1}`;
          this.plugin.settings.Templates.Course[key] = {
            Label: `New Template ${Object.keys(this.plugin.settings.Templates.Course).length + 1}`,
            TemplateFile: '',
          };
          await this.plugin.saveSettings();
          this.display();
        })
      );

    // Scans Watch Folders
    containerEl.createEl('h3', { text: 'Scans' });
    containerEl.createEl('p', {
      text: 'Manage folders to watch for scanning.',
      cls: 'setting-item-description',
    });

    const scansDiv = containerEl.createDiv({ cls: 'jinxx-scans' });
    const watchFolders = this.plugin.settings.Scans.WatchFolders;
    
    if (watchFolders.length === 0) {
      new Setting(scansDiv)
        .setName('No watch folders configured')
        .setDesc('Add folders to watch for scans');
    } else {
      for (let i = 0; i < watchFolders.length; i++) {
        const folder = watchFolders[i];
        const setting = new Setting(scansDiv)
          .setName(folder)
          .setDesc(`Watch folder ${i + 1}`);

        setting.addButton((btn) =>
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.Scans.WatchFolders.splice(i, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );
      }
    }

    new Setting(scansDiv)
      .setName('Add Watch Folder')
      .setDesc('Add a new folder to watch for scans')
      .addButton((btn) =>
        btn.setButtonText('Add').onClick(async () => {
          const modal = new PromptModal(this.app, 'Enter folder path to watch');
          const folderPath = await modal.openPrompt();
          if (folderPath) {
            this.plugin.settings.Scans.WatchFolders.push(folderPath);
            await this.plugin.saveSettings();
            this.display();
          }
        })
      );

    // Reset to defaults
    containerEl.createEl('h3', { text: 'Reset' });
    new Setting(containerEl)
      .setName('Reset to Defaults')
      .setDesc('Restore all settings to their default values.')
      .addButton((btn) =>
        btn
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
              this.plugin.settings = { ...DEFAULT_SETTINGS };
              await this.plugin.saveSettings();
              this.display();
              new Notice('Settings reset to defaults');
            }
          })
      );
  }
}
