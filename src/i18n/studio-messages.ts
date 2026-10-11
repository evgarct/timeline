import type { Locale } from "./config";

const ru = {
  feedback: {
    title: "Фидбек агентов", eyebrow: "Агенты", empty: "Агенты пока ничего не прислали", emptyHint: "Когда агент через MCP или WebMCP отправит замечание, оно появится здесь.", loadError: "Не удалось загрузить фидбек",
    allStatuses: "Все статусы", allCategories: "Все типы", details: "Что произошло", expected: "Ожидал", suggestion: "Предложение",
    calls: "Вызовы", client: "Клиент", tool: "Инструмент", resolution: "Заметка о решении", saveResolution: "Сохранить",
    statuses: { new: "Новое", triaged: "Разбираем", done: "Сделано", wontfix: "Не будем" } as Record<string, string>,
    categories: { bug: "Ошибка", friction: "Неудобно", missing_tool: "Не хватает", works_well: "Работает", suggestion: "Идея", other: "Другое" } as Record<string, string>,
    severities: { low: "низкая", medium: "средняя", high: "высокая" } as Record<string, string>,
    sources: { mcp: "MCP", webmcp: "WebMCP", rest: "REST" } as Record<string, string>,
    outcomes: { ok: "ок", error: "ошибка", confusing: "непонятно" } as Record<string, string>
  },
  agent: {
    chip: "Агент", history: "Действия агента", empty: "Агент пока ничего не делал", confirmTitle: "Агент просит подтверждения",
    allow: "Разрешить", deny: "Отклонить", remember: "Больше не спрашивать про сохранение шаблонов",
    saveConfirm: "Агент хочет сохранить шаблон «{name}»", actionConfirm: "Агент хочет выполнить: {action}",
    leaveConfirm: "Агент хочет открыть другую страницу. Несохранённые правки будут потеряны.",
    allowSaveOn: "Агент меняет данные без вопросов", allowSaveOff: "Агент спрашивает перед изменением данных", close: "Закрыть",
    actions: {
      studio_navigate: "Открыл страницу", builder_set_name: "Назвал шаблон", builder_add_exercise: "Добавил упражнение",
      builder_create_exercise: "Создал упражнение", builder_remove_exercise: "Убрал упражнение", builder_move_exercise: "Переставил упражнение",
      builder_update_exercise: "Изменил упражнение", builder_link_superset: "Изменил суперсет", builder_undo: "Отменил изменение",
      builder_redo: "Вернул изменение", builder_save: "Сохранил шаблон", dashboard_select_week: "Выбрал неделю", dashboard_select_exercise: "Выбрал упражнение",
      record_workout_session: "Записал тренировку", update_workout_session: "Исправил тренировку", delete_workout_session: "Удалил тренировку",
      upsert_workout_template: "Сохранил шаблон", rename_workout_template: "Переименовал шаблон", duplicate_workout_template: "Дублировал шаблон",
      delete_workout_template: "Удалил шаблон", upsert_exercise: "Сохранил упражнение"
    } as Record<string, string>
  },
  nav: { dashboard: "Обзор", templates: "Шаблоны", feedback: "Фидбек", today: "Сегодня", theme: "Тема" },
  common: { save: "Сохранить", saving: "Сохраняем…", saved: "Сохранено", cancel: "Отмена", delete: "Удалить", edit: "Править", retry: "Повторить", loading: "Загрузка…", empty: "Пока пусто", sets: "подходов", kg: "кг", reps: "повт.", exercises: "упражнений", sessions: "тренировок", undo: "Отменить", redo: "Вернуть" },
  templates: {
    title: "Шаблоны тренировок", eyebrow: "Силовые", new: "Новый шаблон", empty: "Шаблонов пока нет", emptyHint: "Собери первый в билдере — он сразу появится в приложении.", open: "Открыть билдер",
    deleteConfirm: "Удалить шаблон?", loadError: "Не удалось загрузить шаблоны"
  },
  builder: {
    namePlaceholder: "Название тренировки", catalog: "Каталог", search: "Найти упражнение", all: "Все", muscle: "Мышца", equipment: "Инвентарь", pattern: "Движение",
    noResults: "Ничего не найдено", create: "Создать", add: "Добавить", canvasEmpty: "Добавь упражнения слева", canvasEmptyHint: "Клик по карточке или ⌘K",
    sets: "Подходы", weight: "Вес", repMin: "Повт. от", repMax: "Повт. до", rir: "RIR", progression: "Прогрессия +кг", note: "Заметка", superset: "Суперсет", linkNext: "Связать со следующим", unlink: "Разорвать суперсет", remove: "Убрать",
    summary: "Сводка", totalSets: "Всего подходов", musclesTitle: "Подходов на мышцу", secondaryHint: "Вторичные мышцы считаются за половину",
    unsaved: "Есть несохранённые изменения", leaveConfirm: "Несохранённые изменения будут потеряны. Уйти?", saveFailed: "Не удалось сохранить", unknownExercise: "Упражнение не найдено в каталоге", nameRequired: "Введи название", exercisesRequired: "Добавь хотя бы одно упражнение",
    palette: "Быстро добавить упражнение", dragHint: "Перетащи, чтобы изменить порядок", instructions: "Техника",
    newExercise: "Новое упражнение", exerciseName: "Название упражнения", primaryMuscle: "Основная мышца", creating: "Создаём…", createFailed: "Не удалось создать упражнение", createExerciseFor: "Создать упражнение", dropHere: "Отпусти, чтобы добавить сюда",
    collapseCatalog: "Свернуть каталог", expandCatalog: "Показать каталог", openDetail: "Подробнее об упражнении", closeDetail: "Закрыть",
    coachNote: "Заметка тренера", noTechnique: "Описание техники пока не добавлено", videoTitle: "Видео", videoPlay: "Смотреть видео", videoLink: "Ссылка на YouTube",
    videoSave: "Сохранить ссылку", videoSaved: "Ссылка на видео сохранена", videoInvalid: "Нужна ссылка на YouTube", videoFailed: "Не удалось сохранить ссылку",
    templatesAll: "Все шаблоны", switchTemplate: "Другой шаблон", newTemplate: "Новый шаблон", primaryMuscles: "Основные мышцы", secondaryMuscles: "Вторичные", addToTemplate: "Добавить в шаблон"
  },
  dashboard: {
    title: "Обзор тренировок", eyebrow: "Силовые", weekSets: "Подходов за неделю", tonnage: "Тоннаж", sessions: "Тренировок", bestE1rm: "Лучший e1RM", volume: "Объём по мышцам", volumeHint: "Подходов в неделю; вторичные — за половину",
    heatmap: "Нагрузка недели", strength: "Силовой прогресс", strengthHint: "Оценка 1ПМ по формуле Эпли", pickExercise: "Упражнение", history: "История", consistency: "Регулярность", lastWeeks: "недель", noData: "Нет данных за период",
    thisWeek: "Эта неделя", lastWeek: "Прошлая", loadError: "Не удалось загрузить данные", startFromTemplate: "Начни по шаблону"
  },
  muscles: { chest: "Грудь", lats: "Широчайшие", "upper back": "Верх спины", "lower back": "Поясница", shoulders: "Плечи", biceps: "Бицепс", triceps: "Трицепс", forearms: "Предплечья", abs: "Пресс", obliques: "Косые", quads: "Квадрицепс", hamstrings: "Бицепс бедра", glutes: "Ягодицы", calves: "Икры", adductors: "Приводящие", abductors: "Отводящие", traps: "Трапеции", neck: "Шея", other: "Прочее" } as Record<string, string>
};

type StudioCopy = typeof ru;

const en: StudioCopy = {
  feedback: {
    title: "Agent feedback", eyebrow: "Agents", empty: "Agents haven't sent anything yet", emptyHint: "When an agent reports through MCP or WebMCP, it shows up here.", loadError: "Couldn't load feedback",
    allStatuses: "All statuses", allCategories: "All types", details: "What happened", expected: "Expected", suggestion: "Suggestion",
    calls: "Calls", client: "Client", tool: "Tool", resolution: "Resolution note", saveResolution: "Save",
    statuses: { new: "New", triaged: "In progress", done: "Done", wontfix: "Won't fix" } as Record<string, string>,
    categories: { bug: "Bug", friction: "Friction", missing_tool: "Missing", works_well: "Works well", suggestion: "Idea", other: "Other" } as Record<string, string>,
    severities: { low: "low", medium: "medium", high: "high" } as Record<string, string>,
    sources: { mcp: "MCP", webmcp: "WebMCP", rest: "REST" } as Record<string, string>,
    outcomes: { ok: "ok", error: "error", confusing: "confusing" } as Record<string, string>
  },
  agent: {
    chip: "Agent", history: "Agent activity", empty: "The agent hasn't done anything yet", confirmTitle: "The agent asks for approval",
    allow: "Allow", deny: "Decline", remember: "Don't ask again before saving templates",
    saveConfirm: "The agent wants to save the template “{name}”", actionConfirm: "The agent wants to: {action}",
    leaveConfirm: "The agent wants to open another page. Unsaved changes will be lost.",
    allowSaveOn: "The agent changes data without asking", allowSaveOff: "The agent asks before changing data", close: "Close",
    actions: {
      studio_navigate: "Opened a page", builder_set_name: "Named the template", builder_add_exercise: "Added an exercise",
      builder_create_exercise: "Created an exercise", builder_remove_exercise: "Removed an exercise", builder_move_exercise: "Moved an exercise",
      builder_update_exercise: "Changed an exercise", builder_link_superset: "Changed a superset", builder_undo: "Undid a change",
      builder_redo: "Redid a change", builder_save: "Saved the template", dashboard_select_week: "Selected a week", dashboard_select_exercise: "Selected an exercise",
      record_workout_session: "Logged a workout", update_workout_session: "Corrected a workout", delete_workout_session: "Deleted a workout",
      upsert_workout_template: "Saved a template", rename_workout_template: "Renamed a template", duplicate_workout_template: "Duplicated a template",
      delete_workout_template: "Deleted a template", upsert_exercise: "Saved an exercise"
    } as Record<string, string>
  },
  nav: { dashboard: "Overview", templates: "Templates", feedback: "Feedback", today: "Today", theme: "Theme" },
  common: { save: "Save", saving: "Saving…", saved: "Saved", cancel: "Cancel", delete: "Delete", edit: "Edit", retry: "Retry", loading: "Loading…", empty: "Nothing here yet", sets: "sets", kg: "kg", reps: "reps", exercises: "exercises", sessions: "sessions", undo: "Undo", redo: "Redo" },
  templates: {
    title: "Workout templates", eyebrow: "Strength", new: "New template", empty: "No templates yet", emptyHint: "Build the first one in the builder — it shows up in the app right away.", open: "Open builder",
    deleteConfirm: "Delete this template?", loadError: "Couldn't load templates"
  },
  builder: {
    namePlaceholder: "Workout name", catalog: "Catalog", search: "Find an exercise", all: "All", muscle: "Muscle", equipment: "Equipment", pattern: "Movement",
    noResults: "Nothing found", create: "Create", add: "Add", canvasEmpty: "Add exercises from the left", canvasEmptyHint: "Click a card or press ⌘K",
    sets: "Sets", weight: "Weight", repMin: "Reps from", repMax: "Reps to", rir: "RIR", progression: "Progression +kg", note: "Note", superset: "Superset", linkNext: "Link with next", unlink: "Break superset", remove: "Remove",
    summary: "Summary", totalSets: "Total sets", musclesTitle: "Sets per muscle", secondaryHint: "Secondary muscles count as half",
    unsaved: "Unsaved changes", leaveConfirm: "Unsaved changes will be lost. Leave?", saveFailed: "Couldn't save", unknownExercise: "Exercise not found in the catalog", nameRequired: "Enter a name", exercisesRequired: "Add at least one exercise",
    palette: "Quick-add an exercise", dragHint: "Drag to reorder", instructions: "Technique",
    newExercise: "New exercise", exerciseName: "Exercise name", primaryMuscle: "Primary muscle", creating: "Creating…", createFailed: "Couldn't create the exercise", createExerciseFor: "Create exercise", dropHere: "Drop to add here",
    collapseCatalog: "Collapse catalog", expandCatalog: "Show catalog", openDetail: "Exercise details", closeDetail: "Close",
    coachNote: "Coach's note", noTechnique: "No technique description yet", videoTitle: "Video", videoPlay: "Play video", videoLink: "YouTube link",
    videoSave: "Save link", videoSaved: "Video link saved", videoInvalid: "Enter a YouTube link", videoFailed: "Couldn't save the link",
    templatesAll: "All templates", switchTemplate: "Another template", newTemplate: "New template", primaryMuscles: "Primary muscles", secondaryMuscles: "Secondary", addToTemplate: "Add to template"
  },
  dashboard: {
    title: "Training overview", eyebrow: "Strength", weekSets: "Sets this week", tonnage: "Tonnage", sessions: "Sessions", bestE1rm: "Best e1RM", volume: "Volume by muscle", volumeHint: "Sets per week; secondary muscles count as half",
    heatmap: "Weekly load", strength: "Strength progress", strengthHint: "Estimated 1RM, Epley formula", pickExercise: "Exercise", history: "History", consistency: "Consistency", lastWeeks: "weeks", noData: "No data for this period",
    thisWeek: "This week", lastWeek: "Last", loadError: "Couldn't load data", startFromTemplate: "Start from a template"
  },
  muscles: { chest: "Chest", lats: "Lats", "upper back": "Upper back", "lower back": "Lower back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", obliques: "Obliques", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", adductors: "Adductors", abductors: "Abductors", traps: "Traps", neck: "Neck", other: "Other" }
};

const cs: StudioCopy = {
  feedback: {
    title: "Zpětná vazba agentů", eyebrow: "Agenti", empty: "Agenti zatím nic neposlali", emptyHint: "Až agent nahlásí poznámku přes MCP nebo WebMCP, objeví se zde.", loadError: "Zpětnou vazbu se nepodařilo načíst",
    allStatuses: "Všechny stavy", allCategories: "Všechny typy", details: "Co se stalo", expected: "Očekával", suggestion: "Návrh",
    calls: "Volání", client: "Klient", tool: "Nástroj", resolution: "Poznámka k řešení", saveResolution: "Uložit",
    statuses: { new: "Nové", triaged: "Řešíme", done: "Hotovo", wontfix: "Nebudeme" } as Record<string, string>,
    categories: { bug: "Chyba", friction: "Nepohodlné", missing_tool: "Chybí", works_well: "Funguje", suggestion: "Nápad", other: "Jiné" } as Record<string, string>,
    severities: { low: "nízká", medium: "střední", high: "vysoká" } as Record<string, string>,
    sources: { mcp: "MCP", webmcp: "WebMCP", rest: "REST" } as Record<string, string>,
    outcomes: { ok: "ok", error: "chyba", confusing: "nejasné" } as Record<string, string>
  },
  agent: {
    chip: "Agent", history: "Akce agenta", empty: "Agent zatím nic neudělal", confirmTitle: "Agent žádá o schválení",
    allow: "Povolit", deny: "Odmítnout", remember: "Před ukládáním šablon se příště neptat",
    saveConfirm: "Agent chce uložit šablonu „{name}“", actionConfirm: "Agent chce provést: {action}",
    leaveConfirm: "Agent chce otevřít jinou stránku. Neuložené změny budou ztraceny.",
    allowSaveOn: "Agent mění data bez ptaní", allowSaveOff: "Agent se před změnou dat ptá", close: "Zavřít",
    actions: {
      studio_navigate: "Otevřel stránku", builder_set_name: "Pojmenoval šablonu", builder_add_exercise: "Přidal cvik",
      builder_create_exercise: "Vytvořil cvik", builder_remove_exercise: "Odebral cvik", builder_move_exercise: "Přesunul cvik",
      builder_update_exercise: "Změnil cvik", builder_link_superset: "Změnil superset", builder_undo: "Vrátil změnu",
      builder_redo: "Obnovil změnu", builder_save: "Uložil šablonu", dashboard_select_week: "Vybral týden", dashboard_select_exercise: "Vybral cvik",
      record_workout_session: "Zapsal trénink", update_workout_session: "Opravil trénink", delete_workout_session: "Smazal trénink",
      upsert_workout_template: "Uložil šablonu", rename_workout_template: "Přejmenoval šablonu", duplicate_workout_template: "Duplikoval šablonu",
      delete_workout_template: "Smazal šablonu", upsert_exercise: "Uložil cvik"
    } as Record<string, string>
  },
  nav: { dashboard: "Přehled", templates: "Šablony", feedback: "Zpětná vazba", today: "Dnes", theme: "Motiv" },
  common: { save: "Uložit", saving: "Ukládám…", saved: "Uloženo", cancel: "Zrušit", delete: "Smazat", edit: "Upravit", retry: "Zkusit znovu", loading: "Načítání…", empty: "Zatím prázdné", sets: "sérií", kg: "kg", reps: "opak.", exercises: "cviků", sessions: "tréninků", undo: "Zpět", redo: "Znovu" },
  templates: {
    title: "Tréninkové šablony", eyebrow: "Síla", new: "Nová šablona", empty: "Zatím žádné šablony", emptyHint: "Vytvoř první v builderu — hned se objeví v aplikaci.", open: "Otevřít builder",
    deleteConfirm: "Smazat šablonu?", loadError: "Šablony se nepodařilo načíst"
  },
  builder: {
    namePlaceholder: "Název tréninku", catalog: "Katalog", search: "Najít cvik", all: "Vše", muscle: "Sval", equipment: "Vybavení", pattern: "Pohyb",
    noResults: "Nic nenalezeno", create: "Vytvořit", add: "Přidat", canvasEmpty: "Přidej cviky zleva", canvasEmptyHint: "Klikni na kartu nebo ⌘K",
    sets: "Série", weight: "Váha", repMin: "Opak. od", repMax: "Opak. do", rir: "RIR", progression: "Progrese +kg", note: "Poznámka", superset: "Superset", linkNext: "Spojit s dalším", unlink: "Zrušit superset", remove: "Odebrat",
    summary: "Souhrn", totalSets: "Sérií celkem", musclesTitle: "Sérií na sval", secondaryHint: "Vedlejší svaly se počítají za půlku",
    unsaved: "Neuložené změny", leaveConfirm: "Neuložené změny budou ztraceny. Odejít?", saveFailed: "Uložení se nepodařilo", unknownExercise: "Cvik nebyl v katalogu nalezen", nameRequired: "Zadej název", exercisesRequired: "Přidej alespoň jeden cvik",
    palette: "Rychle přidat cvik", dragHint: "Přetažením změníš pořadí", instructions: "Technika",
    newExercise: "Nový cvik", exerciseName: "Název cviku", primaryMuscle: "Hlavní sval", creating: "Vytvářím…", createFailed: "Cvik se nepodařilo vytvořit", createExerciseFor: "Vytvořit cvik", dropHere: "Pusť pro přidání sem",
    collapseCatalog: "Sbalit katalog", expandCatalog: "Zobrazit katalog", openDetail: "Podrobnosti cviku", closeDetail: "Zavřít",
    coachNote: "Poznámka trenéra", noTechnique: "Popis techniky zatím není", videoTitle: "Video", videoPlay: "Přehrát video", videoLink: "Odkaz na YouTube",
    videoSave: "Uložit odkaz", videoSaved: "Odkaz na video uložen", videoInvalid: "Zadej odkaz na YouTube", videoFailed: "Odkaz se nepodařilo uložit",
    templatesAll: "Všechny šablony", switchTemplate: "Jiná šablona", newTemplate: "Nová šablona", primaryMuscles: "Hlavní svaly", secondaryMuscles: "Vedlejší", addToTemplate: "Přidat do šablony"
  },
  dashboard: {
    title: "Přehled tréninku", eyebrow: "Síla", weekSets: "Sérií tento týden", tonnage: "Tonáž", sessions: "Tréninků", bestE1rm: "Nejlepší e1RM", volume: "Objem podle svalů", volumeHint: "Sérií týdně; vedlejší svaly za půlku",
    heatmap: "Zátěž týdne", strength: "Silový progres", strengthHint: "Odhad 1RM, Epleyho vzorec", pickExercise: "Cvik", history: "Historie", consistency: "Pravidelnost", lastWeeks: "týdnů", noData: "Za toto období žádná data",
    thisWeek: "Tento týden", lastWeek: "Minulý", loadError: "Data se nepodařilo načíst", startFromTemplate: "Začni ze šablony"
  },
  muscles: { chest: "Prsa", lats: "Široký sval zádový", "upper back": "Horní záda", "lower back": "Spodní záda", shoulders: "Ramena", biceps: "Biceps", triceps: "Triceps", forearms: "Předloktí", abs: "Břicho", obliques: "Šikmé břišní", quads: "Quadriceps", hamstrings: "Zadní stehna", glutes: "Hýždě", calves: "Lýtka", adductors: "Přitahovače", abductors: "Odtahovače", traps: "Trapézy", neck: "Krk", other: "Ostatní" }
};

const studioMessages: Record<Locale, StudioCopy> = { ru, en, cs };

export type { StudioCopy };
export const getStudioCopy = (locale: Locale): StudioCopy => studioMessages[locale];
export const muscleLabel = (copy: StudioCopy, muscle: string) => copy.muscles[muscle] ?? muscle;
