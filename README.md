# 📖 ST Reference Desk

A lightweight SillyTavern reference-manual drawer for Markdown and other text-based files.

## v0.2.2

- Markdown rendering now uses SillyTavern's bundled Showdown renderer instead of Reference Desk's home-grown parser.
- Rendered Markdown is sanitized with SillyTavern's bundled DOMPurify.
- Fixes multiline bold/emphasis and improves tables, nested lists, links, fenced code blocks, task lists, and strikethrough.
- TOC anchors are normalized after rendering so Reference Desk navigation remains reliable.


- Persistent manual library using SillyTavern's browser-side localforage storage.
- `.md` / `.markdown`, `.txt`, `.html`, `.json`, `.yaml` / `.yml`, and `.csv` imports.
- Rich Markdown rendering: headings, bold, italics, strikeout, lists, blockquotes, code, links, horizontal rules, GitHub-style pipe tables, and Unicode emoji.
- Automatic heading-based Contents navigation.
- Searches the open manual and highlights matching text.
- Recognizes `**Trigger keywords:**` and `**Keywords:**` lines.
- Trigger chips: tap the chip to copy; tap `＋` to insert the keyword into SillyTavern's message box.
- Multiple manuals as tabs.
- Mobile-friendly drawer and SillyTavern-theme-aware styling.

## Install

### Git installation
Put these files in a GitHub repository with `manifest.json` at the repository root. In SillyTavern, open **Extensions → Install Extension**, paste the repository URL, install, and reload SillyTavern.

### Manual installation
Copy this entire folder into your user's SillyTavern third-party extensions directory, then reload SillyTavern.

## Usage

1. Press the floating **📖** button.
2. Press **Open** and choose one or more manuals.
3. Use **Contents** to jump between Markdown headings.
4. Search the current manual with the search box.
5. For recognized trigger keywords, tap the keyword to copy it or tap **＋** to insert it into the current chat draft.

## Markdown convention for actionable keywords

```md
### UID 19 — Tetsuo

**Trigger keywords:** `Tetsuo`, `Mana Absorption`, `Taijutsu`

**What it contains:**
Tetsuo's reference information...
```

No proprietary document format is required.

## Notes

v0.1 intentionally does not modify World Info, inject manuals into prompts, or depend on ST Lore Organizer. It is a human-facing reference tool. A later bridge can add “Open Lore Entry” actions.


### v0.2.1 startup fix
The floating launcher is created before persistent storage is loaded, activation-hook support is restored, and storage failures no longer prevent the UI from appearing.


## v0.2.1
- Mobile viewer is now a fully opaque full-screen surface.
- Added collapsible Contents & Keywords drawer on phones.
- Reader/search/header use isolated scrolling and mobile-safe layout.
- Desktop keeps the side-index layout.
