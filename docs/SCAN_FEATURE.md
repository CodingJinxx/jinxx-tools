# Scan Feature - Testing Guide

## Overview
The Scan feature allows you to capture single-page PDF files from a scanner, detect them automatically, and merge them into course-specific scan documents in your vault.

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
3. Interactive modal opens showing detected files

### Step 4: Review and Merge
The modal shows:
- **File list** with checkboxes (exclude unwanted pages)
- **Reorder buttons** (↑↓) to change page order
- **Course selector** to choose target course
- **Create/Append** options for output

Actions:
1. **Uncheck** files you want to exclude
2. **Reorder** pages using ↑↓ buttons
3. **Choose Course** - select target course
4. **Choose Existing** or **Create New** - append to existing PDF or create new one
5. Click **Merge PDFs** to execute

### Step 5: Result
- Merged PDF saved to `{University}/Scans/{Course}/`
- Original files archived if configured
- Success notice with file count and path

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

#### 4. File Reordering
1. Start scan session
2. Add PDFs: IMG_0001, IMG_0003, IMG_0002 (out of order)
3. Finish scan session
4. Files should be auto-ordered by numeric sequence
5. Use ↑↓ buttons to manually reorder
6. Merge and verify page order in output

#### 5. Archive Originals
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
