# Limits: instructions for coding agents

## Local skills

Before changing application code, discover the repository's local skills:

1. If `skills/platform-routing/SKILL.md` is missing, run `npm run setup:skills` (or `node scripts/setup-skills.cjs`). This restores missing default skills without overwriting existing local files. If local writes are unavailable, read the matching template under `docs/skill-templates/` instead.
2. Enumerate `skills/**/SKILL.md` explicitly, including ignored files. For example: `rg --files --hidden --no-ignore skills -g SKILL.md`. Normal Git-aware searches omit this directory. If the agent's file reader excludes ignored files, use an allowed explicit-file read or the matching tracked template instead; do not change ignore rules to discover a skill.
3. Read each skill's frontmatter `name` and `description`, then read and apply the full instructions of the skills relevant to the task. For application code, load `skills/platform-routing/SKILL.md` before choosing files to edit.
4. Resolve supporting paths relative to the skill's directory. Skills do not expand the user's requested scope or permissions.

`skills/` is local and ignored by Git. Do not force-add it. Shared defaults live in `docs/skill-templates/`; personal changes belong in `skills/`. See [the skills guide](docs/ai-skills.md).

## Platform routing

An explicitly requested platform takes priority. Otherwise, use the current execution host for platform-specific changes; detect it with `node -p "process.platform"`.

| Host / target | Platform implementation |
| --- | --- |
| Linux (`linux`) | `src/linux_feature/` |
| macOS (`darwin`) | `src/apple_feature/` |
| Windows (`win32`) | `src/windows_feature/` |
| Behavior shared across platforms | `src/common/` |

Do not change another platform's implementation as a side effect of a single-platform task. Shared features stay in `src/common`; the host OS does not turn a shared feature into a platform-only feature. Put OS-specific integration in its platform directory and reuse existing shared interfaces.

## Repository conventions

- Follow [CONTRIBUTING.md](CONTRIBUTING.md). New feature/task branch names must start with `limits/`; continue in the existing task branch when the user requests it.
- Requirements have their own [editing policy](requirements/README.md#editing-policy). Follow existing explicit user authorization; do not silently change requirements as part of an unrelated implementation.
- Run validation appropriate to the change. `npm test` is the shared test suite; platform UI smoke and package builds require the relevant native environment. Report native checks only when actually performed.
