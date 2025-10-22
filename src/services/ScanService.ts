import { App } from 'obsidian';
import type JinxxToolsPlugin from '../../main';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rename = promisify(fs.rename);
const mkdir = promisify(fs.mkdir);

export interface FileSnapshot {
  [absolutePath: string]: {
    size: number;
    mtime: number;
  };
}

export interface ScanFile {
  path: string;
  name: string;
  size: number;
  mtime: number;
  stable: boolean;
  error?: string;
}

export interface ScanSession {
  sessionId: string;
  startedAt: string;
  scanRoot: string;
  dayFolder: string;
  snapshotBefore: FileSnapshot;
  snapshotAfter?: FileSnapshot;
  newFiles?: ScanFile[];
}

export class ScanService {
  private app: App;
  private plugin: JinxxToolsPlugin;
  private currentSession: ScanSession | null = null;

  constructor(app: App, plugin: JinxxToolsPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Get the current or most recent day folder in the scanner root
   * If no day folder exists, create one with today's date
   */
  private async getDayFolder(scanRoot: string): Promise<string | null> {
    try {
      const entries = await readdir(scanRoot, { withFileTypes: true });
      const dayFolders = entries
        .filter(e => e.isDirectory() && /^\d{4}_\d{2}_\d{2}$/.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse();
      
      if (dayFolders.length === 0) {
        // No day folder exists, create one with today's date
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayFolderName = `${year}_${month}_${day}`;
        const todayFolderPath = path.join(scanRoot, todayFolderName);
        
        try {
          await mkdir(todayFolderPath, { recursive: true });
          console.debug(`Created day folder: ${todayFolderPath}`);
          return todayFolderPath;
        } catch (mkdirErr) {
          console.error('Failed to create day folder:', mkdirErr);
          return null;
        }
      }
      
      return path.join(scanRoot, dayFolders[0]);
    } catch (e) {
      console.error('Failed to get day folder:', e);
      return null;
    }
  }

  /**
   * Take a snapshot of all PDF files in a directory (recursively scans subfolders)
   */
  async takeSnapshot(folderPath: string): Promise<FileSnapshot> {
    const snapshot: FileSnapshot = {};
    
    const scanRecursive = async (currentPath: string): Promise<void> => {
      try {
        const entries = await readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            // Recursively scan subfolders
            await scanRecursive(fullPath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
            try {
              const stats = await stat(fullPath);
              snapshot[fullPath] = {
                size: stats.size,
                mtime: stats.mtimeMs,
              };
            } catch (e) {
              console.warn(`Failed to stat file ${fullPath}:`, e);
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to scan directory ${currentPath}:`, e);
      }
    };
    
    await scanRecursive(folderPath);
    return snapshot;
  }

  /**
   * Start a new scan session
   */
  async startSession(): Promise<{ ok: boolean; reason?: string; session?: ScanSession }> {
    const watchFolders = this.plugin.settings.Scans.WatchFolders;
    
    if (!watchFolders || watchFolders.length === 0) {
      return { ok: false, reason: 'No scanner watch folders configured. Please add at least one in Settings.' };
    }

    // Find all valid day folders across all watch folders
    const candidates: { scanRoot: string; dayFolder: string }[] = [];
    
    for (const scanRoot of watchFolders) {
      try {
        await stat(scanRoot);
        const dayFolder = await this.getDayFolder(scanRoot);
        if (dayFolder) {
          candidates.push({ scanRoot, dayFolder });
        }
      } catch (e) {
        console.warn(`Scanner folder not accessible: ${scanRoot}`, e);
      }
    }

    if (candidates.length === 0) {
      return { 
        ok: false, 
        reason: 'No scanner watch folders are accessible. Please check Settings.' 
      };
    }

    // Use the first valid candidate (most recent day folder due to sorting in getDayFolder)
    const { scanRoot, dayFolder } = candidates[0];

    const sessionId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.random().toString(36).substr(2, 6)}`;
    const snapshotBefore = await this.takeSnapshot(dayFolder);

    this.currentSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      scanRoot,
      dayFolder,
      snapshotBefore,
    };

  console.debug('Scan session started:', this.currentSession);
    return { ok: true, session: this.currentSession };
  }

  /**
   * End the current scan session and detect new files
   */
  async endSession(): Promise<{ ok: boolean; reason?: string; newFiles?: ScanFile[] }> {
    if (!this.currentSession) {
      return { ok: false, reason: 'No active scan session. Start a session first.' };
    }

    const snapshotAfter = await this.takeSnapshot(this.currentSession.dayFolder);
    this.currentSession.snapshotAfter = snapshotAfter;

    // Detect new files
    const newFiles = await this.detectNewFiles(this.currentSession);
    this.currentSession.newFiles = newFiles;

  console.debug('Scan session ended. New files detected:', newFiles.length);
    return { ok: true, newFiles };
  }

  /**
   * Detect new PDF files by comparing snapshots
   */
  private async detectNewFiles(session: ScanSession): Promise<ScanFile[]> {
    const before = session.snapshotBefore;
    const after = session.snapshotAfter || {};
    const newFiles: ScanFile[] = [];

    for (const filePath in after) {
      if (!before[filePath]) {
        const { size, mtime } = after[filePath];
        newFiles.push({
          path: filePath,
          name: path.basename(filePath),
          size,
          mtime,
          stable: false,
        });
      }
    }

    // Check stability for each new file
    const stabilityPromises = newFiles.map(file => this.waitForStability(file));
    await Promise.all(stabilityPromises);

    return newFiles;
  }

  /**
   * Wait for a file to become stable (size unchanged)
   */
  private async waitForStability(file: ScanFile): Promise<void> {
    const delayMs = this.plugin.settings.Scans.stabilityDelayMs;
    const maxRetries = this.plugin.settings.Scans.stabilityRetries;

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const stats1 = await stat(file.path);
        const size1 = stats1.size;

        await new Promise(resolve => setTimeout(resolve, delayMs));

        const stats2 = await stat(file.path);
        const size2 = stats2.size;

        if (size1 === size2) {
          file.stable = true;
          file.size = size2;
          file.mtime = stats2.mtimeMs;
          return;
        }
      } catch (e) {
        console.warn(`Stability check failed for ${file.name} (retry ${retry + 1}/${maxRetries}):`, e);
        if (retry === maxRetries - 1) {
          file.stable = false;
          file.error = `File locked or inaccessible: ${e.message}`;
        }
      }
    }
  }

  /**
   * Order files by numeric sequence in filename, fallback to mtime
   */
  orderFiles(files: ScanFile[]): ScanFile[] {
    return files.sort((a, b) => {
      // Try to extract numeric sequence from filename (e.g., IMG_0001.pdf)
      const numA = this.extractNumericSequence(a.name);
      const numB = this.extractNumericSequence(b.name);

      if (numA !== null && numB !== null) {
        return numA - numB;
      }

      // Fallback to mtime
      return a.mtime - b.mtime;
    });
  }

  /**
   * Extract numeric sequence from filename
   */
  private extractNumericSequence(filename: string): number | null {
    const match = filename.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Merge PDF files into a single output file
   */
  async mergeFiles(inputFiles: string[], outputPath: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      // Dynamic import of pdf-lib
      const { PDFDocument } = await import('pdf-lib');

      const mergedPdf = await PDFDocument.create();

      for (const inputPath of inputFiles) {
        try {
          const pdfBytes = await readFile(inputPath);
          const pdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page: unknown) => mergedPdf.addPage(page as any));
        } catch (e) {
          console.error(`Failed to merge file ${inputPath}:`, e);
          return { ok: false, reason: `Failed to merge ${path.basename(inputPath)}: ${String(e)}` };
        }
      }

      const mergedBytes = await mergedPdf.save();

      // Atomic write: write to temp file, then rename
      const tempPath = `${outputPath}.tmp`;
      await writeFile(tempPath, mergedBytes);
      await rename(tempPath, outputPath);

  console.debug(`Successfully merged ${inputFiles.length} files to ${outputPath}`);
      return { ok: true };
    } catch (e) {
  console.error('PDF merge failed:', e);
  return { ok: false, reason: `Merge failed: ${String(e)}` };
    }
  }

  /**
   * Append PDF files to an existing PDF
   */
  async appendToFile(inputFiles: string[], targetPath: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const { PDFDocument } = await import('pdf-lib');

      // Create backup if configured
      if (this.plugin.settings.Scans.makeBackupBeforeAppend) {
        const backupPath = `${targetPath}.backup`;
        try {
          const originalBytes = await readFile(targetPath);
          await writeFile(backupPath, originalBytes);
          console.debug(`Created backup: ${backupPath}`);
        } catch (e) {
          console.warn('Failed to create backup:', e);
        }
      }

      // Load existing PDF
      const existingBytes = await readFile(targetPath);
      const targetPdf = await PDFDocument.load(existingBytes);

      // Append new pages
      for (const inputPath of inputFiles) {
        try {
          const pdfBytes = await readFile(inputPath);
          const pdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await targetPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page: unknown) => targetPdf.addPage(page as any));
        } catch (e) {
          console.error(`Failed to append file ${inputPath}:`, e);
          return { ok: false, reason: `Failed to append ${path.basename(inputPath)}: ${String(e)}` };
        }
      }

      const mergedBytes = await targetPdf.save();

      // Atomic write
      const tempPath = `${targetPath}.tmp`;
      await writeFile(tempPath, mergedBytes);
      await rename(tempPath, targetPath);

  console.debug(`Successfully appended ${inputFiles.length} files to ${targetPath}`);
      return { ok: true };
    } catch (e) {
  console.error('PDF append failed:', e);
  return { ok: false, reason: `Append failed: ${String(e)}` };
    }
  }

  /**
   * Archive original files after merge
   */
  async archiveFiles(files: string[]): Promise<void> {
    if (!this.plugin.settings.Scans.archiveAfterMerge || !this.currentSession) {
      return;
    }

    const archiveFolder = this.plugin.settings.Scans.archiveFolderPath || 
      path.join(this.currentSession.scanRoot, 'archive');

    try {
      await mkdir(archiveFolder, { recursive: true });

      for (const file of files) {
        const basename = path.basename(file);
        const archivePath = path.join(archiveFolder, basename);
        try {
          await rename(file, archivePath);
          console.debug(`Archived: ${basename}`);
        } catch (e) {
          console.error(`Failed to archive ${basename}:`, e);
        }
      }
    } catch (e) {
      console.error('Failed to create archive folder:', e);
    }
  }

  /**
   * Get the current session
   */
  getCurrentSession(): ScanSession | null {
    return this.currentSession;
  }

  /**
   * Clear the current session
   */
  clearSession(): void {
    this.currentSession = null;
  }
}
