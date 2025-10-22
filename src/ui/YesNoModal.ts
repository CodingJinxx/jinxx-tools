import { App, Modal } from 'obsidian';

export class YesNoModal extends Modal {
  private promptText: string;
  private resolver: ((v: boolean) => void) | null = null;
  private resolved = false;

  constructor(app: App, promptText: string) {
    super(app);
    this.promptText = promptText;
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass('jinxx-yesno-modal');
    
    // Message
    const messageEl = contentEl.createEl('p', { text: this.promptText });
    messageEl.style.marginBottom = '20px';
    messageEl.style.fontSize = '1.1em';
    
    // Button container
    const buttonRow = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '10px';
    buttonRow.style.justifyContent = 'flex-end';
    
    // No button (secondary)
    const no = buttonRow.createEl('button', { text: 'No' });
    no.style.padding = '8px 16px';
    no.onclick = () => { 
      if (!this.resolved) {
        this.resolved = true;
        if (this.resolver) this.resolver(false); 
        this.close(); 
      }
    };
    
    // Yes button (primary)
    const yes = buttonRow.createEl('button', { text: 'Yes', cls: 'mod-cta' });
    yes.style.padding = '8px 16px';
    yes.onclick = () => { 
      if (!this.resolved) {
        this.resolved = true;
        if (this.resolver) this.resolver(true); 
        this.close(); 
      }
    };
    
    // Focus the Yes button by default
    setTimeout(() => yes.focus(), 10);
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
    if (!this.resolved && this.resolver) { 
      this.resolved = true;
      this.resolver(false); 
    }
    this.resolver = null;
  }

  openPrompt(): Promise<boolean> { 
    return new Promise(resolve => { 
      this.resolved = false;
      this.resolver = resolve; 
      this.open(); 
    }); 
  }
}
