# Prompt for Agent: Add PDF Preview with Page Rotation (Including Existing PDFs)

I need you to add a PDF preview feature to the scan workflow that allows users to review and rotate individual pages before saving the merged PDF. Additionally, add the ability to open and rotate pages in **existing PDF files** in the vault.

## Context

This plugin currently has a scanning workflow in ScanService.ts and LiveScanMonitorModal.ts. The current flow is:
1. User starts a scan session
2. Scans are detected and listed in real-time
3. User can reorder scans
4. User clicks "Merge & Save" or "Append to Existing"
5. PDF is immediately created

We need to add a preview step BEFORE saving where users can:
- See thumbnails/previews of each page
- Rotate individual pages (90°, 180°, 270°)
- Confirm or cancel the final output

**Additionally**, we need to add a command to open existing PDFs in the vault and apply the same rotation functionality to save a rotated version.

## Requirements

### 1. Review Existing Code

Read and understand:
- ScanService.ts - PDF merging logic using `pdf-lib`
- LiveScanMonitorModal.ts - Current scan monitoring UI
- How the merge operation currently works
- The data structures used for scan sessions
- How commands are registered in main.ts

### 2. Create a PDF Preview Modal

Create `src/ui/PDFPreviewModal.ts` that:

**Displays**:
- Grid or list view of pages (thumbnails if possible, or page numbers)
- Current rotation state for each page (0°, 90°, 180°, 270°)
- Page count and file information
- Clear navigation between pages

**Allows**:
- Rotate individual pages clockwise (90° increments)
- Rotate individual pages counter-clockwise (90° increments)
- Keyboard shortcuts (R = rotate clockwise, Shift+R = rotate counter-clockwise)
- Navigate with arrow keys or click

**Actions**:
- "Save" button to confirm and proceed with merge/save
- "Cancel" button to return to previous view
- Footer showing page count and any modifications made

**Supports Two Modes**:
1. **New scan mode**: Preview scanned files before merging
2. **Edit existing mode**: Preview and rotate an existing PDF

**Pattern**:
```typescript
export class PDFPreviewModal extends Modal {
  private pageRotations: Map<number, number>; // page index → rotation degrees
  
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
  
  onOpen() {
    // Build UI
  }
  
  async openAndAwait(): Promise<boolean> {
    // Return true if saved, false if cancelled
  }
}
```

### 3. Modify ScanService

Update ScanService.ts to:

**Add rotation support to merge**:
```typescript
/**
 * Merge multiple scanned PDFs into a single output file
 * @param scans - Array of PDF file paths to merge
 * @param outputPath - Where to save the merged PDF
 * @param pageRotations - Optional map of page index to rotation degrees (0, 90, 180, 270)
 */
async mergeScans(
  scans: string[],
  outputPath: string,
  pageRotations?: Map<number, number>
): Promise<{ ok: boolean; reason?: string }> {
  // Apply rotations during merge
}
```

**Add new method to rotate existing PDF**:
```typescript
/**
 * Open an existing PDF, apply rotations, and save (overwrites original or saves to new path)
 * @param inputPath - Path to existing PDF in vault
 * @param pageRotations - Map of page index to rotation degrees
 * @param outputPath - Where to save (if different from input, preserves original)
 */
async rotatePDF(
  inputPath: string,
  pageRotations: Map<number, number>,
  outputPath?: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    // 1. Read existing PDF using vault API
    // 2. Load with pdf-lib
    // 3. Apply rotations to specified pages
    // 4. Save to output path (or overwrite original if not specified)
    return { ok: true };
  } catch (e) {
    console.error('rotatePDF failed', e);
    return { ok: false, reason: String(e.message || e) };
  }
}
```

**Implementation**:
- Use `pdf-lib`'s `page.setRotation()` method
- Apply rotation BEFORE copying to output PDF
- Maintain existing merge logic (append vs new file)
- Handle rotation state in result object
- For existing PDFs, read with vault API first, then process with pdf-lib

### 4. Update LiveScanMonitorModal

Modify LiveScanMonitorModal.ts to:

**Change merge buttons**:
- "Merge & Save" → "Preview & Save"
- "Append to Existing" → "Preview & Append"

**Add preview step**:
```typescript
private async handleMergeAndSave() {
  // 1. Open PDFPreviewModal with current scans
  const preview = new PDFPreviewModal(
    this.app,
    'new-scan',
    this.scans,
    async (rotations) => {
      // 2. Call merge with rotations
      const res = await this.scanService.mergeScans(
        this.scans,
        outputPath,
        rotations
      );
      if (!res.ok) throw new Error(res.reason);
    }
  );
  
  const confirmed = await preview.openAndAwait();
  if (!confirmed) return; // User cancelled preview
  
  // Continue with existing archive/cleanup logic
}
```

### 5. Add Command to Rotate Existing PDF

In main.ts, add a new command:

```typescript
this.addCommand({
  id: 'jinxx-rotate-pdf',
  name: 'Rotate pages in PDF',
  callback: async () => {
    await this.handleRotatePDF();
  }
});
```

**Implementation of `handleRotatePDF()`**:
```typescript
async handleRotatePDF() {
  // 1. Get all PDFs in vault using vault.getFiles()
  const pdfs = this.app.vault.getFiles()
    .filter(f => f.extension === 'pdf');
  
  if (pdfs.length === 0) {
    new Notice('No PDF files found in vault');
    return;
  }
  
  // 2. Use SimpleSuggester to let user pick a PDF
  const suggester = new SimpleSuggester(
    this.app,
    pdfs,
    (f) => f.path,
    'Select PDF to rotate'
  );
  
  const chosen = await suggester.openAndChoose();
  if (!chosen) return; // Cancelled
  
  // 3. Open PDFPreviewModal in 'edit-existing' mode
  const preview = new PDFPreviewModal(
    this.app,
    'edit-existing',
    chosen.path,
    async (rotations) => {
      // 4. Ask if user wants to overwrite or save as new
      const overwrite = await new YesNoModal(
        this.app,
        'Overwrite original PDF? (No = save as new file)'
      ).openPrompt();
      
      let outputPath = chosen.path;
      if (!overwrite) {
        // Generate new filename: original-rotated.pdf
        const baseName = chosen.basename;
        const parentPath = chosen.parent?.path || '';
        outputPath = `${parentPath}/${baseName}-rotated.pdf`;
      }
      
      // 5. Apply rotations
      const scanService = new ScanService(this);
      const res = await scanService.rotatePDF(
        chosen.path,
        rotations,
        outputPath
      );
      
      if (!res.ok) throw new Error(res.reason);
      
      new Notice(`PDF saved to ${outputPath}`);
    }
  );
  
  await preview.openAndAwait();
}
```

### 6. UI/UX Design

**Preview Modal Layout**:
```
┌─────────────────────────────────────────┐
│ PDF Preview - 12 pages                  │
│ Mode: [New Scan | Editing existing.pdf] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 1   │ │ 2   │ │ 3   │ │ 4   │      │
│  │ 0°  │ │ 90° │ │ 0°  │ │ 0°  │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│   [↻][↺]  [↻][↺]  [↻][↺]  [↻][↺]      │
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 5   │ │ 6   │ │ 7   │ │ 8   │      │
│  │ 0°  │ │ 0°  │ │180° │ │ 0°  │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│   [↻][↺]  [↻][↺]  [↻][↺]  [↻][↺]      │
│                                         │
├─────────────────────────────────────────┤
│ Tip: R=rotate ↻  Shift+R=rotate ↺      │
│ Modified: 2 pages rotated               │
│                        [Cancel] [Save]  │
└─────────────────────────────────────────┘
```

**Considerations**:
- Thumbnails are ideal but may be complex with `pdf-lib`
- Alternative: Show page numbers with rotation indicators
- Visual indicator for rotated pages (icon or rotation degree text)
- Show different title/instructions for "new scan" vs "edit existing" mode
- Counter showing how many pages have been modified

### 7. Thumbnail Generation (Optional Enhancement)

If feasible with `pdf-lib`:
- Generate small preview images for each page
- Use Canvas API to render PDFs
- Cache thumbnails during preview session
- Fall back to page numbers if thumbnail generation fails

**If thumbnails are too complex**: Skip and use simple page number boxes with rotation indicators.

### 8. Error Handling

Handle cases:
- PDF parsing errors during preview
- File not found (for existing PDFs)
- Rotation application failures during merge/save
- Memory issues with large PDFs (warn if >50 pages?)
- User cancels preview (return to previous view, don't lose scans)
- Write conflicts when saving existing PDF

### 9. Update Documentation

Add to SCAN_FEATURE.md:
- Description of preview step in scan workflow
- How to rotate pages during scanning
- New command: "Rotate pages in PDF"
- How to rotate existing PDFs
- Keyboard shortcuts
- What happens if preview is cancelled
- Overwrite vs save-as-new behavior

Update README.md:
- Add "Rotate pages in PDF" to features list
- Brief description of page rotation capability

## Technical Constraints

**Must follow**:
- Services return `{ ok: boolean; reason?: string }` pattern
- Modal returns `Promise<boolean>` (true = saved, false = cancelled)
- No UI imports in `ScanService.ts`
- Use existing `pdf-lib` dependency (no new dependencies)
- Keep modal <300 lines (split into helper functions if needed)
- Use `SimpleSuggester` for PDF file selection
- Use `YesNoModal` for overwrite confirmation
- Command ID must be stable: `jinxx-rotate-pdf`

**Pattern compliance**:
```typescript
// In ScanService.ts (NO MODAL IMPORTS)
async rotatePDF(
  inputPath: string,
  pageRotations: Map<number, number>,
  outputPath?: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    // Read PDF from vault
    const file = this.app.vault.getAbstractFileByPath(inputPath);
    if (!file || !(file instanceof TFile)) {
      return { ok: false, reason: 'file-not-found' };
    }
    
    const arrayBuffer = await this.app.vault.readBinary(file);
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Apply rotations
    const pages = pdfDoc.getPages();
    for (const [pageIndex, rotation] of pageRotations) {
      if (pageIndex >= 0 && pageIndex < pages.length) {
        pages[pageIndex].setRotation(degrees(rotation));
      }
    }
    
    // Save
    const pdfBytes = await pdfDoc.save();
    const savePath = outputPath || inputPath;
    await this.app.vault.adapter.writeBinary(savePath, pdfBytes);
    
    return { ok: true };
  } catch (e) {
    console.error('rotatePDF failed', e);
    return { ok: false, reason: String(e.message || e) };
  }
}

// In main.ts (UI LAYER)
async handleRotatePDF() {
  // Get PDFs
  const pdfs = this.app.vault.getFiles().filter(f => f.extension === 'pdf');
  if (pdfs.length === 0) {
    new Notice('No PDF files found in vault');
    return;
  }
  
  // Pick PDF
  const suggester = new SimpleSuggester(
    this.app,
    pdfs,
    (f) => f.path,
    'Select PDF to rotate'
  );
  const chosen = await suggester.openAndChoose();
  if (!chosen) return; // Cancelled
  
  // Preview and rotate
  const preview = new PDFPreviewModal(
    this.app,
    'edit-existing',
    chosen.path,
    async (rotations) => {
      // Overwrite or save new?
      const overwrite = await new YesNoModal(
        this.app,
        'Overwrite original PDF?'
      ).openPrompt();
      
      const outputPath = overwrite
        ? chosen.path
        : `${chosen.parent?.path || ''}/${chosen.basename}-rotated.pdf`;
      
      const scanService = new ScanService(this);
      const res = await scanService.rotatePDF(chosen.path, rotations, outputPath);
      
      if (!res.ok) throw new Error(res.reason);
      new Notice(`PDF saved to ${outputPath}`);
    }
  );
  
  const saved = await preview.openAndAwait();
  if (!saved) return; // Cancelled
}
```

## Testing Checklist

After implementation, manually test:

**New Scan Workflow**:
- [ ] Preview opens with correct page count from scans
- [ ] Rotate pages during preview
- [ ] Save creates merged PDF with rotations applied
- [ ] Cancel returns to scan monitor without saving
- [ ] Append to existing works with rotations

**Existing PDF Workflow**:
- [ ] Command lists all PDFs in vault
- [ ] Can select a PDF from suggester
- [ ] Preview opens with existing PDF's pages
- [ ] Rotate individual pages
- [ ] Save with overwrite updates original
- [ ] Save without overwrite creates new file with "-rotated" suffix
- [ ] Cancel doesn't modify anything

**Common Tests**:
- [ ] Rotate clockwise increments by 90° (wraps at 360°)
- [ ] Rotate counter-clockwise decrements by 90° (wraps at 0°)
- [ ] Keyboard shortcuts work (R, Shift+R)
- [ ] Rotations persist correctly in final PDF (verify in external viewer)
- [ ] Large PDFs (20+ pages) don't crash
- [ ] Error handling shows appropriate messages
- [ ] No notice shown when user cancels

## Deliverables

Provide complete implementations for:

1. **`src/ui/PDFPreviewModal.ts`** - New modal component supporting both modes
2. **ScanService.ts** - Updated with rotation parameters and new `rotatePDF()` method
3. **LiveScanMonitorModal.ts** - Modified to use preview modal
4. **main.ts** - Add new command `jinxx-rotate-pdf` and `handleRotatePDF()` method
5. **SCAN_FEATURE.md** - Updated documentation
6. **README.md** - Updated features list

Include:
- JSDoc comments for all public methods
- Type definitions for rotation map
- Error handling for all edge cases
- Clear UI text and instructions
- Follow the service result pattern: `{ ok: boolean; reason?: string }`
- Use existing UI helpers: `SimpleSuggester`, `YesNoModal`

## Optional Enhancements (if time permits)

- Thumbnail generation using Canvas API
- "Rotate All" button for batch operations
- Undo/Reset button to clear all rotations
- Preview full page on click (zoom modal)
- Remember last used save preference (overwrite vs save-as)

Focus on core functionality first (page number grid with rotation controls). Add enhancements only if the basic feature works perfectly.