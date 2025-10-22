import { App, Notice, Plugin } from 'obsidian';
import type { JinxxToolsSettings } from '../settings/SettingTab';

export class ConfigService {
  app: App;
  plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.app = (this.plugin as any).app as App;
  }

  async readConfig(): Promise<JinxxToolsSettings> {
    try {
      const data = await this.plugin.loadData();
      return (data || {}) as JinxxToolsSettings;
    } catch (e) {
      console.error('Failed to load plugin settings', e);
      return {} as JinxxToolsSettings;
    }
  }

  async writeConfig(data: JinxxToolsSettings): Promise<boolean> {
    try {
      await this.plugin.saveData(data || {});
      return true;
    } catch (e) {
      console.error('Failed to save plugin settings', e);
      return false;
    }
  }
}
