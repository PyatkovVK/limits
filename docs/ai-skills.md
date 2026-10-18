# Local AI skills

Keep local skills in `skills/<name>/SKILL.md`. The root `/skills/` directory is ignored by Git, including supporting scripts/assets, so personal skills and edits are not committed or pushed.

`skills/README.md` is the single English/Russian catalog with skill names, links to their instructions, the folder tree and instructions for adding skills. Its tracked source is [the catalog template](skill-templates/README.md). Agents read the catalog and also discover `SKILL.md` files so new personal skills are not missed.

Run this once after cloning, or whenever a default skill is missing:

```sh
npm run setup:skills
```

The command copies missing files from tracked `docs/skill-templates/` into local `skills/`. It uses only Node's standard library, works before `npm install`, and never overwrites existing local files. Defaults can be restored by running it again after removing the local file you want to restore. New personal skills can be added directly under `skills/` with YAML `name` and `description` frontmatter and Markdown instructions. Supporting files are resolved relative to the skill folder.

The bundled `platform-routing` skill selects Linux → `src/linux_feature/`, macOS → `src/apple_feature/`, and Windows → `src/windows_feature/`. It detects the execution host when no target is specified; an explicit user target takes precedence. Shared behavior stays in `src/common`, and the skill does not expand a single-platform task into changes for every platform.

## How agents find the skills

Start with this guide and [CONTRIBUTING.md](../CONTRIBUTING.md), restore missing defaults, then read `skills/README.md` and the relevant skill before choosing implementation files. Discover every skill explicitly, including personal skills absent from the catalog. A normal Git-aware search will not list `skills/`; use, for example:

```sh
rg --files --hidden --no-ignore skills -g SKILL.md
```

If an agent's file reader excludes ignored files, use an explicit named-file read allowed by that tool or read the tracked default template instead. Personal skills without a tracked template can be supplied to such an agent as context.

Personal `AGENTS.md`, `CLAUDE.md`, and `.cursor/` configuration are ignored by Git and may be supplied locally. Follow their instructions when present; they are not restored by `npm run setup:skills` or included in a fresh clone. For example, a local `CLAUDE.md` can import `AGENTS.md`, and a local `.cursor/rules/project-skills.mdc` can point to it.

The tracked [GitHub Copilot instructions](../.github/copilot-instructions.md) point to this guide and the contributing conventions, so they also work without personal agent files.

These are readable instructions rather than an OS permission boundary. No single filename guarantees automatic loading in every AI product or configuration. For an agent without instruction-file discovery, give it this initial instruction: **“Read docs/ai-skills.md and CONTRIBUTING.md, follow local AGENTS.md when present, discover the local skills, and apply the relevant SKILL.md before changing code.”** Agents without access to the repository files need those files supplied as context.
