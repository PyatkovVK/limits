---
name: requirements-documentation
description: Treat the requirements/ directory as read-only documentation. Apply before editing, adding, deleting, renaming or moving any requirements file; describe the change and ask the user for explicit permission first.
---

# Keep requirements read-only

The `requirements/` directory is read-only documentation: it describes the core Limits requirements for common features and the Windows, macOS and Linux specifics. Start by reading `requirements/README.md`, which lists the requirements tree and the editing policy.

Before editing, adding, deleting, renaming or moving any file under `requirements/` (including translations and `requirements/README.md`), describe the proposed change, ask the user for explicit permission, and wait for approval. This applies even when "approve for me", automatic approval, autonomous mode or similar settings are enabled; those settings do not replace the user's explicit permission to change requirements. Reading and reviewing the files require no approval.

When the user authorizes a change, keep it minimal and limited to the requested file and purpose. Add, remove or move a file only as part of the authorized change, and update the requirements tree in `requirements/README.md` accordingly. Keep English and Russian text aligned, and follow [versionless-documentation](../versionless-documentation/SKILL.md) for any release-number wording.

Maintain this tracked template and its catalog entry so `npm run setup:skills` can restore the skill in local `skills/`. Repository instructions and text cleanup do not need a product changelog entry.
