# Prompt for Agent: Implement PDF Thumbnail Preview with pdf.js

## Problem

The PDF preview modal needs to display actual PDF page thumbnails, not just page numbers. Users need to visually verify the content and orientation of each page before applying rotations.

## Context

Review the following files:
- PDFPreviewModal.ts - The preview modal
- ScanService.ts - PDF loading and processing logic
- styles.css - CSS for `.jinxx-pdf-page-card` and related classes
- package.json - Dependencies

**Current State**: The modal likely shows page numbers but not actual page content.

**Goal**: Display thumbnail images of each PDF page using `pdfjs-dist` library.

## Requirements

### 1. Add pdf.js Dependency

Install the official PDF.js library:

```bash
npm install pdfjs-dist
```

**Important**: Use version `^3.11.174` or latest stable. This is the official Mozilla PDF renderer.

Update package.json to include:
```json
{
  "dependencies": {
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^3.11.174"
  }
}
```

### 2. Configure pdf.js Worker

PDF.js requires a web worker. Add worker configuration in `PDFPreviewModal.ts`:

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// Configure worker - IMPORTANT for pdf.js to work
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');
```

**Alternative** if the above doesn't work with esbuild:
```typescript
// Use CDN worker (simpler, but requires internet)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
```

### 3. Update PDFPreviewModal to Load and Render Thumbnails

Modify PDFPreviewModal.ts:

```typescript
import { App, Modal, TFile, Notice } from 'obsidian';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export class PDFPreviewModal extends Modal {
  private pageRotations: Map<number, number> = new Map();
  private pdfDoc: PDFDocumentProxy | null = null;
  private totalPages: number = 0;
  private selectedPageIndex: number = 0;
  
  constructor(
    app: App,
    private mode: 'new-scan' | 'edit-existing',
    private source: string | string[],
    private onSave: (rotations: Map<number, number>) => Promise<void>
  ) {
    super(app);
  }
  
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-pdf-preview-modal');
    
    // Title
    contentEl.createEl('h2', { text: 'PDF Preview' });
    
    // Mode indicator
    const modeText = this.mode === 'new-scan' 
      ? 'New scan preview' 
      : `Editing: ${this.getFileName()}`;
    contentEl.createDiv({ cls: 'jinxx-pdf-mode', text: modeText });
    
    try {
      // Load PDF
      await this.loadPDF();
      
      // Render page grid
      await this.renderPageGrid();
      
      // Render footer
      this.renderFooter();
      
    } catch (e) {
      console.error('Failed to load PDF preview', e);
      new Notice('Failed to load PDF for preview');
      this.close();
    }
  }
  
  private async loadPDF() {
    const pdfBytes = await this.loadPDFBytes();
    
    // Load with pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;
    
    console.log(`Loaded PDF with ${this.totalPages} pages`);
  }
  
  private async loadPDFBytes(): Promise<Uint8Array> {
    if (this.mode === 'edit-existing') {
      // Load existing PDF from vault
      const file = this.app.vault.getAbstractFileByPath(this.source as string);
      if (!file || !(file instanceof TFile)) {
        throw new Error('PDF file not found');
      }
      const arrayBuffer = await this.app.vault.readBinary(file);
      return new Uint8Array(arrayBuffer);
      
    } else {
      // For new scans, we need to merge first to preview
      // OR load the first PDF to show structure
      const scans = this.source as string[];
      if (scans.length === 0) {
        throw new Error('No scans to preview');
      }
      
      // Load first scan as preview (or implement temp merge)
      const firstFile = this.app.vault.getAbstractFileByPath(scans[0]);
      if (!firstFile || !(firstFile instanceof TFile)) {
        throw new Error('Scan file not found');
      }
      const arrayBuffer = await this.app.vault.readBinary(firstFile);
      return new Uint8Array(arrayBuffer);
    }
  }
  
  private async renderPageGrid() {
    if (!this.pdfDoc) return;
    
    const grid = this.contentEl.createDiv({ cls: 'jinxx-pdf-grid' });
    
    // Render each page
    for (let i = 0; i < this.totalPages; i++) {
      await this.renderPageCard(i, grid);
    }
  }
  
  private async renderPageCard(pageIndex: number, container: HTMLElement) {
    const card = container.createDiv({ cls: 'jinxx-pdf-page-card' });
    
    // Make card selectable
    card.addEventListener('click', () => {
      this.selectPage(pageIndex);
    });
    
    // Preview container
    const preview = card.createDiv({ cls: 'jinxx-pdf-page-preview' });
    
    // Render thumbnail
    await this.renderThumbnail(pageIndex, preview);
    
    // Page label
    const label = card.createDiv({ cls: 'jinxx-pdf-page-label' });
    label.createSpan({ text: `Page ${pageIndex + 1}` });
    
    // Rotation indicator
    const rotation = this.pageRotations.get(pageIndex) || 0;
    const rotationEl = label.createSpan({ 
      cls: rotation !== 0 ? 'jinxx-pdf-page-rotation jinxx-pdf-rotated' : 'jinxx-pdf-page-rotation',
      text: ` (${rotation}°)`
    });
    
    // Rotation controls
    const controls = card.createDiv({ cls: 'jinxx-pdf-controls' });
    
    const btnCW = controls.createEl('button', { 
      cls: 'jinxx-pdf-btn-rotate',
      text: '↻',
      attr: { 'aria-label': 'Rotate clockwise' }
    });
    btnCW.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePageCW(pageIndex);
    });
    
    const btnCCW = controls.createEl('button', { 
      cls: 'jinxx-pdf-btn-rotate',
      text: '↺',
      attr: { 'aria-label': 'Rotate counter-clockwise' }
    });
    btnCCW.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePageCCW(pageIndex);
    });
    
    // Store reference for updates
    card.dataset.pageIndex = String(pageIndex);
  }
  
  private async renderThumbnail(pageIndex: number, container: HTMLElement) {
    if (!this.pdfDoc) return;
    
    try {
      // Get page
      const page = await this.pdfDoc.getPage(pageIndex + 1); // pdf.js uses 1-based indexing
      
      // Calculate scale for thumbnail
      const viewport = page.getViewport({ scale: 1.0 });
      const thumbnailWidth = 100; // Target width in pixels
      const scale = thumbnailWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = container.createEl('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };
      
      await page.render(renderContext).promise;
      
      // Apply rotation to canvas if needed
      const rotation = this.pageRotations.get(pageIndex) || 0;
      if (rotation !== 0) {
        canvas.style.transform = `rotate(${rotation}deg)`;
      }
      
    } catch (e) {
      console.error(`Failed to render thumbnail for page ${pageIndex}`, e);
      
      // Fallback: show page number
      const fallback = container.createDiv({ 
        cls: 'jinxx-pdf-page-number',
        text: String(pageIndex + 1)
      });
    }
  }
  
  private selectPage(pageIndex: number) {
    this.selectedPageIndex = pageIndex;
    
    // Update visual selection
    const cards = this.contentEl.querySelectorAll('.jinxx-pdf-page-card');
    cards.forEach((card, idx) => {
      if (idx === pageIndex) {
        card.addClass('jinxx-pdf-page-selected');
      } else {
        card.removeClass('jinxx-pdf-page-selected');
      }
    });
  }
  
  private rotatePageCW(pageIndex: number) {
    const current = this.pageRotations.get(pageIndex) || 0;
    const newRotation = (current + 90) % 360;
    this.pageRotations.set(pageIndex, newRotation);
    this.updatePageRotation(pageIndex, newRotation);
    this.updateModifiedCount();
  }
  
  private rotatePageCCW(pageIndex: number) {
    const current = this.pageRotations.get(pageIndex) || 0;
    const newRotation = (current - 90 + 360) % 360;
    this.pageRotations.set(pageIndex, newRotation);
    this.updatePageRotation(pageIndex, newRotation);
    this.updateModifiedCount();
  }
  
  private updatePageRotation(pageIndex: number, rotation: number) {
    const card = this.contentEl.querySelector(
      `.jinxx-pdf-page-card[data-page-index="${pageIndex}"]`
    );
    if (!card) return;
    
    // Update canvas rotation
    const canvas = card.querySelector('canvas');
    if (canvas) {
      canvas.style.transform = `rotate(${rotation}deg)`;
    }
    
    // Update rotation text
    const rotationEl = card.querySelector('.jinxx-pdf-page-rotation');
    if (rotationEl) {
      rotationEl.textContent = ` (${rotation}°)`;
      if (rotation !== 0) {
        rotationEl.addClass('jinxx-pdf-rotated');
      } else {
        rotationEl.removeClass('jinxx-pdf-rotated');
      }
    }
  }
  
  private updateModifiedCount() {
    const count = Array.from(this.pageRotations.values())
      .filter(r => r !== 0).length;
    
    const statusEl = this.contentEl.querySelector('.jinxx-pdf-status');
    if (statusEl) {
      statusEl.textContent = count > 0 
        ? `Modified: ${count} page${count !== 1 ? 's' : ''} rotated`
        : 'No changes';
    }
  }
  
  private renderFooter() {
    const footer = this.contentEl.createDiv({ cls: 'jinxx-pdf-footer' });
    
    // Tip
    footer.createDiv({ 
      cls: 'jinxx-pdf-tip',
      text: 'Click page to select • Click ↻/↺ to rotate'
    });
    
    // Status
    footer.createDiv({ 
      cls: 'jinxx-pdf-status',
      text: 'No changes'
    });
    
    // Buttons
    const buttons = footer.createDiv({ cls: 'jinxx-pdf-buttons' });
    
    const btnCancel = buttons.createEl('button', { text: 'Cancel' });
    btnCancel.addEventListener('click', () => {
      this.close();
    });
    
    const btnSave = buttons.createEl('button', { 
      text: 'Save',
      cls: 'mod-cta'
    });
    btnSave.addEventListener('click', async () => {
      await this.handleSave();
    });
  }
  
  private async handleSave() {
    try {
      await this.onSave(this.pageRotations);
      this.close();
    } catch (e) {
      console.error('Failed to save PDF', e);
      new Notice(`Failed to save: ${e.message}`);
    }
  }
  
  private getFileName(): string {
    if (this.mode === 'edit-existing') {
      const path = this.source as string;
      return path.split('/').pop() || 'unknown.pdf';
    }
    return 'scanned.pdf';
  }
  
  onClose() {
    // Clean up
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
  }
  
  async openAndAwait(): Promise<boolean> {
    return new Promise((resolve) => {
      const originalOnClose = this.onClose.bind(this);
      this.onClose = () => {
        originalOnClose();
        resolve(false); // Cancelled
      };
      
      const originalOnSave = this.onSave;
      this.onSave = async (rotations) => {
        await originalOnSave(rotations);
        this.onClose = originalOnClose;
        resolve(true); // Saved
      };
      
      this.open();
    });
  }
}
```

### 4. Update esbuild Configuration

Ensure esbuild.config.mjs handles the pdf.js worker properly:

````javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
...existing banner...
*/
`;

const prod = (process.argv[2] === "production");

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ["main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    // ...existing external modules...
    ...builtins
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  // Add loader for worker files
  loader: {
    '.worker.js': 'file',
  },
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
````

### 5. Update CSS for Canvas Display

Ensure styles.css properly displays the canvas thumbnails:

````css
/* ...existing code... */

.jinxx-pdf-page-preview canvas {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  transition: transform 0.2s ease;
}

.jinxx-pdf-page-preview {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  min-height: 140px;
  overflow: hidden;
}

/* ...existing code... */
````

### 6. Handle "New Scan" Mode (Multiple PDFs)

For the "new scan" mode with multiple files, you have two options:

**Option A**: Show only first PDF as preview (simpler)
```typescript
// Already implemented above - loads first scan file
```

**Option B**: Temporarily merge all scans for preview (better UX)
```typescript
private async loadPDFBytes(): Promise<Uint8Array> {
  if (this.mode === 'new-scan') {
    // Use ScanService to temporarily merge for preview
    const scans = this.source as string[];
    const tempPath = `${this.app.vault.adapter.basePath}/.obsidian/plugins/jinxx-tools/temp-preview.pdf`;
    
    // Import ScanService (requires passing plugin instance)
    const scanService = new ScanService(this.plugin);
    const res = await scanService.mergeScans(scans, tempPath);
    
    if (!res.ok) {
      throw new Error('Failed to merge scans for preview');
    }
    
    // Read temp file
    const arrayBuffer = await this.app.vault.adapter.readBinary(tempPath);
    
    // Delete temp file
    await this.app.vault.adapter.remove(tempPath);
    
    return new Uint8Array(arrayBuffer);
  }
  // ...existing edit-existing code...
}
```

**Recommendation**: Start with Option A (show first scan only), add Option B if users request it.

### 7. Testing Checklist

After 