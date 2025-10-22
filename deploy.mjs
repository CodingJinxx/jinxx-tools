import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Configure your vault path here
const VAULT_PATH = 'C:\\Dev\\Lambda Vault\\Lambda Vault\\.obsidian\\plugins\\jinxx-tools';

const files = ['main.js', 'manifest.json', 'styles.css'];

console.log(`Deploying to: ${VAULT_PATH}`);

// Ensure the plugin directory exists
if (!existsSync(VAULT_PATH)) {
  console.log(`Creating plugin directory: ${VAULT_PATH}`);
  mkdirSync(VAULT_PATH, { recursive: true });
}

// Copy files
for (const file of files) {
  try {
    copyFileSync(file, `${VAULT_PATH}\\${file}`);
    console.log(`✅ Copied ${file}`);
  } catch (err) {
    console.error(`❌ Failed to copy ${file}:`, err.message);
    process.exit(1);
  }
}

console.log('\n🎉 Deployment successful!');
console.log('💡 Reload Obsidian to see changes (Ctrl+R or Cmd+R)');
