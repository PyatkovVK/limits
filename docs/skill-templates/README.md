# Skills

Reference catalog for repository skill templates. This file stays in `docs/skill-templates/` and is not copied into local `skills/`.

## Catalog

| Skill ID | Name | Instructions |
| --- | --- | --- |
| `platform-routing` | Platform routing | [SKILL.md](platform-routing/SKILL.md) |
| `platform-boundary` | Common/platform dependency boundary | [SKILL.md](platform-boundary/SKILL.md) |
| `macos-architecture` | macOS module architecture | [SKILL.md](macos-architecture/SKILL.md) |
| `settings-architecture` | Shared settings architecture | [SKILL.md](settings-architecture/SKILL.md) |
| `requirements-documentation` | Read-only requirements | [SKILL.md](requirements-documentation/SKILL.md) |
| `changelog` | Changelog updates | [SKILL.md](changelog/SKILL.md) |
| `versionless-documentation` | Release numbers in text and package metadata | [SKILL.md](versionless-documentation/SKILL.md) |
| `focused-pull-requests` | One task per pull request | [SKILL.md](focused-pull-requests/SKILL.md) |
| `version-branches-from-main` | Version branches from main | [SKILL.md](version-branches-from-main/SKILL.md) |
| `test-failure-analysis` | Test and CI failure analysis | [SKILL.md](test-failure-analysis/SKILL.md) |

**Platform routing:** selects the Linux, macOS or Windows implementation for platform-specific work. An explicit user target takes priority over the host OS; shared behavior stays in `src/common/`.

**Common/platform dependency boundary:** checks that each platform uses its own feature directory and `src/common/` during startup, rendering, and packaging. The composition root `src/main.cjs` supplies the active platform's capabilities to shared code.

## Folder structure

```text
skills/
├── platform-routing/
│   └── SKILL.md
├── platform-boundary/
│   └── SKILL.md
├── macos-architecture/
│   └── SKILL.md
├── settings-architecture/
│   └── SKILL.md
├── requirements-documentation/
│   └── SKILL.md
├── changelog/
│   └── SKILL.md
├── versionless-documentation/
│   └── SKILL.md
├── focused-pull-requests/
│   └── SKILL.md
├── version-branches-from-main/
│   └── SKILL.md
└── test-failure-analysis/
    └── SKILL.md
```

Each skill's `SKILL.md` contains its full instructions. Discover those files directly in local `skills/`; no root README is generated there. Start with the repository guide at `docs/ai-skills.md` and follow local `AGENTS.md` instructions when present.

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md`. Use a lowercase name with hyphens and YAML frontmatter containing `name` and `description`.
2. Add its name and relative `SKILL.md` link to the table above, and update the folder tree.
3. Keep any supporting files inside that skill's folder. To share a default across machines, also maintain its tracked template under `docs/skill-templates/` and the catalog template there.

## Local storage

The entire local `skills/` folder is ignored by Git. This catalog remains tracked in `docs/skill-templates/`. Restore missing default files with:

```sh
npm run setup:skills
```

Existing local files are preserved. New personal skills are discovered by their `SKILL.md` files even if the catalog has not been updated yet.
