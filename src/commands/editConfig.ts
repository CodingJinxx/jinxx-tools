import { App, Notice, Plugin } from 'obsidian';
import { ConfigService } from '../services/ConfigService';
import { SimpleSuggester } from '../ui/SimpleSuggester';
import { PromptModal } from '../ui/PromptModal';
import { YesNoModal } from '../ui/YesNoModal';

function isObjectOrArray(v: unknown): v is Record<string, unknown> | unknown[] { return !!v && typeof v === 'object'; }

function getTypeIcon(v: unknown) {
  if (Array.isArray(v)) return '📚';
  if (isObjectOrArray(v)) return '🗂️';
  return '🔤';
}

function parseSimpleValue(s: string): string | number | boolean {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (!isNaN(Number(s)) && s.trim() !== '') return (s.indexOf('.') !== -1) ? parseFloat(s) : parseInt(s, 10);
  return s;
}

function parseValueFromInput(s: string): unknown {
  if (s === '') return '';
  try { return JSON.parse(s); } catch (_) { return parseSimpleValue(s); }
}

export async function runEditConfig(plugin: Plugin): Promise<void> {
  const app = (plugin as unknown as { app: App }).app;
  const cfgSvc = new ConfigService(plugin);

  // If plugin-based settings are in use, read via cfgSvc.readConfig()
  let data: any = {};
  try {
    data = await cfgSvc.readConfig() || {};
  } catch (e) { data = {}; }

  const path: Array<string | number> = [];

  function getAtPath(obj: any, pathArr: Array<string | number>) {
    let cur = obj;
    for (const p of pathArr) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }

  function setAtPath(obj: any, pathArr: Array<string | number>, value: any) {
    if (pathArr.length === 0) return value;
    let cur = obj;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const p = pathArr[i];
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[pathArr[pathArr.length - 1]] = value;
    return obj;
  }

  function deleteAtPath(obj: any, pathArr: Array<string | number>) {
    if (pathArr.length === 0) return;
    let cur = obj;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const p = pathArr[i];
      if (cur[p] == null) return;
      cur = cur[p];
    }
    delete cur[pathArr[pathArr.length - 1]];
  }

  for (;;) {
    const cur = getAtPath(data, path) || {};
    const entries: Array<{ id: string; label: string }> = [];
    if (Array.isArray(cur)) {
      for (let i = 0; i < cur.length; i++) {
        const v = cur[i];
        const icon = getTypeIcon(v);
        if (isObjectOrArray(v)) entries.push({ id: `idx:${i}`, label: `${icon} [${i}]` });
        else entries.push({ id: `idx:${i}`, label: `${icon} [${i}] — ${String(v)}` });
      }
    } else if (typeof cur === 'object') {
      for (const k of Object.keys(cur)) {
        const v = cur[k];
        const icon = getTypeIcon(v);
        if (isObjectOrArray(v)) entries.push({ id: `key:${k}`, label: `${icon} ${k}` });
        else entries.push({ id: `key:${k}`, label: `${icon} ${k} — ${String(v)}` });
      }
    }

    const choices = [...entries];
    choices.push({ id: 'add', label: Array.isArray(cur) ? '➕ Append item' : '➕ Add key' });
    if (entries.length) choices.push({ id: 'del', label: '🗑️ Delete entry' });
    if (path.length) choices.push({ id: 'up', label: '⬆️ Go up' });
    choices.push({ id: 'save', label: '💾 Save and exit' });
    choices.push({ id: 'cancel', label: '✖️ Cancel' });

  const sugg = new SimpleSuggester<{ id: string; label: string }>(app, choices, (c) => c.label, `Edit config — ${path.length ? path.join('/') : '<root>'}`);
    const picked = await sugg.openAndChoose();
    if (!picked || picked.id === 'cancel') { new Notice('Cancelled'); return; }

    if (picked.id === 'add') {
      if (Array.isArray(cur)) {
        const addChoices = [ { id: 'primitive', label: '🔤 Primitive value' }, { id: 'object', label: '🗂️ Object' }, { id: 'array', label: '📚 Array' } ];
  const pick = await new SimpleSuggester<{ id: string; label: string }>(app, addChoices, (c) => c.label, 'Append to array — choose type').openAndChoose();
        if (!pick) continue;
        if (pick.id === 'primitive') {
          const val = await new PromptModal(app, 'Value for new array item (JSON allowed)').openPrompt();
          if (val == null) continue; cur.push(parseValueFromInput(val)); setAtPath(data, path, cur);
        } else if (pick.id === 'object') { cur.push({}); setAtPath(data, path, cur); }
        else if (pick.id === 'array') { cur.push([]); setAtPath(data, path, cur); }
      } else {
        const addChoices = [ { id: 'kv', label: '🔤 Key → Value' }, { id: 'object', label: '🗂️ Object' }, { id: 'array', label: '📚 Array' } ];
  const pick = await new SimpleSuggester<{ id: string; label: string }>(app, addChoices, (c) => c.label, 'Add to object — choose type').openAndChoose();
        if (!pick) continue;
        const key = await new PromptModal(app, 'Key name').openPrompt();
        if (!key) continue;
        if (pick.id === 'kv') {
          const input = await new PromptModal(app, `Value for ${key} (JSON allowed)`).openPrompt(); if (input == null) continue; cur[key] = parseValueFromInput(input); setAtPath(data, path, cur);
        } else if (pick.id === 'object') { cur[key] = {}; setAtPath(data, path, cur); }
        else if (pick.id === 'array') { cur[key] = []; setAtPath(data, path, cur); }
      }
      continue;
    }

    if (picked.id === 'del') {
      if (entries.length === 0) continue;
  const choice = await new SimpleSuggester<{ id: string; label: string }>(app, entries, (e) => e.label, 'Select entry to delete').openAndChoose();
      if (!choice) continue;
      const id = choice.id;
      if (id.startsWith('key:')) {
        const k = id.slice(4);
        const confirm = await new YesNoModal(app, `Delete key ${k}?`).openPrompt();
        if (confirm) deleteAtPath(data, path.concat([k]));
      } else if (id.startsWith('idx:')) {
        const idx = parseInt(id.slice(4), 10);
        const confirm = await new YesNoModal(app, `Delete index ${idx}?`).openPrompt();
        if (confirm && Array.isArray(cur)) { cur.splice(idx, 1); setAtPath(data, path, cur); }
      }
      continue;
    }

    if (picked.id === 'up') { path.pop(); continue; }

    if (picked.id === 'save') {
      try {
        const ok = await cfgSvc.writeConfig(data);
        if (ok) { new Notice('Config saved'); } else { new Notice('Failed to save config'); }
        return;
      } catch (e: any) { new Notice('Failed to save config: ' + (e && e.message ? e.message : String(e))); return; }
    }

    if (picked.id.startsWith('key:') || picked.id.startsWith('idx:')) {
      const keyOrIdx = picked.id.startsWith('key:') ? picked.id.slice(4) : parseInt(picked.id.slice(4), 10);
      const curVal = getAtPath(data, path.concat([keyOrIdx]));
      if (isObjectOrArray(curVal)) { path.push(keyOrIdx); continue; }
      const prefill = String(curVal ?? '');
      const edited = await new PromptModal(app, 'Edit value', prefill).openPrompt();
      if (edited == null) continue;
      const parsed = parseValueFromInput(edited);
      setAtPath(data, path.concat([keyOrIdx]), parsed);
      continue;
    }
  }
}
