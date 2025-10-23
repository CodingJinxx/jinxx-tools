import { App, Modal, TFile, Notice } from 'obsidian';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

/**
 * Modal for viewing a single PDF page at full size
 */
class FullScreenPageModal extends Modal {
  constructor(
    app: App,
    private pdfDoc: PDFDocumentProxy,
    private pageIndex: number,
    private currentRotation: number,
    private onRotationChange: (pageIndex: number, rotation: number) => void
  ) {
    super(app);
  }
  
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-fullscreen-page-modal');
    
    // Header with title and rotation controls
    const header = contentEl.createDiv({ cls: 'jinxx-fullscreen-header' });
    
    const titleSection = header.createDiv({ cls: 'jinxx-fullscreen-title-section' });
    titleSection.createEl('h3', { text: `Page ${this.pageIndex + 1}` });
    
    // Rotation controls in header
    const rotationControls = header.createDiv({ cls: 'jinxx-fullscreen-rotation-controls' });
    
    const btnCCW = rotationControls.createEl('button', { 
      text: '↺ Rotate Left',
      cls: 'jinxx-fullscreen-rotate-btn'
    });
    btnCCW.addEventListener('click', () => this.rotateLeft());
    
    const btnCW = rotationControls.createEl('button', { 
      text: 'Rotate Right ↻',
      cls: 'jinxx-fullscreen-rotate-btn'
    });
    btnCW.addEventListener('click', () => this.rotateRight());
    
    const closeBtn = header.createEl('button', { text: '✕', cls: 'jinxx-fullscreen-close' });
    closeBtn.addEventListener('click', () => this.close());
    
    // Canvas container (centered)
    const canvasContainer = contentEl.createDiv({ cls: 'jinxx-fullscreen-canvas-container' });
    
    try {
      await this.renderFullPage(canvasContainer);
    } catch (e) {
      console.error('Failed to render full page:', e);
      canvasContainer.createEl('p', { text: 'Failed to load page preview' });
    }
    
    // Footer with close button
    const footer = contentEl.createDiv({ cls: 'jinxx-fullscreen-footer' });
    const rotationText = footer.createEl('span', { 
      text: `Rotation: ${this.currentRotation}°`,
      cls: 'jinxx-fullscreen-rotation-text'
    });
    footer.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close());
  }
  
  /**
   * Rotate the page left (counter-clockwise) and re-render
   */
  private rotateLeft(): void {
    this.currentRotation = (this.currentRotation - 90 + 360) % 360;
    this.updateRotation();
    // Notify parent modal of rotation change
    this.onRotationChange(this.pageIndex, this.currentRotation);
  }
  
  /**
   * Rotate the page right (clockwise) and re-render
   */
  private rotateRight(): void {
    this.currentRotation = (this.currentRotation + 90) % 360;
    this.updateRotation();
    // Notify parent modal of rotation change
    this.onRotationChange(this.pageIndex, this.currentRotation);
  }
  
  /**
   * Update the canvas rotation without full re-render
   */
  private updateRotation(): void {
    const canvas = this.contentEl.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.transform = `rotate(${this.currentRotation}deg)`;
    }
    
    // Update rotation text
    const rotationText = this.contentEl.querySelector('.jinxx-fullscreen-rotation-text') as HTMLElement;
    if (rotationText) {
      rotationText.setText(`Rotation: ${this.currentRotation}°`);
    }
  }
  
  /**
   * Render the full-screen page preview
   */
  private async renderFullPage(container: HTMLElement): Promise<void> {
    // Get page
    const page = await this.pdfDoc.getPage(this.pageIndex + 1);
    
    // Calculate scale to fit screen (account for header/footer, use ~70% of viewport height)
    const viewport = page.getViewport({ scale: 1.0 });
    const maxWidth = window.innerWidth * 0.75;
    const maxHeight = window.innerHeight * 0.65; // Reduced to account for header/footer
    
    const scale = Math.min(
      maxWidth / viewport.width,
      maxHeight / viewport.height
    );
    
    const scaledViewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = container.createEl('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    // Render page
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    await page.render(renderContext).promise;
    
    // Apply rotation
    if (this.currentRotation !== 0) {
      canvas.style.transform = `rotate(${this.currentRotation}deg)`;
    }
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for previewing and rotating PDF pages before saving.
 * Supports two modes:
 * 1. New scan: Preview scanned files before merging
 * 2. Edit existing: Preview and rotate an existing PDF
 */
export class PDFPreviewModal extends Modal {
  private pageRotations: Map<number, number>; // page index → rotation degrees (0, 90, 180, 270)
  private totalPages = 0;
  private pdfDoc: PDFDocumentProxy | null = null;
  private selectedPageIndex: number | null = null;
  private resolvePromise: ((value: boolean) => void) | null = null;
  private currentPageOffset = 0; // For pagination
  private readonly PAGES_PER_VIEW = 5; // Show 5 pages at a time

  /**
   * Create a preview modal for new scans or existing PDF
   * @param app - Obsidian App instance
   * @param mode - 'new-scan' or 'edit-existing'
   * @param source - For 'new-scan': array of file paths to merge. For 'edit-existing': single PDF path
   * @param onSave - Callback when user clicks Save
   */
  constructor(
    app: App,
    private mode: 'new-scan' | 'edit-existing',
    private source: string | string[],
    private onSave: (rotations: Map<number, number>) => Promise<void>
  ) {
    super(app);
    this.pageRotations = new Map();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('jinxx-pdf-preview-modal');

    try {
      // Load PDF to determine page count
      await this.loadPDF();

      if (this.totalPages === 0) {
        contentEl.createEl('p', { text: 'Failed to load PDF. Please try again.' });
        this.renderButtons(contentEl, true);
        return;
      }

      // Title
      const modeText = this.mode === 'new-scan' ? 'New Scan' : `Editing ${this.getSourceFileName()}`;
      contentEl.createEl('h2', { text: `PDF Preview - ${this.totalPages} pages` });
      contentEl.createEl('p', { text: `Mode: ${modeText}`, cls: 'jinxx-pdf-mode' });

      // Pagination info
      const paginationInfo = contentEl.createDiv({ cls: 'jinxx-pdf-pagination-info' });
      this.updatePaginationInfo(paginationInfo);

      // Grid container with pagination controls
      const gridWrapper = contentEl.createDiv({ cls: 'jinxx-pdf-grid-wrapper' });
      
      // Previous button
      const prevBtn = gridWrapper.createEl('button', { 
        cls: 'jinxx-pdf-nav-btn jinxx-pdf-nav-prev',
        text: '◀'
      });
      prevBtn.addEventListener('click', () => this.previousPage());
      if (this.currentPageOffset === 0) {
        prevBtn.disabled = true;
      }
      
      // Grid container
      const gridContainer = gridWrapper.createDiv({ cls: 'jinxx-pdf-grid' });
      await this.renderPageGrid(gridContainer);
      
      // Next button
      const nextBtn = gridWrapper.createEl('button', { 
        cls: 'jinxx-pdf-nav-btn jinxx-pdf-nav-next',
        text: '▶'
      });
      nextBtn.addEventListener('click', () => this.nextPage());
      if (this.currentPageOffset + this.PAGES_PER_VIEW >= this.totalPages) {
        nextBtn.disabled = true;
      }

      // Footer
      const footer = contentEl.createDiv({ cls: 'jinxx-pdf-footer' });
      const tipText = footer.createEl('p', { cls: 'jinxx-pdf-tip' });
      tipText.setText('Tip: R=rotate ↻  Shift+R=rotate ↺  Click page to view full size');

      const statusText = footer.createEl('p', { cls: 'jinxx-pdf-status' });
      this.updateStatus(statusText);

      this.renderButtons(footer, false);

      // Register keyboard shortcuts
      this.registerKeyboardShortcuts();
    } catch (e) {
      console.error('Failed to open PDF preview:', e);
      new Notice('Failed to load PDF preview');
      this.close();
    }
  }

  /**
   * Load the PDF document to get page count and prepare for rotation
   */
  private async loadPDF(): Promise<void> {
    try {
      const pdfBytes = await this.loadPDFBytes();
      
      // Load with pdf.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      
      console.log(`Loaded PDF with ${this.totalPages} pages`);
    } catch (e) {
      console.error('Failed to load PDF:', e);
      this.totalPages = 0;
    }
  }

  /**
   * Load PDF bytes from vault
   */
  private async loadPDFBytes(): Promise<Uint8Array> {
    if (this.mode === 'edit-existing') {
      // Load existing PDF from vault
      const filePath = this.source as string;
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        throw new Error('PDF file not found');
      }

      const arrayBuffer = await this.app.vault.readBinary(file);
      return new Uint8Array(arrayBuffer);
    } else {
      // For new scans, load the first scan to show structure
      // (Could merge all scans for better preview, but that's more complex)
      const filePaths = this.source as string[];
      if (filePaths.length === 0) {
        throw new Error('No scans to preview');
      }

      // Use Node.js fs to read the first scan file (it's a file system path, not vault path)
      const fs = require('fs');
      const { promisify } = require('util');
      const readFile = promisify(fs.readFile);
      
      const pdfBytes = await readFile(filePaths[0]);
      return new Uint8Array(pdfBytes);
    }
  }

  /**
   * Get the visible page range based on current pagination
   */
  private getVisiblePageRange(): { start: number; end: number } {
    const start = this.currentPageOffset;
    const end = Math.min(start + this.PAGES_PER_VIEW, this.totalPages);
    return { start, end };
  }

  /**
   * Render the page grid with rotation controls (only visible pages)
   */
  private async renderPageGrid(container: HTMLElement): Promise<void> {
    container.empty();

    if (!this.pdfDoc) {
      console.error('PDF document not loaded');
      return;
    }

    const { start, end } = this.getVisiblePageRange();
    
    for (let i = start; i < end; i++) {
      await this.renderPageCard(i, container);
    }
  }

  /**
   * Render a single page card with thumbnail
   */
  private async renderPageCard(pageIndex: number, container: HTMLElement): Promise<void> {
    const pageCard = container.createDiv({ cls: 'jinxx-pdf-page-card' });
    pageCard.dataset.pageIndex = String(pageIndex);
    
    if (this.selectedPageIndex === pageIndex) {
      pageCard.addClass('jinxx-pdf-page-selected');
    }

    // Page preview box with thumbnail
    const pagePreview = pageCard.createDiv({ cls: 'jinxx-pdf-page-preview' });
    
    // Render thumbnail
    await this.renderThumbnail(pageIndex, pagePreview);

    // Page label
    const pageLabel = pageCard.createDiv({ cls: 'jinxx-pdf-page-label' });
    pageLabel.setText(`Page ${pageIndex + 1}`);

    // Rotation indicator
    const rotation = this.pageRotations.get(pageIndex) || 0;
    const rotationEl = pageCard.createDiv({ 
      text: `${rotation}°`, 
      cls: 'jinxx-pdf-page-rotation' 
    });
    
    if (rotation !== 0) {
      rotationEl.addClass('jinxx-pdf-rotated');
    }

    // Rotation controls
    const controls = pageCard.createDiv({ cls: 'jinxx-pdf-controls' });
    
    const btnCW = controls.createEl('button', { text: '↻', cls: 'jinxx-pdf-btn-rotate' });
    btnCW.setAttribute('aria-label', 'Rotate clockwise');
    btnCW.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePageClockwise(pageIndex);
    });

    const btnCCW = controls.createEl('button', { text: '↺', cls: 'jinxx-pdf-btn-rotate' });
    btnCCW.setAttribute('aria-label', 'Rotate counter-clockwise');
    btnCCW.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePageCounterClockwise(pageIndex);
    });

    // Click to select page and open full-screen preview
    pageCard.addEventListener('click', (e) => {
      // Don't open if clicking rotation buttons, controls, or rotation indicator
      const target = e.target as HTMLElement;
      if (target.classList.contains('jinxx-pdf-btn-rotate') || 
          target.closest('.jinxx-pdf-btn-rotate') ||
          target.closest('.jinxx-pdf-controls') ||
          target.classList.contains('jinxx-pdf-page-rotation') ||
          target.closest('.jinxx-pdf-page-rotation')) {
        console.log('Click on rotation control detected, not opening full-screen');
        return;
      }
      
      console.log('Opening full-screen preview for page', pageIndex + 1);
      
      // Update selection
      const oldIndex = this.selectedPageIndex;
      this.selectedPageIndex = pageIndex;
      if (oldIndex !== null && oldIndex !== pageIndex) {
        this.updatePageSelection(oldIndex, pageIndex);
      } else if (oldIndex === null) {
        pageCard.addClass('jinxx-pdf-page-selected');
      }
      
      // Open full-screen preview
      this.openFullScreenPreview(pageIndex);
    });
  }

  /**
   * Render PDF page thumbnail to canvas
   */
  private async renderThumbnail(pageIndex: number, container: HTMLElement): Promise<void> {
    if (!this.pdfDoc) return;

    try {
      // Get page (pdf.js uses 1-based indexing)
      const page = await this.pdfDoc.getPage(pageIndex + 1);
      
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
      
      console.log(`Rendered thumbnail for page ${pageIndex + 1}`);
    } catch (e) {
      console.error(`Failed to render thumbnail for page ${pageIndex + 1}:`, e);
      
      // Fallback: show page number
      const fallback = container.createDiv({ 
        cls: 'jinxx-pdf-page-number-fallback',
        text: `${pageIndex + 1}`
      });
    }
  }

  /**
   * Rotate a page clockwise (add 90 degrees, wrap at 360)
   */
  private rotatePageClockwise(pageIndex: number): void {
    console.log(`Rotating page ${pageIndex + 1} clockwise`);
    const currentRotation = this.pageRotations.get(pageIndex) || 0;
    const newRotation = (currentRotation + 90) % 360;
    console.log(`Current rotation: ${currentRotation}°, New rotation: ${newRotation}°`);
    this.pageRotations.set(pageIndex, newRotation);
    this.updatePageRotation(pageIndex, newRotation);
    this.updateStatusFooter();
  }

  /**
   * Rotate a page counter-clockwise (subtract 90 degrees, wrap at 0)
   */
  private rotatePageCounterClockwise(pageIndex: number): void {
    console.log(`Rotating page ${pageIndex + 1} counter-clockwise`);
    const currentRotation = this.pageRotations.get(pageIndex) || 0;
    const newRotation = (currentRotation - 90 + 360) % 360;
    console.log(`Current rotation: ${currentRotation}°, New rotation: ${newRotation}°`);
    this.pageRotations.set(pageIndex, newRotation);
    this.updatePageRotation(pageIndex, newRotation);
    this.updateStatusFooter();
  }

  /**
   * Update page rotation visually without full refresh
   */
  private updatePageRotation(pageIndex: number, rotation: number): void {
    console.log(`updatePageRotation called for page ${pageIndex + 1}, rotation: ${rotation}°`);
    const card = this.contentEl.querySelector(
      `.jinxx-pdf-page-card[data-page-index="${pageIndex}"]`
    ) as HTMLElement;
    
    if (!card) {
      console.warn(`Card not found for page ${pageIndex + 1}`);
      return;
    }

    // Update canvas rotation
    const canvas = card.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.transform = `rotate(${rotation}deg)`;
      console.log(`Canvas transform updated to rotate(${rotation}deg)`);
    } else {
      console.warn(`Canvas not found for page ${pageIndex + 1}`);
    }

    // Update rotation text
    const rotationEl = card.querySelector('.jinxx-pdf-page-rotation') as HTMLElement;
    if (rotationEl) {
      rotationEl.textContent = `${rotation}°`;
      if (rotation !== 0) {
        rotationEl.addClass('jinxx-pdf-rotated');
      } else {
        rotationEl.removeClass('jinxx-pdf-rotated');
      }
    }
  }

  /**
   * Update status footer showing modification count
   */
  private updateStatusFooter(): void {
    const modifiedCount = Array.from(this.pageRotations.values()).filter(r => r !== 0).length;
    const statusEl = this.contentEl.querySelector('.jinxx-pdf-status') as HTMLElement;
    if (statusEl) {
      if (modifiedCount === 0) {
        statusEl.setText('No pages rotated');
      } else {
        statusEl.setText(`Modified: ${modifiedCount} ${modifiedCount === 1 ? 'page' : 'pages'} rotated`);
      }
    }
  }

  /**
   * Update the status text showing how many pages have been modified
   */
  private updateStatus(statusEl: HTMLElement): void {
    const modifiedCount = Array.from(this.pageRotations.values()).filter(r => r !== 0).length;
    if (modifiedCount === 0) {
      statusEl.setText('No pages rotated');
    } else {
      statusEl.setText(`Modified: ${modifiedCount} ${modifiedCount === 1 ? 'page' : 'pages'} rotated`);
    }
  }

  /**
   * Render action buttons
   */
  private renderButtons(container: HTMLElement, isError: boolean): void {
    const buttonContainer = container.createDiv({ cls: 'jinxx-pdf-buttons' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.resolveAndClose(false);
    });

    if (!isError) {
      const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
      saveBtn.addEventListener('click', async () => {
        await this.handleSave();
      });
    }
  }

  /**
   * Handle the save action
   */
  private async handleSave(): Promise<void> {
    try {
      await this.onSave(this.pageRotations);
      this.resolveAndClose(true);
    } catch (e) {
      console.error('Save failed:', e);
      // Error is handled by caller, just close
      this.resolveAndClose(false);
    }
  }

  /**
   * Register keyboard shortcuts
   */
  private registerKeyboardShortcuts(): void {
    this.scope.register([], 'r', () => {
      if (this.selectedPageIndex !== null) {
        this.rotatePageClockwise(this.selectedPageIndex);
      }
      return false;
    });

    this.scope.register(['Shift'], 'r', () => {
      if (this.selectedPageIndex !== null) {
        this.rotatePageCounterClockwise(this.selectedPageIndex);
      }
      return false;
    });

    // Arrow key navigation with pagination support
    this.scope.register([], 'ArrowRight', () => {
      if (this.selectedPageIndex !== null && this.selectedPageIndex < this.totalPages - 1) {
        const oldIndex = this.selectedPageIndex;
        this.selectedPageIndex++;
        this.updatePageSelection(oldIndex, this.selectedPageIndex);
        
        // If moved to next page group, navigate forward
        if (this.selectedPageIndex >= this.currentPageOffset + this.PAGES_PER_VIEW) {
          this.nextPage();
        }
      }
      return false;
    });

    this.scope.register([], 'ArrowLeft', () => {
      if (this.selectedPageIndex !== null && this.selectedPageIndex > 0) {
        const oldIndex = this.selectedPageIndex;
        this.selectedPageIndex--;
        this.updatePageSelection(oldIndex, this.selectedPageIndex);
        
        // If moved to previous page group, navigate back
        if (this.selectedPageIndex < this.currentPageOffset) {
          this.previousPage();
        }
      }
      return false;
    });
  }

  /**
   * Update pagination info display
   */
  private updatePaginationInfo(container: HTMLElement): void {
    const { start, end } = this.getVisiblePageRange();
    container.setText(`Showing pages ${start + 1}-${end} of ${this.totalPages}`);
  }

  /**
   * Navigate to previous page group
   */
  private previousPage(): void {
    if (this.currentPageOffset > 0) {
      this.currentPageOffset = Math.max(0, this.currentPageOffset - this.PAGES_PER_VIEW);
      this.refreshGrid();
    }
  }

  /**
   * Navigate to next page group
   */
  private nextPage(): void {
    if (this.currentPageOffset + this.PAGES_PER_VIEW < this.totalPages) {
      this.currentPageOffset += this.PAGES_PER_VIEW;
      this.refreshGrid();
    }
  }

  /**
   * Refresh only the grid and pagination controls (no full modal refresh)
   */
  private refreshGrid(): void {
    const gridContainer = this.contentEl.querySelector('.jinxx-pdf-grid') as HTMLElement;
    if (gridContainer) {
      this.renderPageGrid(gridContainer);
    }
    
    // Update pagination info
    const paginationInfo = this.contentEl.querySelector('.jinxx-pdf-pagination-info') as HTMLElement;
    if (paginationInfo) {
      this.updatePaginationInfo(paginationInfo);
    }
    
    // Update button states
    const prevBtn = this.contentEl.querySelector('.jinxx-pdf-nav-prev') as HTMLButtonElement;
    const nextBtn = this.contentEl.querySelector('.jinxx-pdf-nav-next') as HTMLButtonElement;
    
    if (prevBtn) {
      prevBtn.disabled = this.currentPageOffset === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentPageOffset + this.PAGES_PER_VIEW >= this.totalPages;
    }
  }

  /**
   * Update page selection visually without full refresh
   */
  private updatePageSelection(oldIndex: number, newIndex: number): void {
    // Remove selection from old page
    const oldCard = this.contentEl.querySelector(
      `.jinxx-pdf-page-card[data-page-index="${oldIndex}"]`
    );
    if (oldCard) {
      oldCard.removeClass('jinxx-pdf-page-selected');
    }
    
    // Add selection to new page
    const newCard = this.contentEl.querySelector(
      `.jinxx-pdf-page-card[data-page-index="${newIndex}"]`
    );
    if (newCard) {
      newCard.addClass('jinxx-pdf-page-selected');
    }
  }

  /**
   * Open full-screen preview for a specific page
   */
  private openFullScreenPreview(pageIndex: number): void {
    if (!this.pdfDoc) return;
    
    const rotation = this.pageRotations.get(pageIndex) || 0;
    const fullScreenModal = new FullScreenPageModal(
      this.app,
      this.pdfDoc,
      pageIndex,
      rotation,
      (idx, rot) => {
        // Update rotation in parent modal
        this.pageRotations.set(idx, rot);
        this.updatePageRotation(idx, rot);
        this.updateStatusFooter();
      }
    );
    fullScreenModal.open();
  }

  /**
   * Get filename from source (for display)
   */
  private getSourceFileName(): string {
    if (this.mode === 'edit-existing') {
      const filePath = this.source as string;
      const parts = filePath.split('/');
      return parts[parts.length - 1];
    }
    return '';
  }

  /**
   * Resolve the promise and close the modal
   */
  private resolveAndClose(saved: boolean): void {
    if (this.resolvePromise) {
      this.resolvePromise(saved);
      this.resolvePromise = null;
    }
    this.close();
  }

  /**
   * Open the modal and return a promise that resolves when saved or cancelled
   * @returns Promise<boolean> - true if saved, false if cancelled
   */
  async openAndAwait(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Clean up PDF document
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    
    // If promise was not resolved, resolve with false (cancelled)
    if (this.resolvePromise) {
      this.resolvePromise(false);
      this.resolvePromise = null;
    }
  }
}
