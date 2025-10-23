import { Notice, Plugin, TFile } from 'obsidian';
import { SimpleSuggester } from './src/ui/SimpleSuggester';
import { CourseService } from './src/services/CourseService';
import { JinxxToolsSettings, DEFAULT_SETTINGS, JinxxToolsSettingTab } from './src/settings/SettingTab';
import { ScanService } from './src/services/ScanService';
import { LiveScanMonitorModal } from './src/ui/LiveScanMonitorModal';
import { PromptModal } from './src/ui/PromptModal';
import { YesNoModal } from './src/ui/YesNoModal';
import { PDFPreviewModal } from './src/ui/PDFPreviewModal';
import { ConfigService } from './src/services/ConfigService';
import type { JinxxToolsAPI } from './src/api/PublicAPI';
import { JinxxToolsAPIImpl } from './src/api/APIImpl';
import * as path from 'path';

export default class JinxxToolsPlugin extends Plugin {
	settings: JinxxToolsSettings;

	/**
	 * Public API for external plugins to access Jinxx Tools functionality.
	 * 
	 * Other plugins can access this API via:
	 * ```typescript
	 * const jinxxTools = this.app.plugins.plugins['jinxx-tools'] as any;
	 * if (jinxxTools?.api) {
	 *   const folders = jinxxTools.api.getBaseFolders();
	 *   console.log('Courses path:', folders.fullCoursesPath);
	 * }
	 * ```
	 * 
	 * @public
	 */
	public api: JinxxToolsAPI | undefined;

	async onload() {
		await this.loadSettings();

		// Initialize public API
		const configService = new ConfigService(this);
		const courseService = new CourseService(this);
		this.api = new JinxxToolsAPIImpl(this.app, configService, courseService);

		// Main command: Manage Courses
		this.addCommand({
			id: 'jinxx-manage-courses',
			name: 'Manage Courses',
			callback: async () => {
				await this.handleManageCourses();
			}
		});

		this.addCommand({
			id: 'jinxx-add-course',
			name: 'Add Course',
			callback: async () => {
				await this.handleAddCourse();
			}
		});

		this.addCommand({
			id: 'jinxx-delete-course',
			name: 'Delete Course',
			callback: async () => {
				const cs = new CourseService(this);
				const res = await cs.deleteCourse();
				if (res.ok) new Notice(`Deleted course — ${res.compact}`);
				else if (res.reason !== 'cancelled' && res.reason !== 'no-course-name') new Notice(`Delete failed: ${res.reason}`);
			}
		});

	this.addCommand({
		id: 'jinxx-archive-course',
		name: 'Archive Course',
		callback: async () => {
			const cs = new CourseService(this);
			const courses = await cs.discoverCourses();

			if (courses.length === 0) {
				new Notice('No courses found.');
				return;
			}

			const sugg = new SimpleSuggester(
				this.app,
				courses,
				(c: string) => c,
				'Select course to archive'
			);

			const selectedCourse = await sugg.openAndChoose();
			if (!selectedCourse) return;

			const res = await cs.archiveCourse({ courseName: String(selectedCourse) });
			if (res.ok) new Notice(`Archived course to ${res.path}`);
			else if (res.reason !== 'cancelled' && res.reason !== 'no-course-name') new Notice(`Archive failed: ${res.reason}`);
		}
	});

	this.addCommand({
		id: 'jinxx-restore-course',
		name: 'Restore Course',
		callback: async () => {
			const cs = new CourseService(this);
			await this.handleRestoreArchive(cs);
		}
	});

	this.addCommand({
		id: 'jinxx-rename-course',
		name: 'Rename Course',
		callback: async () => {
			const cs = new CourseService(this);
			const courses = await cs.discoverCourses();

			if (courses.length === 0) {
				new Notice('No courses found.');
				return;
			}

			const sugg = new SimpleSuggester(
				this.app,
				courses,
				(c: string) => c,
				'Select course to rename'
			);

			const selectedCourse = await sugg.openAndChoose();
			if (!selectedCourse) return;

			const res = await cs.renameCourse({ oldName: String(selectedCourse) });
			if (res.ok) new Notice(`Renamed course — ${res.compact}`);
			else if (res.reason !== 'cancelled' && res.reason !== 'no-old-name' && res.reason !== 'no-new-name') new Notice(`Rename failed: ${res.reason}`);
		}
	});		// Scan command
		this.addCommand({
			id: 'jinxx-scan',
			name: 'Scan',
			callback: async () => {
				await this.handleScan();
			}
		});

		// Rotate PDF command
		this.addCommand({
			id: 'jinxx-rotate-pdf',
			name: 'Rotate pages in PDF',
			callback: async () => {
				await this.handleRotatePDF();
			}
		});

		// Add settings tab
		this.addSettingTab(new JinxxToolsSettingTab(this.app, this));
	}

	async handleAddCourse() {
		const cs = new CourseService(this);
		const res = await cs.createCourse();
		if (res.ok) {
			new Notice('Course created successfully');
		} else {
			if (res.reason === 'empty course name') {
				new Notice('Course name cannot be empty');
			} else if (res.reason === 'already-exists') {
				new Notice('A course with that name already exists');
			} else if (res.reason) {
				new Notice(`Failed to create course: ${res.reason}`);
			}
		}
	}

	async handleManageCourses() {
		const cs = new CourseService(this);
		// Interactive loop: list courses, let user pick, then show actions
		while (true) {
			const courses = await cs.listCourses();
			const courseNames = courses.map(c => c.name);
			const choices = [...courseNames, '➕ Add Course', '♻️ Restore Archive', '✖️ Close'];

			const sugg = new SimpleSuggester(this.app, choices, (c: any) => c, 'Manage Courses — select a course or action');
			const picked = await sugg.openAndChoose();
			if (!picked || picked === '✖️ Close') return;

			if (picked === '➕ Add Course') {
				await this.handleAddCourse();
				continue;
			}

			if (picked === '♻️ Restore Archive') {
				await this.handleRestoreArchive(cs);
				continue;
			}

		// User picked a course
		const courseName = picked;
		const opts = ['✖️ Close', '📄 Scan', '🗑️ Delete', '📦 Archive', '♻️ Restore', '✏️ Rename'];
		const actionSugg = new SimpleSuggester(this.app, opts, (o) => o, `Course: ${courseName} — choose action`);
		const action = await actionSugg.openAndChoose();
		if (!action || action === '✖️ Close') continue;

		if (action === '📄 Scan') {
			// Run scan for this specific course
			await this.handleScanForCourse(courseName);
			return; // Exit the manage courses loop to close the suggester
		}

		if (action === '🗑️ Delete') {
				const res = await cs.deleteCourse({ courseName });
				if (res.ok) new Notice(`Deleted ${courseName} — ${res.compact}`);
				else if (res.reason !== 'cancelled') new Notice(`Delete failed: ${res.reason}`);
				continue;
			}

			if (action === '📦 Archive') {
				const res = await cs.archiveCourse({ courseName });
				if (res.ok) new Notice(`Archived ${courseName} to ${res.path}`);
				else if (res.reason !== 'cancelled') new Notice(`Archive failed: ${res.reason}`);
				continue;
			}

			if (action === '♻️ Restore') {
				const res = await cs.restoreCourse({ courseName });
				if (res.ok) new Notice(`Restored ${courseName} from ${res.snapshot}`);
				else if (res.reason !== 'cancelled' && res.reason !== 'no-snapshots') new Notice(`Restore failed: ${res.reason}`);
				continue;
			}

			if (action === '✏️ Rename') {
				const res = await cs.renameCourse({ oldName: courseName });
				if (res.ok) new Notice(`Renamed ${courseName} — ${res.compact}`);
				else if (res.reason !== 'cancelled' && res.reason !== 'no-new-name') new Notice(`Rename failed: ${res.reason}`);
				continue;
			}
		}
	}

	async handleRestoreArchive(cs: CourseService) {
		// List all archived course base names from Archive/ folder
		const universityFolder = this.settings.BaseFolders.University || '20_University';
		const archiveRoot = `${universityFolder}/Archive`;
		const allFiles = this.app.vault.getFiles();
		const archiveSnapshots = new Set<string>();
		for (const f of allFiles) {
			if (!f.path.startsWith(`${archiveRoot}/`)) continue;
			const rel = f.path.slice((archiveRoot + '/').length);
			const parts = rel.split('/');
			if (parts.length === 0) continue;
			archiveSnapshots.add(parts[0]);
		}

		const archivedBases = new Set<string>();
		for (const snap of archiveSnapshots) {
			const base = snap.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '');
			if (base) archivedBases.add(base);
		}

		const archivedCourseLabels = Array.from(archivedBases).sort();
		if (archivedCourseLabels.length === 0) {
			new Notice('No archived courses found');
			return;
		}

		const sugg = new SimpleSuggester(this.app, archivedCourseLabels, (c) => c, 'Select archived course to restore');
		const chosenCourse = await sugg.openAndChoose();
		if (!chosenCourse) return;

		const res = await cs.restoreCourse({ courseName: chosenCourse });
		if (res.ok) new Notice(`Restored ${chosenCourse} from ${res.snapshot}`);
		else if (res.reason !== 'cancelled' && res.reason !== 'no-snapshots') new Notice(`Restore failed: ${res.reason}`);
	}

	async handleScan() {
		// Check if scanner watch folders are configured
		if (!this.settings.Scans.WatchFolders || this.settings.Scans.WatchFolders.length === 0) {
			new Notice('No scanner watch folders configured. Please add at least one in Settings → Scans.');
			return;
		}

		// Step 1: Select course
		const courseService = new CourseService(this);
		const courses = await courseService.discoverCourses();

		if (courses.length === 0) {
			new Notice('No courses found. Create a course first.');
			return;
		}

		const courseSugg = new SimpleSuggester(
			this.app,
			courses,
			(c: string) => c,
			'Select course for scan'
		);

		const selectedCourse = await courseSugg.openAndChoose();
		if (!selectedCourse) return;

		const courseName = String(selectedCourse);
		const universityFolder = this.settings.BaseFolders.University || '20_University';
		const courseScansFolder = `${universityFolder}/Scans/${courseName}`;

		// Ensure scans folder exists
		const abstractFolder = this.app.vault.getAbstractFileByPath(courseScansFolder);
		if (!abstractFolder) {
			try {
				await this.app.vault.createFolder(courseScansFolder);
			} catch (e) {
				new Notice(`Failed to create scans folder: ${String(e)}`);
				return;
			}
		}

		// Step 2: Create new or append to existing
		const pdfFiles = this.app.vault.getFiles().filter(
			f => f.path.startsWith(courseScansFolder) && f.extension === 'pdf'
		);

		const modeOptions = ['📄 Create New Scan', '📎 Append to Existing'];
		const modeSugg = new SimpleSuggester(
			this.app,
			modeOptions,
			(opt: string) => opt,
			'Create new scan or append to existing?'
		);

		const modeChoice = await modeSugg.openAndChoose();
		if (!modeChoice) return;

		let outputMode: 'create' | 'append';
		let outputPath: string;

		if (String(modeChoice) === '📄 Create New Scan') {
			// Get existing subfolders in the course scans folder
			const existingSubfolders: string[] = [];
			const scansFolderNode = this.app.vault.getAbstractFileByPath(courseScansFolder);
			if (scansFolderNode && 'children' in scansFolderNode) {
				const children = (scansFolderNode as unknown as { children?: unknown[] }).children || [];
				for (const child of children) {
					const childNode = child as { path?: string; children?: unknown[] };
					if (Array.isArray(childNode.children)) {
						// It's a folder
						const relativePath = childNode.path?.substring(courseScansFolder.length + 1);
						if (relativePath) {
							existingSubfolders.push(relativePath);
						}
					}
				}
			}
			
			// Build subfolder options: root, existing folders, and "Create New"
			const subfolderOptions = [
				'(Root - No Subfolder)',
				...existingSubfolders.sort(),
				'📁 Create New Subfolder...'
			];
			
			const subfolderSugg = new SimpleSuggester(
				this.app,
				subfolderOptions,
				(opt: string) => opt,
				'Select subfolder for the scan'
			);
			
			const subfolderChoice = await subfolderSugg.openAndChoose();
			if (!subfolderChoice) return;
			
			let subfolder = '';
			if (String(subfolderChoice) === '📁 Create New Subfolder...') {
				const subfolderPrompt = new PromptModal(
					this.app,
					'Enter new subfolder path (e.g., "Week1" or "Lectures/Week1")'
				);
				const newSubfolder = await subfolderPrompt.openPrompt();
				if (!newSubfolder || !newSubfolder.trim()) return;
				subfolder = newSubfolder.trim();
			} else if (String(subfolderChoice) !== '(Root - No Subfolder)') {
				subfolder = String(subfolderChoice);
			}
			
			// Prompt for filename
			const filenamePrompt = new PromptModal(this.app, 'Enter filename for new scan (without .pdf)');
			const filename = await filenamePrompt.openPrompt();
			if (!filename) return;

			const sanitizedFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
			
			// Build path with optional subfolder
			let outputVaultPath: string;
			if (subfolder) {
				// Remove leading/trailing slashes and normalize
				const cleanSubfolder = subfolder.replace(/^\/+|\/+$/g, '');
				outputVaultPath = `${courseScansFolder}/${cleanSubfolder}/${sanitizedFilename}`;
				
				// Ensure subfolder exists
				const subfolderPath = `${courseScansFolder}/${cleanSubfolder}`;
				const subfolderNode = this.app.vault.getAbstractFileByPath(subfolderPath);
				if (!subfolderNode) {
					try {
						await this.app.vault.createFolder(subfolderPath);
					} catch (e) {
						new Notice(`Failed to create subfolder: ${String(e)}`);
						return;
					}
				}
			} else {
				outputVaultPath = `${courseScansFolder}/${sanitizedFilename}`;
			}

			// Check if already exists
			if (this.app.vault.getAbstractFileByPath(outputVaultPath)) {
				new Notice('A scan with that name already exists');
				return;
			}

			outputMode = 'create';
			const adapter = this.app.vault.adapter as unknown as { basePath?: string };
			const vaultPath = adapter.basePath || '';
			outputPath = path.join(vaultPath, outputVaultPath);
		} else {
			// Select existing PDF
			if (pdfFiles.length === 0) {
				new Notice('No existing scans found. Please create a new one.');
				return;
			}

			const pdfSugg = new SimpleSuggester(
				this.app,
				pdfFiles.map(f => f.path),
				(p: string) => {
					// Show relative path from scans folder to help identify subfolder PDFs
					const relativePath = p.substring(courseScansFolder.length + 1);
					return relativePath;
				},
				'Select scan to append to'
			);

			const selectedPdf = await pdfSugg.openAndChoose();
			if (!selectedPdf) return;

			outputMode = 'append';
			const adapter = this.app.vault.adapter as unknown as { basePath?: string };
			const vaultPath = adapter.basePath || '';
			outputPath = path.join(vaultPath, String(selectedPdf));
		}

		// Step 3: Open live monitoring modal
		const scanService = new ScanService(this.app, this);
		const modal = new LiveScanMonitorModal(
			this.app,
			this,
			scanService,
			courseName,
			outputMode,
			outputPath
		);
		modal.open();
	}

	async handleScanForCourse(courseName: string) {
		// Check if scanner watch folders are configured
		if (!this.settings.Scans.WatchFolders || this.settings.Scans.WatchFolders.length === 0) {
			new Notice('No scanner watch folders configured. Please add at least one in Settings → Scans.');
			return;
		}

		const universityFolder = this.settings.BaseFolders.University || '20_University';
		const courseScansFolder = `${universityFolder}/Scans/${courseName}`;

		// Ensure scans folder exists
		const abstractFolder = this.app.vault.getAbstractFileByPath(courseScansFolder);
		if (!abstractFolder) {
			try {
				await this.app.vault.createFolder(courseScansFolder);
			} catch (e) {
				new Notice(`Failed to create scans folder: ${String(e)}`);
				return;
			}
		}

		// Step 1: Create new or append to existing
		const pdfFiles = this.app.vault.getFiles().filter(
			f => f.path.startsWith(courseScansFolder) && f.extension === 'pdf'
		);

		const modeOptions = ['📄 Create New Scan', '📎 Append to Existing'];
		const modeSugg = new SimpleSuggester(
			this.app,
			modeOptions,
			(opt: string) => opt,
			'Create new scan or append to existing?'
		);

		const modeChoice = await modeSugg.openAndChoose();
		if (!modeChoice) return;

		let outputMode: 'create' | 'append';
		let outputPath: string;

		if (String(modeChoice) === '📄 Create New Scan') {
			// Get existing subfolders in the course scans folder
			const existingSubfolders: string[] = [];
			const scansFolderNode = this.app.vault.getAbstractFileByPath(courseScansFolder);
			if (scansFolderNode && 'children' in scansFolderNode) {
				const children = (scansFolderNode as unknown as { children?: unknown[] }).children || [];
				for (const child of children) {
					const childNode = child as { path?: string; children?: unknown[] };
					if (Array.isArray(childNode.children)) {
						// It's a folder
						const relativePath = childNode.path?.substring(courseScansFolder.length + 1);
						if (relativePath) {
							existingSubfolders.push(relativePath);
						}
					}
				}
			}
			
			// Build subfolder options: root, existing folders, and "Create New"
			const subfolderOptions = [
				'(Root - No Subfolder)',
				...existingSubfolders.sort(),
				'📁 Create New Subfolder...'
			];
			
			const subfolderSugg = new SimpleSuggester(
				this.app,
				subfolderOptions,
				(opt: string) => opt,
				'Select subfolder for the scan'
			);
			
			const subfolderChoice = await subfolderSugg.openAndChoose();
			if (!subfolderChoice) return;
			
			let subfolder = '';
			if (String(subfolderChoice) === '📁 Create New Subfolder...') {
				const subfolderPrompt = new PromptModal(
					this.app,
					'Enter new subfolder path (e.g., "Week1" or "Lectures/Week1")'
				);
				const newSubfolder = await subfolderPrompt.openPrompt();
				if (!newSubfolder || !newSubfolder.trim()) return;
				subfolder = newSubfolder.trim();
			} else if (String(subfolderChoice) !== '(Root - No Subfolder)') {
				subfolder = String(subfolderChoice);
			}
			
			// Prompt for filename
			const filenamePrompt = new PromptModal(this.app, 'Enter filename for new scan (without .pdf)');
			const filename = await filenamePrompt.openPrompt();
			if (!filename) return;

			const sanitizedFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
			
			// Build path with optional subfolder
			let outputVaultPath: string;
			if (subfolder) {
				// Remove leading/trailing slashes and normalize
				const cleanSubfolder = subfolder.replace(/^\/+|\/+$/g, '');
				outputVaultPath = `${courseScansFolder}/${cleanSubfolder}/${sanitizedFilename}`;
				
				// Ensure subfolder exists
				const subfolderPath = `${courseScansFolder}/${cleanSubfolder}`;
				const subfolderNode = this.app.vault.getAbstractFileByPath(subfolderPath);
				if (!subfolderNode) {
					try {
						await this.app.vault.createFolder(subfolderPath);
					} catch (e) {
						new Notice(`Failed to create subfolder: ${String(e)}`);
						return;
					}
				}
			} else {
				outputVaultPath = `${courseScansFolder}/${sanitizedFilename}`;
			}

			// Check if already exists
			if (this.app.vault.getAbstractFileByPath(outputVaultPath)) {
				new Notice('A scan with that name already exists');
				return;
			}

			outputMode = 'create';
			const adapter = this.app.vault.adapter as unknown as { basePath?: string };
			const vaultPath = adapter.basePath || '';
			outputPath = path.join(vaultPath, outputVaultPath);
		} else {
			// Select existing PDF
			if (pdfFiles.length === 0) {
				new Notice('No existing scans found. Please create a new one.');
				return;
			}

			const pdfSugg = new SimpleSuggester(
				this.app,
				pdfFiles.map(f => f.path),
				(p: string) => {
					// Show relative path from scans folder to help identify subfolder PDFs
					const relativePath = p.substring(courseScansFolder.length + 1);
					return relativePath;
				},
				'Select scan to append to'
			);

			const selectedPdf = await pdfSugg.openAndChoose();
			if (!selectedPdf) return;

			outputMode = 'append';
			const adapter = this.app.vault.adapter as unknown as { basePath?: string };
			const vaultPath = adapter.basePath || '';
			outputPath = path.join(vaultPath, String(selectedPdf));
		}

		// Step 2: Open live monitoring modal
		const scanService = new ScanService(this.app, this);
		const modal = new LiveScanMonitorModal(
			this.app,
			this,
			scanService,
			courseName,
			outputMode,
			outputPath
		);
		modal.open();
	}

	async handleRotatePDF() {
		// 1. Get all PDFs in vault
		const pdfs = this.app.vault.getFiles().filter(f => f.extension === 'pdf');
		
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
				// Only apply rotations if there are any
				if (rotations.size === 0) {
					new Notice('No rotations applied');
					return;
				}

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
					outputPath = parentPath ? `${parentPath}/${baseName}-rotated.pdf` : `${baseName}-rotated.pdf`;
				}
				
				// 5. Apply rotations
				const scanService = new ScanService(this.app, this);
				const res = await scanService.rotatePDF(
					chosen.path,
					rotations,
					outputPath
				);
				
				if (!res.ok) throw new Error(res.reason);
				
				new Notice(`✅ PDF saved to ${outputPath}`);
			}
		);
		
		const saved = await preview.openAndAwait();
		if (!saved) return; // Cancelled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
