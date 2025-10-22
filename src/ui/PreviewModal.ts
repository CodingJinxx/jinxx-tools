import { App, Modal } from 'obsidian';

export class PreviewModal extends Modal {
  title: string;
  content: string;

  constructor(app: App, title: string, content: string) {
    super(app);
    this.title = title;
    this.content = content;
  }

  onOpen() {
    const { contentEl } = this;
    const h = contentEl.createEl('h3', { text: this.title });
    const pre = contentEl.createEl('pre', { text: this.content });
    pre.style.maxHeight = '60vh';
    pre.style.overflow = 'auto';
    pre.style.whiteSpace = 'pre-wrap';
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
