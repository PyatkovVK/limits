# Skills / Навыки

Reference catalog for repository skill templates, in English and Russian. This file stays in `docs/skill-templates/` and is not copied into local `skills/`.
Справочный каталог шаблонов навыков проекта на английском и русском. Этот файл остаётся в `docs/skill-templates/` и не копируется в локальную папку `skills/`.

## Catalog / Каталог

| Skill ID | English name | Название на русском | Instructions / Инструкция |
| --- | --- | --- | --- |
| `platform-routing` | Platform routing | Выбор платформы для изменений | [SKILL.md](platform-routing/SKILL.md) |
| `platform-boundary` | Common/platform dependency boundary | Граница зависимостей common/platform | [SKILL.md](platform-boundary/SKILL.md) |
| `macos-architecture` | macOS module architecture | Архитектура модуля macOS | [SKILL.md](macos-architecture/SKILL.md) |
| `settings-architecture` | Shared settings architecture | Архитектура общих настроек | [SKILL.md](settings-architecture/SKILL.md) |
| `requirements-documentation` | Read-only requirements | Требования только для чтения | [SKILL.md](requirements-documentation/SKILL.md) |
| `changelog` | Changelog updates | Обновление списка изменений | [SKILL.md](changelog/SKILL.md) |
| `versionless-documentation` | Release numbers only in the changelog | Номера релизов только в списке изменений | [SKILL.md](versionless-documentation/SKILL.md) |
| `focused-pull-requests` | One task per pull request | Отдельный MR на каждую задачу | [SKILL.md](focused-pull-requests/SKILL.md) |
| `version-branches-from-main` | Version branches from main | Версионные ветки от main | [SKILL.md](version-branches-from-main/SKILL.md) |
| `test-failure-analysis` | Test and CI failure analysis | Разбор падений тестов и CI | [SKILL.md](test-failure-analysis/SKILL.md) |

**Platform routing:** selects the Linux, macOS or Windows implementation for platform-specific work. An explicit user target takes priority over the host OS; shared behavior stays in `src/common/`.

**Выбор платформы для изменений:** направляет платформенные правки в реализацию Linux, macOS или Windows. Явно указанная пользователем платформа важнее текущей ОС; общая логика остаётся в `src/common/`.

**Common/platform dependency boundary:** mirrors `src/common/` subsystem paths in platform feature directories. Platform implementations reuse common modules and the composition root `src/main.cjs` supplies platform behavior to shared code.

**Граница зависимостей common/platform:** платформенные расширения повторяют пути подсистем из `src/common/` и переиспользуют общие модули. Корень композиции `src/main.cjs` передаёт платформенное поведение общему коду.

## Folder structure / Структура папки

```text
skills/
├── platform-routing/
│   └── SKILL.md                  # Instructions / Инструкция навыка
├── platform-boundary/
│   └── SKILL.md                  # Common/platform dependency boundary / Граница зависимостей common/platform
├── macos-architecture/
│   └── SKILL.md                  # macOS module structure / Структура модуля macOS
├── settings-architecture/
│   └── SKILL.md                  # Shared settings groups / Общие группы настроек
├── requirements-documentation/
│   └── SKILL.md                  # Read-only requirements / Требования только для чтения
├── changelog/
│   └── SKILL.md                  # Record release-worthy changes / Запись изменений
├── versionless-documentation/
│   └── SKILL.md                  # Keep release numbers in the changelog / Номера релизов только в списке изменений
├── focused-pull-requests/
│   └── SKILL.md                  # Separate task branches / Отдельные ветки задач
├── version-branches-from-main/
│   └── SKILL.md                  # New version branches from main / Версионные ветки от main
└── test-failure-analysis/
    └── SKILL.md                  # Trace failures before fixes / Разбор сбоев до правок
```

Each skill's `SKILL.md` contains its full instructions. Discover those files directly in local `skills/`; no root README is generated there. Start with the repository guide at `docs/ai-skills.md` and follow local `AGENTS.md` instructions when present.

Полные правила каждого навыка находятся в его `SKILL.md`. Находите эти файлы напрямую в локальной папке `skills/`: корневой README там не создаётся. Начните с руководства `docs/ai-skills.md` и следуйте локальным инструкциям `AGENTS.md`, если файл существует.

## Adding a skill / Добавление навыка

1. Create `skills/<skill-name>/SKILL.md`. Use a lowercase name with hyphens and YAML frontmatter containing `name` and `description`.
2. Add its English name, Russian name and relative `SKILL.md` link to the table above, and update the folder tree.
3. Keep any supporting files inside that skill's folder. To share a default across machines, also maintain its tracked template under `docs/skill-templates/` and the catalog template there.

1. Создайте `skills/<skill-name>/SKILL.md`. Используйте имя строчными буквами с дефисами и YAML-заголовок с полями `name` и `description`.
2. Добавьте в таблицу выше английское и русское названия и относительную ссылку на `SKILL.md`, затем обновите дерево папок.
3. Храните дополнительные файлы внутри папки соответствующего навыка. Для общего навыка на разных компьютерах обновляйте также его версионируемый шаблон и шаблон каталога в `docs/skill-templates/`.

## Local storage / Локальное хранение

The entire local `skills/` folder is ignored by Git. This catalog remains tracked in `docs/skill-templates/`. Restore missing default files with:

Вся локальная папка `skills/` игнорируется Git. Этот каталог остаётся версионируемым в `docs/skill-templates/`. Для восстановления отсутствующих стандартных файлов выполните:

```sh
npm run setup:skills
```

Existing local files are preserved. New personal skills are discovered by their `SKILL.md` files even if the catalog has not been updated yet.

Существующие локальные файлы сохраняются. Новые личные навыки обнаруживаются по файлам `SKILL.md`, даже если каталог ещё не обновлён.
