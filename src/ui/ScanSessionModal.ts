import { App, Modal, Setting, Notice } from 'obsidian';
import type JinxxToolsPlugin from '../../main';
import { ScanFile } from '../services/ScanService';
import { SimpleSuggester } from './SimpleSuggester';
import { PromptModal } from './PromptModal';
import { CourseService } from '../services/CourseService';
import * as path from 'path';

export class ScanSessionModal extends Modal {
  private plugin: JinxxToolsPlugin;
  private files: ScanFile[];
  private selectedFiles: Set<number>;
  private selectedCourse: string | null = null;
  private selectedExistingScan: string | null = null;
  private onMerge: (
    files: string[],
    courseName: string,
    mode: 'create' | 'append',
    existingScanPath?: string
  ) => Promise<void>;

  constructor(
    app: App,
    plugin: JinxxToolsPlugin,
    files: ScanFile[],
    onMerge: (
      files: string[],
      courseName: string,
      mode: 'create' | 'append',
      existingScanPath?: string
    ) => Promise<void>
  ) {
    super(app);
    this.plugin = plugin;
    this.files = [...files];
    this.selectedFiles = new Set(files.map((_, i) => i));
    this.onMerge = onMerge;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-scan-session-modal');

    contentEl.createEl('h2', { text: 'Scan Session - Review and Merge' });

    // Show stats
    const stableCount = this.files.filter(f => f.stable).length;
    const unstableCount = this.files.length - stableCount;

    contentEl.createEl('p', {
      text: `Detected ${this.files.length} new PDF files (${stableCount} stable, ${unstableCount} unstable)`,
    });

    if (unstableCount > 0) {
      contentEl.createEl('p', {
        text: '⚠️ Some files are still being written or are locked. You can exclude them or retry later.',
        cls: 'mod-warning',
      });
    }

    // File list
    this.renderFileList(contentEl);

    // Target selection
    this.renderTargetSelection(contentEl);

    // Action buttons
    this.renderActionButtons(contentEl);
  }

  private renderFileList(container: HTMLElement) {
    container.createEl('h3', { text: 'Files to Merge' });

    const fileListContainer = container.createDiv({ cls: 'jinxx-file-list' });

    if (this.files.length === 0) {
      fileListContainer.createEl('p', { text: 'No files detected' });
      return;
    }

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const fileRow = fileListContainer.createDiv({ cls: 'jinxx-file-row' });

      // Checkbox
      const checkbox = fileRow.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.selectedFiles.has(i);
      checkbox.disabled = !file.stable;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedFiles.add(i);
        } else {
          this.selectedFiles.delete(i);
        }
      });

      // File info
      const fileInfo = fileRow.createDiv({ cls: 'jinxx-file-info' });
      const fileName = fileInfo.createEl('span', {
        text: file.name,
        cls: file.stable ? '' : 'mod-warning',
      });
      const fileSize = fileInfo.createEl('span', {
        text: ` (${(file.size / 1024).toFixed(1)} KB)`,
        cls: 'jinxx-file-size',
      });

      if (!file.stable) {
        fileInfo.createEl('span', {
          text: ` - ${file.error || 'Unstable'}`,
          cls: 'mod-error',
        });
      }

      // Move up/down buttons
      if (file.stable) {
        const buttonContainer = fileRow.createDiv({ cls: 'jinxx-file-buttons' });

        buttonContainer.createEl('button', { text: '↑' }).addEventListener('click', () => {
          if (i > 0) {
            [this.files[i], this.files[i - 1]] = [this.files[i - 1], this.files[i]];
            this.refresh();
          }
        });

        buttonContainer.createEl('button', { text: '↓' }).addEventListener('click', () => {
          if (i < this.files.length - 1) {
            [this.files[i], this.files[i + 1]] = [this.files[i + 1], this.files[i]];
            this.refresh();
          }
        });
      }
    }
  }

  private renderTargetSelection(container: HTMLElement) {
    container.createEl('h3', { text: 'Target' });

    const targetContainer = container.createDiv({ cls: 'jinxx-target-selection' });

    // Course selector
    new Setting(targetContainer)
      .setName('Select Course')
      .setDesc(this.selectedCourse || 'No course selected')
      .addButton((btn) =>
        btn.setButtonText('Choose Course').onClick(async () => {
          const courseService = new CourseService(this.plugin);
          const courses = await courseService.discoverCourses();

          if (courses.length === 0) {
            new Notice('No courses found');
            return;
          }

          const sugg = new SimpleSuggester(
            this.app,
            courses,
            (c: string) => c,
            'Select target course'
          );

          const chosen = await sugg.openAndChoose();
          if (chosen) {
            this.selectedCourse = String(chosen);
            this.selectedExistingScan = null; // Reset existing scan selection
            this.refresh();
          }
        })
      );

    // Existing scan selector (only show if course is selected)
    if (this.selectedCourse) {
      new Setting(targetContainer)
        .setName('Append to Existing Scan')
        .setDesc(this.selectedExistingScan || '(Create new scan)')
        .addButton((btn) =>
          btn.setButtonText('Choose Existing').onClick(async () => {
            await this.selectExistingScan();
          })
        )
        .addButton((btn) =>
          btn.setButtonText('Create New').onClick(() => {
            this.selectedExistingScan = null;
            this.refresh();
          })
        );
    }
  }

  private async selectExistingScan() {
    if (!this.selectedCourse) return;

    const universityFolder = this.plugin.settings.BaseFolders.University;
    const scansFolderPath = `${universityFolder}/Scans/${this.selectedCourse}`;

    try {
      const scansFolder = this.app.vault.getAbstractFileByPath(scansFolderPath);
      if (!scansFolder) {
        new Notice(`No scans folder found for ${this.selectedCourse}`);
        return;
      }

      const pdfFiles = this.app.vault.getFiles().filter(
        f => f.path.startsWith(scansFolderPath) && f.extension === 'pdf'
      );

      if (pdfFiles.length === 0) {
        new Notice(`No PDF scans found for ${this.selectedCourse}`);
        return;
      }

      const options = ['(Create New)', ...pdfFiles.map(f => f.path)];
      const labels = ['Create new scan PDF', ...pdfFiles.map(f => f.basename)];

      const sugg = new SimpleSuggester(
        this.app,
        options,
        (opt) => labels[options.indexOf(opt)],
        'Select scan PDF to append to'
      );

      const chosen = await sugg.openAndChoose();
      if (chosen && chosen !== '(Create New)') {
        this.selectedExistingScan = chosen;
        this.refresh();
      } else if (chosen === '(Create New)') {
        this.selectedExistingScan = null;
        this.refresh();
      }
    } catch (e) {
      console.error('Failed to list existing scans:', e);
      new Notice('Failed to list existing scans');
    }
  }

  private renderActionButtons(container: HTMLElement) {
    const buttonContainer = container.createDiv({ cls: 'jinxx-action-buttons' });

    // Merge button
    new Setting(buttonContainer).addButton((btn) =>
      btn
        .setButtonText('Merge PDFs')
        .setCta()
        .onClick(async () => {
          await this.handleMerge();
        })
    );

    // Cancel button
    new Setting(buttonContainer).addButton((btn) =>
      btn.setButtonText('Cancel').onClick(() => {
        this.close();
      })
    );
  }

  private async handleMerge() {
    // Validation
    if (!this.selectedCourse) {
      new Notice('Please select a course first');
      return;
    }

    const selectedFileIndices = Array.from(this.selectedFiles).sort((a, b) => a - b);
    if (selectedFileIndices.length === 0) {
      new Notice('Please select at least one file to merge');
      return;
    }

    const selectedFilePaths = selectedFileIndices.map(i => this.files[i].path);

    // Determine mode
    const mode = this.selectedExistingScan ? 'append' : 'create';

    // Close modal and execute merge
    this.close();

    try {
      await this.onMerge(selectedFilePaths, this.selectedCourse, mode, this.selectedExistingScan || undefined);
    } catch (e) {
      console.error('Merge failed:', e);
      new Notice(`Merge failed: ${e.message}`);
    }
  }

  private refresh() {
    this.contentEl.empty();
    this.onOpen();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
