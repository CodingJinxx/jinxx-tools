## Prompt: Minimal Templater Integration Patch for `jinxx-quickadd.js`

Use this exact prompt when asking the assistant to apply the focused, deterministic fix after you revert the previous AI edits.

---

Edit the file `95_Scripts/quickAdd/jinxx-quickadd.js` and change only the templater/rendering block inside the `addCourse` action. Keep all other code and behavior untouched.

Requirements (apply in order):

1. Primary approach: If the Templater plugin is available, call its documented file-creation API with separate filename and folder arguments. Prefer this exact call shape if the API exists on the plugin object:

   - Use: create_new(templateTFileOrString, filenameOnly, open = false, folderPath)

   - Where:
     - `templateTFileOrString` is a TFile object resolved via `app.vault.getAbstractFileByPath(templatePath)` when possible (or the template path string if the API accepts it).
     - `filenameOnly` is only the filename (e.g., `Test6.md`), NOT a full path.
     - `folderPath` is the folder path in the vault where the file should be created (e.g., `20_University/Courses`).

   - If the Templater plugin exposes `create_new` under a different common key name, try the usual plugin object names but do NOT perform broad exploratory calls — check only these locations in this order and call the single method if found:
     - `app.plugins.plugins['templater-obsidian']?.create_new` or `app.plugins.plugins['templater-obsidian']?.api?.create_new`
     - `app.plugins.plugins['templater']?.create_new` or `app.plugins.plugins['templater']?.api?.create_new`

2. Single fallback: If the primary approach is not available or the call throws, try the single alternative commonly provided by templater implementations:

   - `create_new_note_from_template(templateArg, filenameOnly, folderPath, open=false)`

   - Call only this one alternative; if it succeeds, stop and treat the file as created by templater.

3. Safe manual fallback: If neither templater call is available or both fail, perform a minimal manual rendering:

   - Read the template file from the configured template path (from `95_Scripts/config.json` or default `90_Templates/default_coursetemplate.md`).
   - Replace tokens for the course that we already use elsewhere (for example: `{{CourseName}}`) with the sanitized course name.
   - Create the target file via `app.vault.create(folderPath + '/' + filenameOnly, renderedContent)`.

Implementation constraints and safety rules:

- Do not attempt broad runtime probing or many experimental calls. Only check the few keys listed above. Keep the patch minimal and local to the templater/rendering block.
- When calling templater, pass the filename-only as the second argument and the folder path as a separate argument. This prevents templater from interpreting a path as a folder and creating a nested directory like `Test6.md/Untitled.md`.
- After templater reports success, do NOT call `app.vault.create` again for the same filepath. Instead, read the created file (or rely on the returned TFile if available) to continue any post-creation steps (create Notes/Attachments/Scans folders, etc.).
- If any templater call throws an error, catch it, record the error in the script's summary, and fall back to the single manual approach above.

Verification steps (what I will run after you apply the patch):

1. Create a test course name, e.g. `Test6` using the QuickAdd `addCourse` action.
2. Verify the created course note is a file at:

   `20_University/Courses/Test6.md`

   and NOT a directory `20_University/Courses/Test6.md/Untitled.md`.

3. Open the created file and confirm it contains templater-rendered content (template variables evaluated) or, if templater was not available, manually replaced tokens.
4. Confirm associated folders (Notes, Attachments, Scans) were created next to the course file.

If templater still creates a nested folder (unexpected):

- Capture the templater plugin object keys and small console evidence. For example, in the DevTools console run and paste the result into the issue:

  - `Object.keys(app.plugins.plugins || {})` — to show installed plugin IDs.
  - `Object.keys(app.plugins.plugins['templater-obsidian'] || app.plugins.plugins['templater'] || {})` — to show what the templater plugin exposes.
  - If the templater plugin object exists, also paste a short dump of `Object.keys(app.plugins.plugins['templater-obsidian']?.api || {})`.

Only provide those three small captures — they allow a tiny follow-up adjustment to call the exact API method name.

Testing & safety checklist for you before I run the patch:

1. Revert the assistant's previous edits to `95_Scripts/quickAdd/jinxx-quickadd.js` so the file is back to your pre-AI state.
2. Confirm the vault has the template at `90_Templates/default_coursetemplate.md` or update `95_Scripts/config.json` to point to your template path.
3. Reply here with: `READY — apply templater fix` and I will apply the single minimal patch described above.

---

Notes: the goal is a single deterministic call to templater that separates filename from folder path; everything else is a small, well-defined fallback. Avoid exploratory changes or multi-try heuristics in the repository.
