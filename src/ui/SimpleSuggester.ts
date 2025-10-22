import { App, FuzzySuggestModal } from 'obsidian';

export class SimpleSuggester<T> extends FuzzySuggestModal<T> {
  private items: T[];
  private getTextFn: (t: T) => string;
  private resolver: ((v: T | null) => void) | null = null;
  private resolved = false;

  constructor(app: App, items: T[], getText: (t: T) => string, placeholder?: string) {
    super(app);
    this.items = items || [];
    this.getTextFn = getText;
    if (placeholder) {
      this.setPlaceholder(placeholder);
    }
  }

  getItems(): T[] { return this.items; }
  getItemText(item: T): string { return this.getTextFn(item); }
  
  onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void { 
    if (!this.resolved) {
      this.resolved = true;
      if (this.resolver) {
        this.resolver(item);
      }
    }
  }
  
  onClose(): void { 
    super.onClose();
    // Delay the null resolution to let onChooseItem run first
    setTimeout(() => {
      if (!this.resolved) { 
        this.resolved = true;
        if (this.resolver) {
          this.resolver(null);
        }
      }
      this.resolver = null;
    }, 0);
  }

  openAndChoose(): Promise<T | null> { 
    return new Promise(resolve => { 
      this.resolved = false;
      this.resolver = resolve; 
      this.open(); 
    }); 
  }
}
