---
name: add_new_character
description: Instructions for how to architect and add a new desktop pet character to the multi-character system.
---

# How to Add a New Character

When the user requests to add a new desktop pet character, you MUST follow this strict architectural process to ensure compatibility with the multi-character engine.

## 1. Create the Character Configuration Directory
Create a new directory at `services/characters/<char_id>/`.
The `<char_id>` must be lowercase and English (e.g., `cirno`, `reimu`).

## 2. Populate Configuration Files
Inside `services/characters/<char_id>/`, you must create the following files:

- **`config.json`**:
  ```json
  {
    "character_id": "<char_id>",
    "character_name": "Display Name",
    "priority_reminder": "1. 角色约束与动作描写：请严格扮演..."
  }
  ```

- **`presets.json`**:
  A JSON file containing the `dialogue_presets` dictionary. It must include lists of dialogues for states like `eating`, `sleeping`, `waking_up`, `idle`, `angry`, `working`, `gaming`, etc.

- **`base_prompt.txt`**:
  The static base prompt for LangGraph. Should define the world view, capabilities, and strict JSON output formats.

- **`dynamic_tail.txt`**:
  The dynamic prompt template containing runtime placeholders like `{time_of_day}`, `{season}`, `{weather}`, `{music_info}`, `{recent_memory}`, and `{fav_stage}`.

## 3. Create the Sprites Directory
Create a new directory for the character's images at `services/static/images/<char_id>/`.

## 4. Generate or Process 15 Animation Frames
The frontend animation state machine strictly requires EXACTLY 15 transparent-background `.png` images in the `services/static/images/<char_id>/` directory:
- `normal.png`, `normal_1.png`, `normal_2.png`
- `angry.png`, `angry_1.png`, `angry_2.png`
- `shy.png`, `shy_1.png`, `shy_2.png`
- `crying.png`, `crying_1.png`, `crying_2.png`
- `sleeping.png`, `sleeping_1.png`, `sleeping_2.png`
*(Note: `_1` is typically half-closed eyes/swaying, `_2` is fully closed eyes/swaying).*

## 5. Add UI Theming (CSS variables)
If the user specifies a specific theme color for the new character, open `services/static/css/pet.css` and add a new class `.theme-<char_id>` inside the CSS file to override the `:root` variables:
```css
body.theme-<char_id> {
  --theme-main: #xxxxxx;
  --theme-hover: #xxxxxx;
  --theme-glow-05: rgba(r, g, b, 0.5);
  /* ... override other theme variables to match the character's aesthetic ... */
}
```

## 6. Verification
Ensure the character is selectable in the frontend UI (the frontend fetches the list dynamically via `/api/character_info`, but make sure the backend endpoint discovers the folder correctly if it parses the filesystem).
