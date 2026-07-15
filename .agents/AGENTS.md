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
