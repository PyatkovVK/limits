# Limits repository instructions

Read and follow [AGENTS.md](../AGENTS.md) before changing code. It defines local skill discovery, platform routing, and repository conventions.

The local `skills/` directory is intentionally ignored by Git. Run `npm run setup:skills` when default skills are missing, explicitly inspect ignored `skills/**/SKILL.md` files, and load the skill relevant to the task. For application code, read `skills/platform-routing/SKILL.md`. Use the requested platform, or the current host when none is specified; shared behavior belongs in `src/common/`.
