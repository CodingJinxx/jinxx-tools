import { App, TFolder } from 'obsidian';

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
    } catch (err: unknown) {
        if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: p, error: String(err) });
        return null;
      }
  }
  return f;
}

// Delete a folder recursively: delete files first, then subfolders deepest-first, then the folder itself
export async function deleteFolderRecursively(app: App, folder: TFolder | null, summary?: Summary): Promise<void> {
  if (!folder) return;
  try {
    // Recursive helper to collect all descendant folders
    const collectFolders = (f: TFolder): TFolder[] => {
      const result: TFolder[] = [];
      const children = (f as unknown as { children?: unknown[] }).children;
      if (Array.isArray(children)) {
        for (const child of children) {
          const childNode = child as { children?: unknown[] };
          if (Array.isArray(childNode.children)) {
            // It's a folder
            const childFolder = child as unknown as TFolder;
            result.push(...collectFolders(childFolder));
            result.push(childFolder);
          }
        }
      }
      return result;
    };

    // Delete all files in this folder and subfolders
    const folderPath = folder.path;
    const filesUnder = app.vault.getFiles().filter(f => f.path.startsWith(folderPath + '/'));
    for (const f of filesUnder) {
      try {
        await app.vault.delete(f);
        if (summary && Array.isArray(summary.deletedFiles)) summary.deletedFiles.push(f.path);
      } catch (err: unknown) {
        console.error('Failed to delete file during recursive delete', f.path, err);
        if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: f.path, error: String(err) });
      }
    }

    // Collect all subfolders (deepest first already from collectFolders)
    const subfolders = collectFolders(folder);
    
    // Delete all subfolders
    for (const subfolder of subfolders) {
      try {
        await app.vault.delete(subfolder);
        if (summary && Array.isArray(summary.deletedFolders)) summary.deletedFolders.push(subfolder.path);
      } catch (err: unknown) {
        console.error('Failed to delete subfolder during recursive delete', subfolder.path, err);
        if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: subfolder.path, error: String(err) });
      }
    }

    // Finally delete the folder itself
    try {
      await app.vault.delete(folder);
      if (summary && Array.isArray(summary.deletedFolders)) summary.deletedFolders.push(folder.path);
    } catch (err: unknown) {
      console.error('Failed to delete folder itself', folder.path, err);
      if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: folder.path, error: String(err) });
    }
  } catch (err: unknown) {
    console.error('deleteFolderRecursively failed for', folder && folder.path, err);
    if (summary && Array.isArray(summary.failed)) summary.failed.push({ path: folder && folder.path, error: String(err) });
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
