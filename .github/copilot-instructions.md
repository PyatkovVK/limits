# Limits repository instructions

Read [the local skills guide](../docs/ai-skills.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) before changing code. Follow local `AGENTS.md` instructions when present; personal agent configuration is not included in a fresh clone.

The local `skills/` directory is intentionally ignored by Git. Run `npm run setup:skills` when default skills are missing, explicitly inspect ignored `skills/**/SKILL.md` files, and load the skill relevant to the task. For application code, read `skills/platform-routing/SKILL.md`. Use the requested platform, or the current host when none is specified; shared behavior belongs in `src/common/`.
