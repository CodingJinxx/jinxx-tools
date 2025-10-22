import { App, Modal, Notice } from 'obsidian';
import { PromptModal } from './PromptModal';
import { SimpleSuggester } from './SimpleSuggester';
import { YesNoModal } from './YesNoModal';

export class FolderStructureModal extends Modal {
  private folders: Record<string, any>;
  private onSave: (folders: Record<string, any>) => void;
  private optionLabel: string;
  private currentPath: string[] = [];

  constructor(app: App, optionLabel: string, folders: Record<string, any>, onSave: (folders: Record<string, any>) => void) {
    super(app);
    this.optionLabel = optionLabel;
    this.folders = JSON.parse(JSON.stringify(folders)); // Deep clone
    this.onSave = onSave;
  }

  async onOpen() {
    await this.showFolderMenu();
  }

  private getCurrentFolder(): Record<string, any> {
    let current = this.folders;
    for (const part of this.currentPath) {
      current = current[part];
    }
    return current;
  }

  private getDisplayPath(): string {
    if (this.currentPath.length === 0) {
      return '/ (root)';
    }
    return '/' + this.currentPath.join('/');
  }

  async showFolderMenu() {
    const currentFolder = this.getCurrentFolder();
    const subfolderNames = Object.keys(currentFolder);
    const pathDisplay = this.getDisplayPath();

    // Build choices array
    const choices: Array<{ id: string; label: string; description: string }> = [];

    // Navigation options
    if (this.currentPath.length > 0) {
      choices.push({ id: '__up', label: '⬆️ Go Up', description: 'Return to parent folder' });
    }
    
    choices.push({ id: '__add', label: '➕ Add Folder', description: 'Create a new subfolder here' });
    
    if (this.currentPath.length > 0) {
      choices.push({ id: '__rename', label: '✏️ Rename Current', description: `Rename "${this.currentPath[this.currentPath.length - 1]}"` });
      choices.push({ id: '__delete', label: '🗑️ Delete Current', description: 'Delete this folder and all subfolders' });
    }

    choices.push({ id: '__save', label: '💾 Save & Close', description: 'Save changes and return' });
    choices.push({ id: '__cancel', label: '✖️ Cancel', description: 'Discard all changes' });

    // Add separator
    if (subfolderNames.length > 0) {
      choices.push({ id: '__separator', label: '─────────', description: 'Subfolders' });
    }

    // Subfolders
    for (const name of subfolderNames) {
      const childCount = Object.keys(currentFolder[name] || {}).length;
      const desc = childCount > 0 ? `${childCount} subfolder${childCount === 1 ? '' : 's'}` : 'Empty folder';
      choices.push({ id: name, label: `📁 ${name}`, description: desc });
    }

    const suggester = new SimpleSuggester(
      this.app,
      choices.filter(c => c.id !== '__separator'),
      (choice) => {
        if (choice.id === '__separator') return choice.label;
        return `${choice.label} — ${choice.description}`;
      },
      `📂 ${this.optionLabel} ${pathDisplay}`
    );

    const chosen = await suggester.openAndChoose();
    if (!chosen) {
      this.close();
      return;
    }

    switch (chosen.id) {
      case '__up':
        await this.handleGoUp();
        break;
      case '__add':
        await this.handleAddFolder();
        break;
      case '__rename':
        await this.handleRename();
        break;
      case '__delete':
        await this.handleDelete();
        break;
      case '__save':
        await this.handleSave();
        break;
      case '__cancel':
        this.close();
        break;
      default:
        // Navigate into subfolder
        this.currentPath.push(chosen.id);
        await this.showFolderMenu();
        break;
    }
  }

  async handleGoUp() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
    }
    await this.showFolderMenu();
  }

  async handleAddFolder() {
    const promptModal = new PromptModal(this.app, 'Enter folder name (or use "/" for nested):');
    const folderPath = await promptModal.openPrompt();
    
    if (!folderPath?.trim()) {
      await this.showFolderMenu();
      return;
    }

    // Support nested paths with /
    const parts = folderPath.split('/').map(p => p.trim()).filter(p => p);
    if (parts.length === 0) {
      new Notice('Invalid folder path');
      await this.showFolderMenu();
      return;
    }

    // Navigate/create nested structure
    let current = this.getCurrentFolder();
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Last part - check if exists
        if (current[part] !== undefined) {
          new Notice('Folder already exists');
          await this.showFolderMenu();
          return;
        }
        current[part] = {};
      } else {
        // Intermediate part - create if doesn't exist
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    new Notice(`Created: ${folderPath}`);
    await this.showFolderMenu();
  }

  async handleRename() {
    if (this.currentPath.length === 0) {
      await this.showFolderMenu();
      return;
    }

    const currentName = this.currentPath[this.currentPath.length - 1];
    const promptModal = new PromptModal(this.app, 'Enter new name:', currentName);
    const newName = await promptModal.openPrompt();
    
    if (!newName?.trim() || newName === currentName) {
      await this.showFolderMenu();
      return;
    }

    // Get parent folder
    const parentPath = this.currentPath.slice(0, -1);
    let parent = this.folders;
    for (const part of parentPath) {
      parent = parent[part];
    }

    // Check if new name exists
    if (parent[newName] !== undefined) {
      new Notice('A folder with that name already exists');
      await this.showFolderMenu();
      return;
    }

    // Rename (move data)
    parent[newName] = parent[currentName];
    delete parent[currentName];

    // Update current path
    this.currentPath[this.currentPath.length - 1] = newName;

    new Notice(`Renamed to: ${newName}`);
    await this.showFolderMenu();
  }

  async handleDelete() {
    if (this.currentPath.length === 0) {
      await this.showFolderMenu();
      return;
    }

    const currentName = this.currentPath[this.currentPath.length - 1];
    const yesNo = new YesNoModal(this.app, `Delete "${currentName}" and all its subfolders?`);
    const confirmed = await yesNo.openPrompt();
    
    if (!confirmed) {
      await this.showFolderMenu();
      return;
    }

    // Get parent folder
    const parentPath = this.currentPath.slice(0, -1);
    let parent = this.folders;
    for (const part of parentPath) {
      parent = parent[part];
    }

    // Delete
    delete parent[currentName];

    // Go up
    this.currentPath.pop();

    new Notice(`Deleted: ${currentName}`);
    await this.showFolderMenu();
  }

  async handleSave() {
    this.onSave(this.folders);
    new Notice('Folder structure saved');
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
