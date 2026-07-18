# Project-Scoped Rules for Rumia Desk Pet

## Semantic Versioning and Git Commit Policy

For every code modification that results in a Git commit, you must update the version number in `package.json` according to Semantic Versioning (SemVer) guidelines:
- **MAJOR**: Incompatible API changes or major architectural redesigns. **CRITICAL RESTRICTION**: You must ONLY increment the MAJOR version when the user explicitly requests it ("MAJOR我说你才能增加版本").
- **MINOR**: New features added in a backward-compatible manner.
- **PATCH**: Backward-compatible bug fixes or minor updates.

Before staging and committing any code changes:
1. Determine the appropriate version increment (MINOR for new features, PATCH for bug fixes).
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
