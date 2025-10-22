import { App, Modal, Notice } from 'obsidian';
import { PromptModal } from './PromptModal';
import { SimpleSuggester } from './SimpleSuggester';
import { YesNoModal } from './YesNoModal';

export class FolderStructureModal extends Modal {
  private folders: Record<string, unknown>;
  private onSave: (folders: Record<string, unknown>) => void;
  private optionLabel: string;
  private currentPath: string[] = [];

  constructor(app: App, optionLabel: string, folders: Record<string, unknown>, onSave: (folders: Record<string, unknown>) => void) {
    super(app);
    this.optionLabel = optionLabel;
    this.folders = JSON.parse(JSON.stringify(folders)); // Deep clone
    this.onSave = onSave;
  }

  async onOpen() {
    await this.showFolderMenu();
  }

  private getCurrentFolder(): Record<string, unknown> {
    let current: Record<string, unknown> = this.folders as Record<string, unknown>;
    for (const part of this.currentPath) {
      const child = current[part];
      if (child && typeof child === 'object') {
        current = child as Record<string, unknown>;
      } else {
        // Missing path -> create empty
        current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
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
      const rawChild = currentFolder[name];
      let childObj: Record<string, unknown> | null = null;
      if (rawChild && typeof rawChild === 'object') childObj = rawChild as Record<string, unknown>;
      const childCount = childObj ? Object.keys(childObj).length : 0;
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
        const next = current[part];
        if (!next || typeof next !== 'object') {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
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
    let parent: Record<string, unknown> = this.folders as Record<string, unknown>;
    for (const part of parentPath) {
      const child = parent[part];
      if (child && typeof child === 'object') parent = child as Record<string, unknown>;
      else parent[part] = {};
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
    let parent: Record<string, unknown> = this.folders as Record<string, unknown>;
    for (const part of parentPath) {
      const child = parent[part];
      if (child && typeof child === 'object') parent = child as Record<string, unknown>;
      else parent[part] = {};
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
