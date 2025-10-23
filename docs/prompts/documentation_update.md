# Prompt for Agent: Documentation Update

I need you to comprehensively review this Obsidian plugin project and update its documentation. This is a mature project that has been migrated from a QuickAdd script to a standalone plugin.

## Your Tasks

### 1. Review and Understand the Project

Read and analyze:
- All files in docs folder (especially `MIGRATION_COMPLETE.md`, `UPDATE_SUMMARY.md`, `SCAN_FEATURE.md`)
- All source code in src folder:
  - main.ts - plugin entry point and command registration
  - services - `ConfigService.ts`, `CourseService.ts`, `ScanService.ts`
  - ui - all modal and UI components
  - settings - `SettingTab.ts`
  - utils - utility functions
- manifest.json, package.json, build configuration

Understand:
- What this plugin does (course management, scanning features)
- How it's architected (services, UI components, commands)
- What the migration journey was (QuickAdd → Plugin)
- Current feature set and what's deferred
- How settings work and what they control

### 2. Update README.md

Completely rewrite README.md to be:
- **Clear for new users**: What is this plugin? What problems does it solve?
- **Feature-complete**: Cover all implemented features (course management, scanning, templates, archive system)
- **Well-structured**: Use clear sections (Installation, Features, Usage, Settings, Development)
- **Accurate**: Reflect the current state of the project, not outdated migration info
- **Practical**: Include real examples and workflows

**Keep**:
- Installation instructions (dev and production)
- Manual testing procedures
- License and author information

**Improve**:
- Overview and purpose statement
- Feature descriptions with use cases
- Settings explanations (what each setting does)
- Usage examples for main workflows
- Screenshots or ASCII diagrams if helpful

**Remove**:
- Migration-specific information (move to docs if needed)
- Outdated function mapping tables
- Development details that belong in technical docs

### 3. Create docs/project_reference.md

Create a new technical reference document at `docs/project_reference.md` that serves as the source of truth for developers. Include:

#### Architecture Overview
- High-level component diagram (ASCII or description)
- Service layer responsibilities (`ConfigService`, `CourseService`, `ScanService`)
- UI layer organization (modals, suggesters, settings)
- Command registration and lifecycle

#### File Structure and Responsibilities
- What each file/folder does
- Dependencies between modules
- Data flow patterns

#### Core Systems
- **Settings system**: How settings are stored, loaded, migrated
- **Course management**: Creation, deletion, archiving, restoration flow
- **Scan system**: Session lifecycle, file detection, PDF merging
- **Template system**: How templates are selected and applied

#### Key Abstractions and Patterns
- How `SimpleSuggester`, `PromptModal`, `YesNoModal` work
- File operations patterns (atomic writes, recursive deletion)
- Error handling conventions
- Notice patterns

#### Extension Guide
- How to add a new command
- How to add a new setting
- How to add a new UI component
- How to add a new course operation
- Testing practices

#### Data Models
- Settings interface structure
- Course folder structure
- Scan session data format
- Archive format

#### Build and Deployment
- Build process (esbuild)
- Development workflow
- Deployment to vault
- Release preparation

#### Migration History (brief summary)
- What was migrated from QuickAdd
- What features were added
- What's deferred (and why)

### 4. Update AGENTS.md

Update AGENTS.md to be more specific to this project. Keep the general Obsidian plugin guidelines but add:

#### Project-Specific Context
- This is a course management and scanning plugin for academic note-taking
- Desktop-only (uses Node.js fs APIs for scanning)
- Settings stored in plugin data (not external JSON)
- Heavy use of modal-based UI interactions

#### Code Organization Guidance
- Services go in services (stateless, business logic)
- UI components go in ui (modals, views, interactive elements)
- Commands registered in main.ts, implementation delegated to services
- Settings defined in SettingTab.ts

#### Common Patterns in This Project
- Use `SimpleSuggester` for user choices (see examples in `main.ts`)
- Use `PromptModal` for text input
- Use `YesNoModal` for confirmations
- Use `ensureFolder` for safe folder creation
- Use `buildCompactSummary` for operation reports

#### What NOT to Change
- Plugin ID (`jinxx-tools`)
- Command IDs (stable API)
- Settings structure (breaking change for users)
- Folder naming conventions (University, Courses, etc.)

#### Testing Checklist Specific to This Plugin
- Course creation with/without templates
- Course deletion with confirmation
- Archive and restore cycle
- Scan session workflow
- Settings persistence
- Manage courses interactive flow

#### Key Dependencies
- `pdf-lib` for PDF merging
- Node.js `fs` for scanning
- Obsidian's Vault API for all vault operations

## Output Format

Provide three complete file contents:

1. **README.md** - User-facing documentation
2. **docs/project_reference.md** - Technical developer reference
3. **AGENTS.md** - Updated coding instructions with project context

For each file, use proper Markdown formatting with:
- Clear headings and subheadings
- Code blocks with language identifiers
- Links to relevant files using relative paths
- Tables where appropriate
- Examples and use cases

## Guidelines

- Be comprehensive but concise
- Use clear, professional language
- Include code examples where helpful
- Reference actual file paths using `[file.ts](path/to/file.ts)` syntax
- Ensure consistency between all three documents
- Focus on what exists NOW, not historical migration details
- Make it easy for future developers to understand and extend the project

Begin by confirming you understand the task, then provide the three updated documents.