import { App, TFile, TFolder } from 'obsidian';

export interface Summary {
  createdFolders?: string[];
  deletedFiles?: string[];
  deletedFolders?: string[];
  moved?: Array<{ from: string; to: string }>;
  failed?: Array<{ path: string; error: string; attemptedDest?: string }>;
}

export async function ensureFolder(app: App, p: string, summary?: Summary): Promise<TFolder | null> {
  let f = app.vault.getAbstractFileByPath(p) as TFolder | null;
  if (!f) {
    try {
      await app.vault.createFolder(p);
      f = app.vault.getAbstractFileByPath(p) as TFolder | null;
      if (summary && Array.isArray(summary.createdFolders)) summary.createdFolders.push(p);
    } catch (err: any) {
      if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: p, error: String(err && err.message ? err.message : err) });
      return null;
    }
  }
  return f;
}

// Delete a folder recursively: delete files first, then subfolders deepest-first, then the folder itself
export async function deleteFolderRecursively(app: App, folder: TFolder | null, summary?: Summary): Promise<void> {
  if (!folder) return;
  try {
    const folderPath = folder.path;
    // delete all files under this folder
    const filesUnder = app.vault.getFiles().filter(f => f.path.startsWith(folderPath + '/'));
    for (const f of filesUnder) {
      try {
        await app.vault.delete(f);
        if (summary && Array.isArray(summary.deletedFiles)) summary.deletedFiles.push(f.path);
      } catch (err: any) {
        console.error('Failed to delete file during recursive delete', f.path, err);
        if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: f.path, error: String(err && err.message ? err.message : err) });
      }
    }

    // collect subfolders and delete deepest-first
    const folders: string[] = [];
    const collect = (node: any, rel: string) => {
      if (!node || !Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child && Array.isArray(child.children)) {
          const childRel = rel ? `${rel}/${child.name}` : child.name;
          folders.push(`${folderPath}/${childRel}`);
          collect(child, childRel);
        }
      }
    };
    collect(folder as any, '');
    folders.sort((a, b) => b.split('/').length - a.split('/').length);
    for (const fp of folders) {
      const node = app.vault.getAbstractFileByPath(fp);
      if (node) {
        try {
          await app.vault.delete(node);
          if (summary && Array.isArray(summary.deletedFolders)) summary.deletedFolders.push(fp);
        } catch (err: any) {
          console.error('Failed to delete subfolder during recursive delete', fp, err);
          if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: fp, error: String(err && err.message ? err.message : err) });
        }
      }
    }

    // finally delete the folder itself
    try {
      await app.vault.delete(folder);
      if (summary && Array.isArray(summary.deletedFolders)) summary.deletedFolders.push(folder.path);
    } catch (err: any) {
      console.error('Failed to delete folder itself', folder.path, err);
      if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: folder.path, error: String(err && err.message ? err.message : err) });
    }
  } catch (err: any) {
    console.error('deleteFolderRecursively failed for', folder && folder.path, err);
    if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: folder && folder.path, error: String(err && err.message ? err.message : err) });
  }
}

export function buildCompactSummary(summary?: Summary, maxExamples = 4): string {
  if (!summary) return '';
  const parts: string[] = [];
  if (Array.isArray(summary.deletedFiles) && summary.deletedFiles.length) parts.push(`${summary.deletedFiles.length} file(s) deleted`);
  if (Array.isArray(summary.deletedFolders) && summary.deletedFolders.length) parts.push(`${summary.deletedFolders.length} folder(s) deleted`);
  if (Array.isArray(summary.createdFolders) && summary.createdFolders.length) parts.push(`${summary.createdFolders.length} folder(s) created`);
  if (Array.isArray(summary.moved) && summary.moved.length) parts.push(`${summary.moved.length} item(s) moved`);
  if (Array.isArray(summary.failed) && summary.failed.length) parts.push(`${summary.failed.length} failure(s)`);

  let message = parts.length ? parts.join(', ') : 'No changes recorded';

  const examples: string[] = [];
  if (Array.isArray(summary.moved) && summary.moved.length) {
    for (let i = 0; i < Math.min(maxExamples, summary.moved.length); i++) examples.push(`moved: ${summary.moved[i].from} -> ${summary.moved[i].to}`);
  }
  if (examples.length === 0 && Array.isArray(summary.deletedFiles) && summary.deletedFiles.length) {
    for (let i = 0; i < Math.min(maxExamples, summary.deletedFiles.length); i++) examples.push(`deleted: ${summary.deletedFiles[i]}`);
  }
  if (examples.length) message += ` — ${examples.join('; ')}`;
  return message;
}
