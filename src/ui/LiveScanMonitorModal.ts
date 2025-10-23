import { App, Modal, Notice } from 'obsidian';
import type JinxxToolsPlugin from '../../main';
import { ScanService } from '../services/ScanService';
import { PDFPreviewModal } from './PDFPreviewModal';

export class LiveScanMonitorModal extends Modal {
  private plugin: JinxxToolsPlugin;
  private scanService: ScanService;
  private courseName: string;
  private outputMode: 'create' | 'append';
  private outputPath: string;
  private refreshInterval: number | null = null;
  private isScanning = false;
  private pageCount = 0;

  constructor(
    app: App,
    plugin: JinxxToolsPlugin,
    scanService: ScanService,
    courseName: string,
    outputMode: 'create' | 'append',
    outputPath: string
  ) {
    super(app);
    this.plugin = plugin;
    this.scanService = scanService;
    this.courseName = courseName;
    this.outputMode = outputMode;
    this.outputPath = outputPath;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-live-scan-modal');

    contentEl.createEl('h2', { text: 'Scan Session' });

    // Show scan info
    contentEl.createEl('p', {
      text: `Course: ${this.courseName}`,
      cls: 'jinxx-scan-info',
    });

    contentEl.createEl('p', {
      text: `Output: ${this.outputMode === 'create' ? 'New file' : 'Append'} - ${this.outputPath}`,
      cls: 'jinxx-scan-info',
    });

    if (!this.isScanning) {
      this.renderStartView(contentEl);
    } else {
      this.renderScanningView(contentEl);
    }
  }

  private renderStartView(container: HTMLElement) {
    container.createEl('p', {
      text: 'Ready to start scanning. Click the button below and begin scanning your documents.',
      cls: 'jinxx-scan-instructions',
    });

    const buttonContainer = container.createDiv({ cls: 'jinxx-scan-buttons' });

    buttonContainer.createEl('button', {
      text: '🚀 Start Scanning Session',
      cls: 'mod-cta',
    }).addEventListener('click', async () => {
      await this.startScanning();
    });

    buttonContainer.createEl('button', {
      text: 'Cancel',
    }).addEventListener('click', () => {
      this.close();
    });
  }

  private renderScanningView(container: HTMLElement) {
    // Page count display
    const countContainer = container.createDiv({ cls: 'jinxx-page-count' });
    countContainer.createEl('div', {
      text: `${this.pageCount}`,
      cls: 'jinxx-page-count-number',
    });
    countContainer.createEl('div', {
      text: this.pageCount === 1 ? 'page detected' : 'pages detected',
      cls: 'jinxx-page-count-label',
    });

    container.createEl('p', {
      text: '📄 Scanning in progress... Keep scanning your documents.',
      cls: 'jinxx-scan-status',
    });

    const buttonContainer = container.createDiv({ cls: 'jinxx-scan-buttons' });

    buttonContainer.createEl('button', {
      text: '✅ Preview & Save',
      cls: 'mod-cta',
    }).addEventListener('click', async () => {
      await this.finishScanning();
    });
  }

  private async startScanning() {
    // Start the scan session
    const result = await this.scanService.startSession();
    if (!result.ok) {
      new Notice(result.reason || 'Failed to start scan session');
      this.close();
      return;
    }

    this.isScanning = true;
    new Notice('📄 Scan session started!');
    
    // Refresh UI
    this.refresh();

    // Start monitoring loop
    this.startMonitoring();
  }

  private startMonitoring() {
    this.refreshInterval = window.setInterval(async () => {
      await this.updatePageCount();
    }, 500);
  }

  private stopMonitoring() {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async updatePageCount() {
    const session = this.scanService.getCurrentSession();
    if (!session) return;

    try {
  const currentSnapshot = await this.scanService.takeSnapshot(session.dayFolder);
      const before = session.snapshotBefore;
      let newCount = 0;

      for (const filePath in currentSnapshot) {
        if (!before[filePath]) {
          newCount++;
        }
      }

      if (newCount !== this.pageCount) {
        this.pageCount = newCount;
        this.refresh();
      }
    } catch (e) {
      console.error('Failed to update page count:', e);
    }
  }

  private async finishScanning() {
    this.stopMonitoring();

    new Notice('Processing scanned pages...');

    // End the session and get detected files
    const result = await this.scanService.endSession();
    if (!result.ok) {
      new Notice(result.reason || 'Failed to end scan session');
      this.close();
      return;
    }

    const stableFiles = (result.newFiles || []).filter(f => f.stable);
    const unstableFiles = (result.newFiles || []).filter(f => !f.stable);

    if (stableFiles.length === 0) {
      new Notice('No stable files detected. Try again.');
      this.close();
      return;
    }

    if (unstableFiles.length > 0) {
      new Notice(`Warning: ${unstableFiles.length} files are unstable and will be excluded.`);
    }

    // Order files
    const orderedFiles = this.scanService.orderFiles(stableFiles);
    const filePaths = orderedFiles.map(f => f.path);

    // Close this modal before opening preview
    this.close();

    // Open preview modal
    const preview = new PDFPreviewModal(
      this.app,
      'new-scan',
      filePaths,
      async (rotations) => {
        // Merge or append with rotations
        new Notice(`Merging ${filePaths.length} pages...`);

        let mergeResult;
        if (this.outputMode === 'create') {
          mergeResult = await this.scanService.mergeFiles(filePaths, this.outputPath, rotations);
        } else {
          mergeResult = await this.scanService.appendToFile(filePaths, this.outputPath, rotations);
        }

        if (!mergeResult.ok) {
          throw new Error(mergeResult.reason);
        }

        new Notice(`✅ Successfully merged ${filePaths.length} pages to ${this.outputPath}`);
        
        // Archive if configured
        if (this.plugin.settings.Scans.archiveAfterMerge) {
          await this.scanService.archiveFiles(filePaths);
        }

        this.scanService.clearSession();
      }
    );

    const saved = await preview.openAndAwait();
    if (!saved) {
      // User cancelled the preview, clear session
      this.scanService.clearSession();
    }
  }

  private refresh() {
    this.contentEl.empty();
    this.onOpen();
  }

  onClose() {
    this.stopMonitoring();
    const { contentEl } = this;
    contentEl.empty();
  }
}
