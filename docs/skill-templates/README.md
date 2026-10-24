# Skills / Навыки

One catalog for local repository skills, in English and Russian.
Единый каталог локальных навыков проекта на английском и русском.

## Catalog / Каталог

| Skill ID | English name | Название на русском | Instructions / Инструкция |
| --- | --- | --- | --- |
| `platform-routing` | Platform routing | Выбор платформы для изменений | [SKILL.md](platform-routing/SKILL.md) |
| `changelog` | Changelog updates | Обновление списка изменений | [SKILL.md](changelog/SKILL.md) |
| `focused-pull-requests` | One task per pull request | Отдельный MR на каждую задачу | [SKILL.md](focused-pull-requests/SKILL.md) |

**Platform routing:** selects the Linux, macOS or Windows implementation for platform-specific work. An explicit user target takes priority over the host OS; shared behavior stays in `src/common/`.

**Выбор платформы для изменений:** направляет платформенные правки в реализацию Linux, macOS или Windows. Явно указанная пользователем платформа важнее текущей ОС; общая логика остаётся в `src/common/`.

## Folder structure / Структура папки

```text
skills/
├── README.md                    # Bilingual catalog / Двуязычный каталог
├── platform-routing/
│   └── SKILL.md                  # Instructions / Инструкция навыка
├── changelog/
│   └── SKILL.md                  # Record release-worthy changes / Запись изменений
└── focused-pull-requests/
    └── SKILL.md                  # Separate task branches / Отдельные ветки задач
```

`README.md` is the index; each skill's `SKILL.md` contains its full instructions. Read the linked skill before applying it. Start with the repository guide at `docs/ai-skills.md` and follow local `AGENTS.md` instructions when present.

`README.md` — оглавление; полные правила каждого навыка находятся в его `SKILL.md`. Перед применением прочитайте навык по ссылке. Начните с руководства `docs/ai-skills.md` и следуйте локальным инструкциям `AGENTS.md`, если файл существует.

## Adding a skill / Добавление навыка

1. Create `skills/<skill-name>/SKILL.md`. Use a lowercase name with hyphens and YAML frontmatter containing `name` and `description`.
2. Add its English name, Russian name and relative `SKILL.md` link to the table above, and update the folder tree.
3. Keep any supporting files inside that skill's folder. To share a default across machines, also maintain its tracked template under `docs/skill-templates/` and the catalog template there.

1. Создайте `skills/<skill-name>/SKILL.md`. Используйте имя строчными буквами с дефисами и YAML-заголовок с полями `name` и `description`.
2. Добавьте в таблицу выше английское и русское названия и относительную ссылку на `SKILL.md`, затем обновите дерево папок.
3. Храните дополнительные файлы внутри папки соответствующего навыка. Для общего навыка на разных компьютерах обновляйте также его версионируемый шаблон и шаблон каталога в `docs/skill-templates/`.

## Local storage / Локальное хранение

The entire `skills/` folder, including this README, is ignored by Git. Restore missing default files with:

Вся папка `skills/`, включая этот README, игнорируется Git. Для восстановления отсутствующих стандартных файлов выполните:

```sh
npm run setup:skills
```

Existing local files are preserved. New personal skills are discovered by their `SKILL.md` files even if the catalog has not been updated yet.

Существующие локальные файлы сохраняются. Новые личные навыки обнаруживаются по файлам `SKILL.md`, даже если каталог ещё не обновлён.
