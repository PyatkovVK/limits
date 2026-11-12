# Core requirements for Limits

This directory describes the core requirements for the Limits application: common features and Windows, macOS, and Linux specifics. Requirements for the details window, its content, and settings are in common. Runtime independence and the separate future goal of fully isolated Codex account storage are described in [common/accounts/codex.md](common/accounts/codex.md).

[Pluggable AI controllers](common/ai-connects.md) describe the connection infrastructure in `src/common/ai-connects/`, a common data/display contract, and the Codex, DeepSeek, and Z.ai (GLM Coding Plan) providers.

[Build and release requirements](common/build-and-release.md) define short GitHub Actions workflows, mandatory `limits/*` task names, tests-only main/demo branches, cross-platform builds for ordinary branches, numeric release publication, and platform-specific npm commands.

## Editing policy

All requirements files in this directory, including translations and this README, are **read-only by default**.

Before editing, adding, deleting, renaming, or moving any of these files, describe the proposed changes, ask the user for explicit permission, and wait for approval. This applies even when “approve for me”, automatic approval, autonomous mode, or similar settings are enabled. Those settings do not replace the user's explicit permission to change requirements. Reading and reviewing the files do not require approval.

## Requirements tree

- **requirements/**
  - **common/**
    - [common.md](common/common.md) — Common requirements index
    - **accounts/**
      - [accounts.md](common/accounts/accounts.md) — Account storage and authentication index
      - [codex.md](common/accounts/codex.md) — Codex accounts and authentication
    - **providers/**
      - [deepseek.md](common/providers/deepseek.md) — DeepSeek API-key balance provider
      - [zai.md](common/providers/zai.md) — Z.ai (GLM Coding Plan) API-key quota provider
    - [ai-connects.md](common/ai-connects.md) — Shared AI controllers, data/display contracts, and the Codex, DeepSeek, and Z.ai providers
    - [build-and-release.md](common/build-and-release.md) — Feature branch naming, branch pipelines, package verification, releases, and local build commands
    - [interface.md](common/interface.md) — Details window, settings, and appearance
    - [updates.md](common/updates.md) — Update checks and opening GitHub releases
    - [privacy.md](common/privacy.md) — Data and privacy
  - **windows/**
    - [widget.md](windows/widget.md) — Taskbar widget
    - [panel-and-tray.md](windows/panel-and-tray.md) — Tray and notifications
    - [installation.md](windows/installation.md) — Installation and startup
  - **macos/**
    - [menu-and-panel.md](macos/menu-and-panel.md) — Menu-bar indicators
    - [notch.md](macos/notch.md) — MacBook notch
    - [installation.md](macos/installation.md) — Installation and startup
  - **linux/**
    - [tray-and-panel.md](linux/tray-and-panel.md) — System-tray indicators
    - [installation.md](linux/installation.md) — Installation and environment
