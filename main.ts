import { Notice, Plugin, TFile } from 'obsidian';
import { SimpleSuggester } from './src/ui/SimpleSuggester';
import { CourseService } from './src/services/CourseService';
import { JinxxToolsSettings, DEFAULT_SETTINGS, JinxxToolsSettingTab } from './src/settings/SettingTab';

export default class JinxxToolsPlugin extends Plugin {
	settings: JinxxToolsSettings;

	async onload() {
		await this.loadSettings();

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
				const res = await cs.archiveCourse();
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
				const res = await cs.renameCourse();
				if (res.ok) new Notice(`Renamed course — ${res.compact}`);
				else if (res.reason !== 'cancelled' && res.reason !== 'no-old-name' && res.reason !== 'no-new-name') new Notice(`Rename failed: ${res.reason}`);
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
			const opts = ['✖️ Close', '🗑️ Delete', '📦 Archive', '♻️ Restore', '✏️ Rename'];
			const actionSugg = new SimpleSuggester(this.app, opts, (o) => o, `Course: ${courseName} — choose action`);
			const action = await actionSugg.openAndChoose();
			if (!action || action === '✖️ Close') continue;

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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
