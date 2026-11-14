# Core requirements for Limits

This directory describes the core requirements for Limits on Windows, macOS, and Linux. Shared requirements cover the details window, settings, and [accounts on all three platforms](common/accounts/accounts.md). The [Codex provider requirements](common/providers/codex.md) describe runtime independence and the future goal of fully isolated Codex account storage.

[Pluggable AI controllers](common/ai-connects.md) define how Limits connects to Codex, DeepSeek, Z.ai (GLM Coding Plan), Claude Code, and Kimi Code and how it displays their data.

[Build and release requirements](common/build-and-release.md) define short GitHub Actions workflows, mandatory `limits/*` task names, tests-only main/demo branches, cross-platform builds for ordinary branches, numeric release publication, and platform-specific npm commands.

## Editing policy

All requirements files in this directory, including translations and this README, are **read-only by default**.

Before editing, adding, deleting, renaming, or moving any of these files, describe the proposed changes, ask the user for explicit permission, and wait for approval. This applies even when “approve for me”, automatic approval, autonomous mode, or similar settings are enabled. Those settings do not replace the user's explicit permission to change requirements. Reading and reviewing the files do not require approval.

## Requirements tree

- **requirements/**
  - **common/**
    - [common.md](common/common.md) — Common requirements index
    - [architecture.md](common/architecture.md) — Shared code and platform boundaries
    - **accounts/**
      - [accounts.md](common/accounts/accounts.md) — Subscriptions and account storage on Windows, macOS, and Linux
    - **providers/**
      - [codex.md](common/providers/codex.md) — Codex account sources, authentication, and monitoring
      - [deepseek.md](common/providers/deepseek.md) — DeepSeek API-key balance provider
      - [zai.md](common/providers/zai.md) — Z.ai (GLM Coding Plan) API-key quota provider
    - [ai-connects.md](common/ai-connects.md) — Shared controller contracts and supported providers
    - [build-and-release.md](common/build-and-release.md) — Feature branch naming, branch pipelines, package verification, releases, and local build commands
    - [interface.md](common/interface.md) — Details window, settings, and appearance
    - [updates.md](common/updates.md) — Update checks, package verification, and installation
    - [privacy.md](common/privacy.md) — Data and privacy
  - **windows/**
    - [windows.md](windows/windows.md) — Windows requirements index
    - [widget.md](windows/widget.md) — Taskbar widget
    - [panel-and-tray.md](windows/panel-and-tray.md) — Tray and notifications
    - [installation.md](windows/installation.md) — Installation and startup
  - **macos/**
    - [macos.md](macos/macos.md) — macOS requirements index
    - [menu-and-panel.md](macos/menu-and-panel.md) — Menu-bar indicators
    - [notch.md](macos/notch.md) — MacBook notch
    - [installation.md](macos/installation.md) — Installation and startup
  - **linux/**
    - [linux.md](linux/linux.md) — Linux requirements index
    - [tray-and-panel.md](linux/tray-and-panel.md) — System-tray indicators
    - [installation.md](linux/installation.md) — Installation and environment
