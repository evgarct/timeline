import type { Locale } from "./config";

const ru = {
  nav: { dashboard: "Обзор", templates: "Шаблоны", today: "Сегодня", theme: "Тема" },
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
    palette: "Быстро добавить упражнение", dragHint: "Перетащи, чтобы изменить порядок", instructions: "Техника"
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
  nav: { dashboard: "Overview", templates: "Templates", today: "Today", theme: "Theme" },
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
    palette: "Quick-add an exercise", dragHint: "Drag to reorder", instructions: "Technique"
  },
  dashboard: {
    title: "Training overview", eyebrow: "Strength", weekSets: "Sets this week", tonnage: "Tonnage", sessions: "Sessions", bestE1rm: "Best e1RM", volume: "Volume by muscle", volumeHint: "Sets per week; secondary muscles count as half",
    heatmap: "Weekly load", strength: "Strength progress", strengthHint: "Estimated 1RM, Epley formula", pickExercise: "Exercise", history: "History", consistency: "Consistency", lastWeeks: "weeks", noData: "No data for this period",
    thisWeek: "This week", lastWeek: "Last", loadError: "Couldn't load data", startFromTemplate: "Start from a template"
  },
  muscles: { chest: "Chest", lats: "Lats", "upper back": "Upper back", "lower back": "Lower back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", obliques: "Obliques", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", adductors: "Adductors", abductors: "Abductors", traps: "Traps", neck: "Neck", other: "Other" }
};

const cs: StudioCopy = {
  nav: { dashboard: "Přehled", templates: "Šablony", today: "Dnes", theme: "Motiv" },
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
    palette: "Rychle přidat cvik", dragHint: "Přetažením změníš pořadí", instructions: "Technika"
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
