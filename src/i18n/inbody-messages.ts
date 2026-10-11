import type { Locale } from "./config";
import type { InBodyCategory, InBodySegment } from "@/domain/inbody-catalog";

/** Everything visible about InBody tests: the sheet on the event page, the timeline row and the Studio Body page. */
export interface InBodyCopy {
  title: string;
  original: string;
  openOriginal: string;
  noOriginal: string;
  reviewed: string;
  notReviewed: string;
  sinceLast: string;
  sinceFirst: string;
  reference: string;
  evaluation: { under: string; normal: string; over: string };
  sections: Record<InBodyCategory, string>;
  segments: Record<InBodySegment, string>;
  frequency: string;
  showAll: string;
  headline: string;
  metrics: Record<string, string>;
  exercises: Record<string, string>;
  body: {
    eyebrow: string;
    title: string;
    metric: string;
    tests: string;
    first: string;
    latest: string;
    change: string;
    between: string;
    days: string;
    dietLogged: string;
    noDiet: string;
    avgKcal: string;
    protein: string;
    fat: string;
    carbs: string;
    steps: string;
    noSteps: string;
    workouts: string;
    sets: string;
    tonnage: string;
    photos: string;
    measurements: string;
    openSheet: string;
    loadError: string;
    empty: string;
    emptyHint: string;
    chartTrend: string;
    oneTest: string;
    daysFromTest: string;
    /** Tape-measurement keys of a `measurements` event. */
    tape: Record<string, string>;
  };
}

const en: InBodyCopy = {
  title: "InBody test",
  original: "Original report",
  openOriginal: "Open original",
  noOriginal: "No original file",
  reviewed: "Checked",
  notReviewed: "Not checked yet",
  sinceLast: "since the previous test",
  sinceFirst: "since the first test",
  reference: "Normal range",
  evaluation: { under: "Below", normal: "Normal", over: "Above" },
  sections: {
    composition: "Body composition", obesity: "Obesity analysis", control: "Weight control", research: "Research parameters",
    segmental_lean: "Segmental lean analysis", segmental_fat: "Segmental fat analysis", impedance: "Impedance", exercise: "Calories burned in 30 minutes", other: "Other"
  },
  segments: { left_arm: "Left arm", right_arm: "Right arm", trunk: "Trunk", left_leg: "Left leg", right_leg: "Right leg" },
  frequency: "Frequency",
  showAll: "Show all readings",
  headline: "Key numbers",
  metrics: {
    inbody_score: "InBody score", total_body_water: "Total body water", protein: "Protein", minerals: "Minerals", body_fat_mass: "Body fat mass", weight: "Weight",
    skeletal_muscle_mass: "Skeletal muscle mass", bmi: "BMI", percent_body_fat: "Body fat %", waist_hip_ratio: "Waist-hip ratio", visceral_fat_level: "Visceral fat level",
    target_weight: "Target weight", weight_control: "Weight control", fat_control: "Fat control", muscle_control: "Muscle control", fat_free_mass: "Fat-free mass",
    basal_metabolic_rate: "Basal metabolic rate", obesity_degree: "Obesity degree", smi: "Skeletal muscle index", recommended_calorie_intake: "Recommended calories",
    lean_mass_kg: "Lean mass", lean_mass_pct: "Lean mass vs. norm", fat_mass_kg: "Fat mass", fat_mass_pct: "Fat mass vs. norm", impedance_ohm: "Impedance"
  },
  exercises: {
    golf: "Golf", walking: "Walking", badminton: "Badminton", tennis: "Tennis", boxing: "Boxing", mountain_climbing: "Mountain climbing", aerobics: "Aerobics", soccer: "Soccer",
    japanese_fencing: "Japanese fencing", squash: "Squash", gateball: "Gateball", yoga: "Yoga", table_tennis: "Table tennis", bicycling: "Cycling", basketball: "Basketball",
    jumping_rope: "Jumping rope", jogging: "Jogging", swimming: "Swimming", racketball: "Racketball", taekwondo: "Taekwondo"
  },
  body: {
    eyebrow: "Body", title: "Body composition", metric: "Metric", tests: "Tests", first: "First test", latest: "Latest", change: "Change", between: "Between the tests", days: "days",
    dietLogged: "Diet logged", noDiet: "No diet logged", avgKcal: "kcal a day", protein: "protein", fat: "fat", carbs: "carbs", steps: "steps a day", noSteps: "No step data",
    workouts: "workouts", sets: "sets", tonnage: "kg lifted", photos: "Progress photos", measurements: "Tape measurements", openSheet: "Open the full sheet",
    loadError: "Couldn't load the InBody tests", empty: "No InBody tests yet", emptyHint: "Ask the agent to add a test from the printed sheet: it keeps the original file and every number.",
    chartTrend: "Trend across tests", oneTest: "Add a second test to see the trend", daysFromTest: "d from the test",
    tape: {
      weightKg: "Weight", waistCm: "Waist", abdomenCm: "Abdomen", chestCm: "Chest", neckCm: "Neck", hipsCm: "Hips", forearmCm: "Forearm",
      leftBicepCm: "Left biceps", rightBicepCm: "Right biceps", leftBicepFlexedCm: "Left biceps (flexed)", rightBicepFlexedCm: "Right biceps (flexed)",
      leftThighCm: "Left thigh", rightThighCm: "Right thigh", leftCalfCm: "Left calf", rightCalfCm: "Right calf"
    }
  }
};

const ru: InBodyCopy = {
  title: "Тест InBody",
  original: "Оригинал отчёта",
  openOriginal: "Открыть оригинал",
  noOriginal: "Файла оригинала нет",
  reviewed: "Проверено",
  notReviewed: "Пока не проверено",
  sinceLast: "с прошлого теста",
  sinceFirst: "с первого теста",
  reference: "Норма",
  evaluation: { under: "Ниже", normal: "Норма", over: "Выше" },
  sections: {
    composition: "Состав тела", obesity: "Анализ ожирения", control: "Контроль веса", research: "Исследовательские параметры",
    segmental_lean: "Сегментарный анализ мышц", segmental_fat: "Сегментарный анализ жира", impedance: "Импеданс", exercise: "Расход калорий за 30 минут", other: "Другое"
  },
  segments: { left_arm: "Левая рука", right_arm: "Правая рука", trunk: "Корпус", left_leg: "Левая нога", right_leg: "Правая нога" },
  frequency: "Частота",
  showAll: "Показать все значения",
  headline: "Главное",
  metrics: {
    inbody_score: "Оценка InBody", total_body_water: "Общая вода", protein: "Белок", minerals: "Минералы", body_fat_mass: "Жировая масса", weight: "Вес",
    skeletal_muscle_mass: "Скелетно-мышечная масса", bmi: "ИМТ", percent_body_fat: "Процент жира", waist_hip_ratio: "Талия/бёдра", visceral_fat_level: "Висцеральный жир",
    target_weight: "Целевой вес", weight_control: "Контроль веса", fat_control: "Контроль жира", muscle_control: "Контроль мышц", fat_free_mass: "Безжировая масса",
    basal_metabolic_rate: "Базальный обмен", obesity_degree: "Степень ожирения", smi: "Индекс скелетных мышц", recommended_calorie_intake: "Рекомендуемые калории",
    lean_mass_kg: "Мышечная масса", lean_mass_pct: "Мышцы к норме", fat_mass_kg: "Жировая масса", fat_mass_pct: "Жир к норме", impedance_ohm: "Импеданс"
  },
  exercises: {
    golf: "Гольф", walking: "Ходьба", badminton: "Бадминтон", tennis: "Теннис", boxing: "Бокс", mountain_climbing: "Скалолазание", aerobics: "Аэробика", soccer: "Футбол",
    japanese_fencing: "Кендо", squash: "Сквош", gateball: "Гейтбол", yoga: "Йога", table_tennis: "Настольный теннис", bicycling: "Велосипед", basketball: "Баскетбол",
    jumping_rope: "Скакалка", jogging: "Бег", swimming: "Плавание", racketball: "Рэкетбол", taekwondo: "Тхэквондо"
  },
  body: {
    eyebrow: "Тело", title: "Состав тела", metric: "Показатель", tests: "Тесты", first: "Первый тест", latest: "Последний", change: "Изменение", between: "Между тестами", days: "дн.",
    dietLogged: "Питание записано", noDiet: "Питание не записывалось", avgKcal: "ккал в день", protein: "белка", fat: "жиров", carbs: "углеводов", steps: "шагов в день", noSteps: "Нет данных о шагах",
    workouts: "тренировок", sets: "подходов", tonnage: "кг тоннаж", photos: "Фото прогресса", measurements: "Замеры тела", openSheet: "Открыть весь лист",
    loadError: "Не удалось загрузить тесты InBody", empty: "Тестов InBody пока нет", emptyHint: "Попроси агента добавить тест с бумажного листа: он сохранит оригинал файла и все числа.",
    chartTrend: "Динамика по тестам", oneTest: "Добавь второй тест, чтобы увидеть динамику", daysFromTest: "дн. от теста",
    tape: {
      weightKg: "Вес", waistCm: "Талия", abdomenCm: "Живот", chestCm: "Грудь", neckCm: "Шея", hipsCm: "Бёдра", forearmCm: "Предплечье",
      leftBicepCm: "Левый бицепс", rightBicepCm: "Правый бицепс", leftBicepFlexedCm: "Левый бицепс (напряжён)", rightBicepFlexedCm: "Правый бицепс (напряжён)",
      leftThighCm: "Левое бедро", rightThighCm: "Правое бедро", leftCalfCm: "Левая голень", rightCalfCm: "Правая голень"
    }
  }
};

const cs: InBodyCopy = {
  title: "Test InBody",
  original: "Originál zprávy",
  openOriginal: "Otevřít originál",
  noOriginal: "Originální soubor chybí",
  reviewed: "Zkontrolováno",
  notReviewed: "Zatím nezkontrolováno",
  sinceLast: "od minulého testu",
  sinceFirst: "od prvního testu",
  reference: "Norma",
  evaluation: { under: "Pod normou", normal: "Norma", over: "Nad normou" },
  sections: {
    composition: "Složení těla", obesity: "Analýza obezity", control: "Kontrola hmotnosti", research: "Výzkumné parametry",
    segmental_lean: "Segmentální analýza svalů", segmental_fat: "Segmentální analýza tuku", impedance: "Impedance", exercise: "Spálené kalorie za 30 minut", other: "Ostatní"
  },
  segments: { left_arm: "Levá paže", right_arm: "Pravá paže", trunk: "Trup", left_leg: "Levá noha", right_leg: "Pravá noha" },
  frequency: "Frekvence",
  showAll: "Zobrazit všechny hodnoty",
  headline: "Hlavní čísla",
  metrics: {
    inbody_score: "Skóre InBody", total_body_water: "Celková voda v těle", protein: "Bílkoviny", minerals: "Minerály", body_fat_mass: "Tuková hmota", weight: "Hmotnost",
    skeletal_muscle_mass: "Kosterní svalová hmota", bmi: "BMI", percent_body_fat: "Procento tuku", waist_hip_ratio: "Poměr pas/boky", visceral_fat_level: "Viscerální tuk",
    target_weight: "Cílová hmotnost", weight_control: "Kontrola hmotnosti", fat_control: "Kontrola tuku", muscle_control: "Kontrola svalů", fat_free_mass: "Beztuková hmota",
    basal_metabolic_rate: "Bazální metabolismus", obesity_degree: "Stupeň obezity", smi: "Index kosterního svalstva", recommended_calorie_intake: "Doporučený příjem kalorií",
    lean_mass_kg: "Svalová hmota", lean_mass_pct: "Svaly vůči normě", fat_mass_kg: "Tuková hmota", fat_mass_pct: "Tuk vůči normě", impedance_ohm: "Impedance"
  },
  exercises: {
    golf: "Golf", walking: "Chůze", badminton: "Badminton", tennis: "Tenis", boxing: "Box", mountain_climbing: "Horolezectví", aerobics: "Aerobik", soccer: "Fotbal",
    japanese_fencing: "Kendó", squash: "Squash", gateball: "Gateball", yoga: "Jóga", table_tennis: "Stolní tenis", bicycling: "Cyklistika", basketball: "Basketbal",
    jumping_rope: "Švihadlo", jogging: "Běh", swimming: "Plavání", racketball: "Racketball", taekwondo: "Taekwondo"
  },
  body: {
    eyebrow: "Tělo", title: "Složení těla", metric: "Ukazatel", tests: "Testy", first: "První test", latest: "Poslední", change: "Změna", between: "Mezi testy", days: "dní",
    dietLogged: "Zapsané jídlo", noDiet: "Jídlo nezapsáno", avgKcal: "kcal denně", protein: "bílkovin", fat: "tuků", carbs: "sacharidů", steps: "kroků denně", noSteps: "Žádná data o krocích",
    workouts: "tréninků", sets: "sérií", tonnage: "kg zvednuto", photos: "Fotky pokroku", measurements: "Měření těla", openSheet: "Otevřít celý list",
    loadError: "Testy InBody se nepodařilo načíst", empty: "Zatím žádné testy InBody", emptyHint: "Požádej agenta, ať přidá test z papírového listu: uloží originál souboru i všechna čísla.",
    chartTrend: "Vývoj napříč testy", oneTest: "Přidej druhý test a uvidíš vývoj", daysFromTest: "dní od testu",
    tape: {
      weightKg: "Hmotnost", waistCm: "Pas", abdomenCm: "Břicho", chestCm: "Hrudník", neckCm: "Krk", hipsCm: "Boky", forearmCm: "Předloktí",
      leftBicepCm: "Levý biceps", rightBicepCm: "Pravý biceps", leftBicepFlexedCm: "Levý biceps (napjatý)", rightBicepFlexedCm: "Pravý biceps (napjatý)",
      leftThighCm: "Levé stehno", rightThighCm: "Pravé stehno", leftCalfCm: "Levé lýtko", rightCalfCm: "Pravé lýtko"
    }
  }
};

const copies: Record<Locale, InBodyCopy> = { ru, en, cs };

export const getInBodyCopy = (locale: Locale) => copies[locale];

/** The localized name of a reading, falling back to the label stored with it (unknown keys keep their own label). */
export function metricLabel(copy: InBodyCopy, metric: { key: string; label: string }) {
  if (copy.metrics[metric.key]) return copy.metrics[metric.key];
  const exercise = /^exercise_kcal_(.+)$/.exec(metric.key)?.[1];
  return (exercise && copy.exercises[exercise]) || metric.label;
}
