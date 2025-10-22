import { App, Modal, Notice } from 'obsidian';
import { SimpleSuggester } from './SimpleSuggester';
import { PromptModal } from './PromptModal';
import { FolderStructureModal } from './FolderStructureModal';
import { LectureSubfolderOption } from '../settings/SettingTab';

export class LectureOptionEditorModal extends Modal {
  private optionKey: string;
  private option: LectureSubfolderOption;
  private onSave: (key: string, option: LectureSubfolderOption) => Promise<void>;
  private onDelete: () => Promise<void>;

  constructor(
    app: App, 
    optionKey: string, 
    option: LectureSubfolderOption,
    onSave: (key: string, option: LectureSubfolderOption) => Promise<void>,
    onDelete: () => Promise<void>
  ) {
    super(app);
    this.optionKey = optionKey;
    this.option = JSON.parse(JSON.stringify(option)); // Deep clone
    this.onSave = onSave;
    this.onDelete = onDelete;
  }

  async onOpen() {
    await this.showMainMenu();
  }

  async showMainMenu() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-lecture-editor-modal');

    const header = contentEl.createEl('h2', { text: `Edit Lecture Option: ${this.optionKey}` });
    header.style.marginBottom = '20px';

    // Display current settings
    const infoBox = contentEl.createDiv({ cls: 'jinxx-info-box' });
    infoBox.style.padding = '16px';
    infoBox.style.marginBottom = '20px';
    infoBox.style.border = '1px solid var(--background-modifier-border)';
    infoBox.style.borderRadius = '6px';
    infoBox.style.backgroundColor = 'var(--background-secondary)';

    const keyInfo = infoBox.createEl('div');
    keyInfo.innerHTML = `<strong>Key:</strong> ${this.optionKey}`;
    keyInfo.style.marginBottom = '8px';

    const labelInfo = infoBox.createEl('div');
    labelInfo.innerHTML = `<strong>Label:</strong> ${this.option.Label || '(not set)'}`;
    labelInfo.style.marginBottom = '8px';

    const folderCount = this.countFolders(this.option.Folders);
    const folderInfo = infoBox.createEl('div');
    folderInfo.innerHTML = `<strong>Folders:</strong> ${folderCount} configured`;

    const description = contentEl.createEl('p', { 
      text: 'Select an action:',
      cls: 'setting-item-description'
    });
    description.style.marginBottom = '16px';
    description.style.color = 'var(--text-muted)';

    // Action buttons
    const actions = [
      { id: 'rename', label: '✏️ Rename Key', description: 'Change the option key' },
      { id: 'label', label: '🏷️ Edit Label', description: 'Change the display label' },
      { id: 'folders', label: '📁 Configure Folders', description: 'Edit folder structure' },
      { id: 'delete', label: '🗑️ Delete Option', description: 'Remove this lecture option' },
      { id: 'save', label: '💾 Save & Close', description: 'Save changes and return' },
      { id: 'cancel', label: '✖️ Cancel', description: 'Discard changes' },
    ];

    const suggester = new SimpleSuggester(
      this.app,
      actions,
      (action) => `${action.label} — ${action.description}`,
      'Choose an action'
    );

    const chosen = await suggester.openAndChoose();
    if (!chosen) {
      this.close();
      return;
    }

    switch (chosen.id) {
      case 'rename':
        await this.handleRename();
        break;
      case 'label':
        await this.handleEditLabel();
        break;
      case 'folders':
        await this.handleEditFolders();
        break;
      case 'delete':
        await this.handleDelete();
        break;
      case 'save':
        await this.handleSave();
        break;
      case 'cancel':
        this.close();
        break;
    }
  }

  async handleRename() {
    const promptModal = new PromptModal(this.app, 'Enter new key name:', this.optionKey);
    const newKey = await promptModal.openAndPromise();
    
    if (newKey && newKey !== this.optionKey) {
      this.optionKey = newKey;
      new Notice('Key updated (remember to save)');
    }
    
    await this.showMainMenu();
  }

  async handleEditLabel() {
    const promptModal = new PromptModal(this.app, 'Enter label:', this.option.Label);
    const newLabel = await promptModal.openAndPromise();
    
    if (newLabel !== null) {
      this.option.Label = newLabel;
      new Notice('Label updated (remember to save)');
    }
    
    await this.showMainMenu();
  }

  async handleEditFolders() {
    const folderModal = new FolderStructureModal(
      this.app,
      this.option.Label || this.optionKey,
      this.option.Folders,
      async (folders) => {
        this.option.Folders = folders;
        new Notice('Folders updated (remember to save)');
      }
    );
    folderModal.open();
    
    // Wait for folder modal to close, then return to main menu
    await new Promise<void>(resolve => {
      const originalClose = folderModal.close.bind(folderModal);
      folderModal.close = () => {
        originalClose();
        resolve();
      };
    });
    
    await this.showMainMenu();
  }

  async handleDelete() {
    await this.onDelete();
    new Notice('Lecture option deleted');
    this.close();
  }

  async handleSave() {
    await this.onSave(this.optionKey, this.option);
    new Notice('Lecture option saved');
    this.close();
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

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Extend PromptModal to return Promise directly
declare module './PromptModal' {
  interface PromptModal {
    openAndPromise(): Promise<string | null>;
  }
}

PromptModal.prototype.openAndPromise = function() {
  return this.openPrompt();
};
