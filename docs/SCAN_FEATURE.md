# Scan Feature - Testing Guide

## Overview
The Scan feature allows you to capture single-page PDF files from a scanner, detect them automatically, and merge them into course-specific scan documents in your vault. The feature includes a PDF preview modal where you can rotate individual pages before saving.

## Setup

### 1. Configure Scanner Folder
1. Open **Settings → Jinxx Tools → Scans**
2. Set **Scanner Folder Path** to your scanner's output folder (e.g., `C:\Scans\Canon`)
3. Ensure your scanner creates day-based subfolders like `2025_10_22`

### 2. Configure Settings
- **Stability Delay (ms)**: Time between file size checks (default: 2000ms)
- **Stability Retries**: Number of retries for locked files (default: 4)
- **Keep Original Files**: Whether to keep single-page PDFs after merge
- **Archive After Merge**: Move originals to archive folder
- **Backup Before Append**: Create backup when appending to existing PDF
- **Naming Pattern**: `{course}_{YYYY-MM-DD}_{counter}.pdf`

## Workflow

### Step 1: Start Scan Session
1. Run command: **Start Scan Session** (Ctrl+P → "Start Scan Session")
2. Plugin takes a snapshot of current files in the day folder
3. You'll see: "📄 Scan session started!"

### Step 2: Scan Your Documents
- Scan your pages using your scanner
- Each page should be saved as a separate PDF (e.g., IMG_0001.pdf, IMG_0002.pdf)
- Scanner should save to the day folder (e.g., `2025_10_22`)

### Step 3: Finish Scan Session
1. Run command: **Finish Scan Session**
2. Plugin detects new PDF files and checks stability
3. PDF Preview modal opens automatically

### Step 4: Review, Rotate, and Save
The PDF Preview modal shows:
- **Page grid** with thumbnails (page numbers and current rotation)
- **Rotation controls** for each page (↻ clockwise, ↺ counter-clockwise)
- **Keyboard shortcuts**: R = rotate clockwise, Shift+R = rotate counter-clockwise
- **Arrow keys** for navigation between pages
- **Status footer** showing how many pages have been rotated

Actions:
1. **Click a page** to select it
2. **Rotate pages** using buttons or keyboard shortcuts (R / Shift+R)
3. **Navigate** with arrow keys or mouse clicks
4. **Review rotations** - rotated pages show degree indicator (90°, 180°, 270°)
5. Click **Save** to merge with rotations applied, or **Cancel** to return without saving

### Step 5: Result
- Merged PDF saved to `{University}/Scans/{Course}/` with rotations applied
- Original files archived if configured
- Success notice with file count and path

## Rotating Existing PDFs

### Command: Rotate Pages in PDF
You can also rotate pages in existing PDFs already in your vault:

1. Run command: **Rotate pages in PDF** (Ctrl+P → "Rotate pages in PDF")
2. Select a PDF from the suggester (shows all PDFs in vault)
3. PDF Preview modal opens in "edit-existing" mode
4. Rotate pages as needed using the same controls
5. Choose to **Overwrite** the original or **Save as new** file (-rotated suffix)
6. Rotations are applied immediately

### Use Cases
- Fix scanned pages that were placed upside-down in the scanner
- Correct orientation after scanning mixed landscape/portrait documents
- Adjust existing course materials for better readability

## Testing with Dummy PDFs

### Create Test Environment
```powershell
# Create scanner folder structure
mkdir "C:\Scans\Canon\2025_10_22"
```

### Generate Test PDFs
You can use any PDF and copy it multiple times with different names:
```powershell
# Copy a PDF 3 times
copy "sample.pdf" "C:\Scans\Canon\2025_10_22\IMG_0001.pdf"
copy "sample.pdf" "C:\Scans\Canon\2025_10_22\IMG_0002.pdf"
copy "sample.pdf" "C:\Scans\Canon\2025_10_22\IMG_0003.pdf"
```

### Test Scenarios

#### 1. Basic Merge (Create New)
1. Start scan session
2. Add 3 dummy PDFs to day folder
3. Finish scan session
4. Select a course
5. Click "Create New"
6. Merge → Check output in `{University}/Scans/{Course}/`

#### 2. Append Mode
1. Create a course scan PDF first (use scenario 1)
2. Start new scan session
3. Add 2 more dummy PDFs
4. Finish scan session
5. Select same course
6. Click "Choose Existing" and select the previous scan
7. Merge → Verify pages appended

#### 3. Stability Check
1. Start scan session
2. Begin copying a large PDF to day folder
3. Immediately finish scan session
4. Modal should show file as "Unstable" or "Locked"
5. File should be unchecked and disabled
6. Wait for copy to complete, then retry

#### 4. Page Rotation
1. Start scan session
2. Add 3 dummy PDFs
3. Finish scan session
4. In PDF Preview modal:
   - Select first page (click on it)
   - Press R to rotate clockwise (should show 90°)
   - Press R again (should show 180°)
   - Press Shift+R to rotate counter-clockwise (should show 90°)
   - Verify rotation indicator updates
5. Save and open merged PDF in external viewer
6. Verify pages are rotated correctly

#### 5. Edit Existing PDF
1. Create or select an existing PDF in vault
2. Run command: "Rotate pages in PDF"
3. Select the PDF from suggester
4. Rotate a few pages
5. Choose "Save as new file" (creates {filename}-rotated.pdf)
6. Verify both original and rotated versions exist
7. Repeat with "Overwrite" option
8. Verify original is updated

#### 6. Archive Originals
1. Enable "Archive After Merge" in settings
2. Complete a merge
3. Check that originals moved to archive folder
4. Verify merged PDF contains all pages

## Troubleshooting

### "No day folder found"
- Ensure scanner folder has subfolder like `YYYY_MM_DD`
- Check Scanner Folder Path in settings

### "No new PDF files detected"
- Files may have existed before starting session
- Restart scan session and try again

### Files shown as "Unstable"
- Scanner still writing file
- File is locked by another program
- Wait a moment and retry, or exclude the file

### "Failed to create scans folder"
- Course doesn't exist or path is invalid
- Create course first using "Add Course" command

### Merge fails with "Failed to merge"
- PDF file may be corrupted
- Check console (Ctrl+Shift+I) for detailed error
- Try excluding problematic file

## Technical Details

### File Detection
- Compares snapshots before/after scan session
- Only PDFs added after session start are detected
- Files matched by absolute path

### Stability Heuristic
- Checks file size twice with configurable delay
- Retries if file is locked (Windows file access errors)
- Files marked stable only when size unchanged

### PDF Merging
- Uses `pdf-lib` library (bundled, no external dependency)
- Atomic write: writes to `.tmp` then renames
- Backup created before append if configured

### Ordering
- Prefers numeric sequence in filename (IMG_0001, IMG_0002)
- Falls back to modification time if no numeric pattern
- Manual reordering available in UI

## Security Notes
- Only reads PDF files from configured scanner folder
- Only writes to vault's University/Scans folders
- No code execution or external network calls
- Original files never deleted without explicit user setting

## Performance
- Handles sessions with 50+ pages efficiently
- Stability checks run in parallel (limited concurrency)
- PDF merging streams pages incrementally (low memory)

## Platform Support
- **Desktop only** (uses Node.js fs module)
- **Windows**: Full support with file lock handling
- **macOS/Linux**: Should work but less tested
