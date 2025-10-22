import { App } from 'obsidian';
import { SimpleSuggester } from './SimpleSuggester';
import { PromptModal } from './PromptModal';
import type { CourseTemplate } from '../settings/SettingTab';
import type JinxxToolsPlugin from '../../main';

export class CourseTemplateEditorModal {
  private app: App;
  private plugin: JinxxToolsPlugin;
  private key: string;
  private template: CourseTemplate;
  private onSave: (newKey: string, newTemplate: CourseTemplate) => Promise<void>;
  private onDelete: () => Promise<void>;

  constructor(
    app: App,
    plugin: JinxxToolsPlugin,
    key: string,
    template: CourseTemplate,
    onSave: (newKey: string, newTemplate: CourseTemplate) => Promise<void>,
    onDelete: () => Promise<void>
  ) {
    this.app = app;
    this.plugin = plugin;
    this.key = key;
    this.template = { ...template };
    this.onSave = onSave;
    this.onDelete = onDelete;
  }

  async open() {
    await this.showMainMenu();
  }

  private async showMainMenu() {
    const notesOptLabel = this.template.NotesSubfolderOption
      ? (this.plugin.settings.NotesSubfolderOptions[this.template.NotesSubfolderOption]?.Label || this.template.NotesSubfolderOption)
      : '(None)';

    const options = [
      'rename',
      'change-label',
      'select-template-file',
      'select-notes-layout',
      'delete',
      'save',
    ];

    const labels = [
      `Rename Key: ${this.key}`,
      `Change Label: ${this.template.Label}`,
      `Select Template File: ${this.template.TemplateFile || '(None)'}`,
      `Select Notes Layout: ${notesOptLabel}`,
      '🗑️ Delete this template',
      '✅ Save and close',
    ];

    const sugg = new SimpleSuggester(
      this.app,
      options,
      (opt) => labels[options.indexOf(opt)],
      'Edit Course Template'
    );

    const choice = await sugg.openAndChoose();
    if (!choice) return;

    switch (choice) {
      case 'rename':
        await this.handleRename();
        break;
      case 'change-label':
        await this.handleChangeLabel();
        break;
      case 'select-template-file':
        await this.handleSelectTemplateFile();
        break;
      case 'select-notes-layout':
        await this.handleSelectNotesLayout();
        break;
      case 'delete':
        await this.handleDelete();
        return;
      case 'save':
        await this.handleSave();
        return;
    }

    // Return to main menu
    await this.showMainMenu();
  }

  private async handleRename() {
    const prompt = new PromptModal(this.app, 'Enter new key', this.key);
    const newKey = await prompt.openPrompt();
    if (newKey && newKey !== this.key) {
      this.key = newKey;
    }
  }

  private async handleChangeLabel() {
    const prompt = new PromptModal(this.app, 'Enter label', this.template.Label);
    const newLabel = await prompt.openPrompt();
    if (newLabel) {
      this.template.Label = newLabel;
    }
  }

  private async handleSelectTemplateFile() {
    // Get all markdown files in the Templates folder
    const templatesFolder = this.plugin.settings.BaseFolders.Templates || '90_Templates';
    const allFiles = this.app.vault.getMarkdownFiles();
    const templateFiles = allFiles.filter(f => f.path.startsWith(templatesFolder + '/'));
    
    if (templateFiles.length === 0) {
      const prompt = new PromptModal(this.app, `No .md files found in ${templatesFolder}. Enter filename manually:`);
      const filename = await prompt.openPrompt();
      if (filename) {
        this.template.TemplateFile = filename;
      }
      return;
    }

    const options = ['(None)', ...templateFiles.map(f => f.path)];
    const labels = ['No template file', ...templateFiles.map(f => f.basename)];

    const sugg = new SimpleSuggester(
      this.app,
      options,
      (opt) => labels[options.indexOf(opt)],
      'Select template file'
    );

    const chosen = await sugg.openAndChoose();
    if (chosen !== null) {
      if (chosen === '(None)') {
        this.template.TemplateFile = '';
      } else {
        // Store relative path from Templates folder
        this.template.TemplateFile = chosen.replace(templatesFolder + '/', '');
      }
    }
  }

  private async handleSelectNotesLayout() {
    const notesOpts = this.plugin.settings.NotesSubfolderOptions;
    const optKeys = Object.keys(notesOpts);
    const options = ['(None)', ...optKeys];
    const labels = ['None', ...optKeys.map(k => notesOpts[k].Label || k)];

    const sugg = new SimpleSuggester(
      this.app,
      options,
      (opt) => labels[options.indexOf(opt)],
      'Select notes subfolder layout'
    );

    const chosen = await sugg.openAndChoose();
    if (chosen !== null) {
      if (chosen === '(None)') {
        delete this.template.NotesSubfolderOption;
      } else {
        this.template.NotesSubfolderOption = chosen;
      }
    }
  }

  private async handleDelete() {
    await this.onDelete();
  }

  private async handleSave() {
    await this.onSave(this.key, this.template);
  }
}
