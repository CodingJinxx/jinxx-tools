import { App, Modal } from 'obsidian';

export class PromptModal extends Modal {
  private promptText: string;
  private defaultValue: string;
  private resolver: ((v: string | null) => void) | null = null;
  private resolved = false;

  constructor(app: App, promptText: string, defaultValue = '') {
    super(app);
    this.promptText = promptText;
    this.defaultValue = defaultValue;
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass('jinxx-prompt-modal');
    
    // Label
    const label = contentEl.createEl('label', { text: this.promptText });
    label.style.display = 'block';
    label.style.marginBottom = '12px';
    label.style.fontSize = '1.1em';
    label.style.fontWeight = '500';
    
    // Input
    const input = contentEl.createEl('input', { type: 'text' });
    input.value = this.defaultValue;
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.marginBottom = '20px';
    input.style.fontSize = '1em';
    input.style.border = '1px solid var(--background-modifier-border)';
    input.style.borderRadius = '4px';
    input.style.backgroundColor = 'var(--background-primary)';
    
    // Button container
    const buttonRow = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '10px';
    buttonRow.style.justifyContent = 'flex-end';
    
    // Cancel button (secondary)
    const cancel = buttonRow.createEl('button', { text: 'Cancel' });
    cancel.style.padding = '8px 16px';
    cancel.onclick = () => { 
      if (!this.resolved) {
        this.resolved = true;
        if (this.resolver) this.resolver(null); 
        this.close(); 
      }
    };
    
    // OK button (primary)
    const ok = buttonRow.createEl('button', { text: 'OK', cls: 'mod-cta' });
    ok.style.padding = '8px 16px';
    ok.onclick = () => { 
      if (!this.resolved) {
        this.resolved = true;
        if (this.resolver) this.resolver(input.value); 
        this.close(); 
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { 
        if (!this.resolved) {
          this.resolved = true;
          if (this.resolver) this.resolver(input.value); 
          this.close(); 
        }
      }
      if (e.key === 'Escape') { 
        if (!this.resolved) {
          this.resolved = true;
          if (this.resolver) this.resolver(null); 
          this.close(); 
        }
      }
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 10);
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
    if (!this.resolved && this.resolver) { 
      this.resolved = true;
      this.resolver(null); 
    }
    this.resolver = null;
  }

  openPrompt(): Promise<string | null> { 
    return new Promise(resolve => { 
      this.resolved = false;
      this.resolver = resolve; 
      this.open(); 
    }); 
  }
}
