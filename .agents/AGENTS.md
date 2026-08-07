# Project-Scoped Rules for Rumia Desk Pet

## Semantic Versioning and Git Commit Policy

For every code modification that results in a Git commit, you must update the version number in `package.json` according to Semantic Versioning (SemVer) guidelines:
- **MAJOR**: Incompatible API changes or major architectural redesigns. **CRITICAL RESTRICTION**: You must ONLY increment the MAJOR version when the user explicitly requests it ("MAJOR我说你才能增加版本").
- **MINOR**: Brand-new feature modules added in a backward-compatible manner.
- **PATCH**: Backward-compatible bug fixes, minor updates, or follow-up tweaks/options for an existing feature being developed.

**IMPORTANT VERSIONING RESTRICTION**: During active iteration, refinement, or bug-fixing of a newly added feature (e.g. 1.20.0), ALWAYS increment ONLY the PATCH version (1.20.1, 1.20.2...). Do NOT bump MINOR versions for follow-up options, UI adjustments, or bug fixes related to the same ongoing feature module.

Before staging and committing any code changes:
1. Determine the appropriate version increment (MINOR for distinct new feature modules, PATCH for bug fixes & feature refinements).
2. Edit `package.json` to update the `"version"` field.
3. Stage both the modified code files and `package.json` together, and commit them.


## Versioning and Git Workflow
Whenever any code updates are made to the project, you must always remember to:
1. Commit the changes to Git using git add and git commit.
2. Update the version number appropriately (e.g., in package.json and frontend asset ?v= tags).

## Safe Deletion Policy
Whenever you need to delete user files or directories, you MUST use a method that sends them to the Recycle Bin (Trash) instead of permanently deleting them, to prevent accidental permanent data loss. 
- In PowerShell, you can use the COM object `Shell.Application` to move items to the Recycle Bin: `$sh = New-Object -ComObject Shell.Application; $sh.Namespace(0).ParseName("C:\path\to\file").InvokeVerb("delete")`
- Alternatively, you can use python's `send2trash` library if available.
- NEVER use `Remove-Item` or `rm -rf` or `del` directly on user data files (like databases, text logs, or histories) unless the user EXPLICITLY commands a permanent deletion.

## Personal Data Protection Policy

**CRITICAL RULE:** Under no circumstances are you allowed to delete the user's personal information or local configuration files (like keys, histories, configs). Furthermore, you must NEVER track, stage, or commit these personal files into Git, ensuring they are NEVER pushed to a remote repository.


## Git Commit Signature
Always append the following lines to your commit messages to use the Git Co-authored-by feature:

Co-authored-by: Antigravity <antigravity-bot@users.noreply.github.com>
