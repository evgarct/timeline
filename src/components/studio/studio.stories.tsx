import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { MotionConfig } from "motion/react";
import { useReducer, useState } from "react";
import { getStudioCopy } from "@/i18n/studio-messages";
import { ConsistencyGrid, LineChart, WeekBars } from "./dashboard/charts";
import { builderReducer, initialState, type BuilderDoc } from "./builder/builder-state";
import { CanvasPanel } from "./builder/canvas-panel";
import { CreateExerciseForm } from "./builder/create-exercise";
import { DropIndicator } from "./builder/drop-indicator";
import { InspectorPanel } from "./builder/inspector-panel";
import { MuscleMap } from "./ds/muscle-map";
import { Chip, Eyebrow, NumberTicker, SerifNumber, Stepper, StudioButton, Surface } from "./ds/primitives";

const withStudio = (theme?: "light" | "dark"): Decorator => function StudioFrame(Story) {
  return (
    <MotionConfig reducedMotion="never">
      <div data-surface="studio" data-theme={theme} className="min-h-screen p-8">
        <Story />
      </div>
    </MotionConfig>
  );
};

const meta = {
  title: "Studio/Design system",
  parameters: { layout: "fullscreen" },
  decorators: [withStudio()]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Showcase() {
  const [chip, setChip] = useState("chest");
  const [sets, setSets] = useState<number | undefined>(3);
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Eyebrow>Типографика</Eyebrow>
        <h1 className="s-serif text-5xl tracking-tight">Силовые тренировки</h1>
        <div className="mt-4 flex gap-8">
          <SerifNumber size={48} value={<NumberTicker value={1280} />} unit="кг" />
          <SerifNumber size={48} value="97.5" unit="кг" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <StudioButton>Сохранить</StudioButton>
        <StudioButton variant="tonal">Отмена</StudioButton>
        <StudioButton variant="ghost">Ещё</StudioButton>
        <StudioButton variant="danger">Удалить</StudioButton>
        <StudioButton disabled>Недоступно</StudioButton>
      </div>
      <div className="flex flex-wrap gap-2">
        {["chest", "lats", "quads", "shoulders"].map((value) => <Chip key={value} groupId="story" active={chip === value} count={12} onClick={() => setChip(value)}>{value}</Chip>)}
      </div>
      <div className="grid max-w-xs grid-cols-2 gap-3"><Stepper label="Подходы" value={sets} min={1} max={20} onChange={setSets} /><Stepper label="Вес" value={62.5} step={2.5} suffix="кг" onChange={() => undefined} /></div>
      <div className="grid grid-cols-2 gap-4">
        <Surface className="p-5">container</Surface>
        <Surface tone="high" className="p-5">container-high</Surface>
        <Surface tone="primary" className="p-5">primary-container</Surface>
        <Surface interactive className="p-5">interactive (hover)</Surface>
      </div>
    </div>
  );
}

export const Tokens: Story = { render: () => <Showcase /> };
export const TokensDark: Story = { decorators: [withStudio("dark")], render: () => <Showcase /> };

export const MuscleMapStates: Story = {
  render: () => (
    <div className="flex h-[360px] gap-10">
      <MuscleMap primary={["chest"]} secondary={["triceps", "shoulders"]} />
      <MuscleMap intensity={{ quads: 1, glutes: 0.7, hamstrings: 0.5, calves: 0.25 }} />
      <MuscleMap />
    </div>
  )
};

const exercise = (n: number, name: string, primary: string[], secondary: string[]) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, name, primaryMuscles: primary, secondaryMuscles: secondary });
const seedDoc: BuilderDoc = {
  name: "Push day",
  items: [
    { key: "a", exercise: exercise(1, "Barbell Bench Press", ["chest"], ["triceps", "shoulders"]), sets: 4, repMin: 6, repMax: 8, weightKg: 80, progressionKg: 2.5 },
    { key: "b", exercise: exercise(2, "Incline Dumbbell Press", ["chest"], ["shoulders"]), sets: 3, repMin: 8, repMax: 12, groupId: "g" },
    { key: "c", exercise: exercise(3, "Triceps Pushdown", ["triceps"], []), sets: 3, repMin: 10, repMax: 15, groupId: "g" }
  ]
};

function BuilderPieces({ doc }: { doc: BuilderDoc }) {
  const copy = getStudioCopy("ru");
  const [state, dispatch] = useReducer(builderReducer, doc, (value) => initialState(value));
  return (
    <div className="grid max-w-5xl gap-6 md:grid-cols-[1fr_320px]">
      <CanvasPanel items={state.present.items} copy={copy} dispatch={dispatch} />
      <InspectorPanel items={state.present.items} copy={copy} />
    </div>
  );
}

export const BuilderCanvasAndInspector: Story = { render: () => <BuilderPieces doc={seedDoc} /> };
export const BuilderEmpty: Story = { render: () => <BuilderPieces doc={{ name: "", items: [] }} /> };

export const Charts: Story = {
  render: () => {
    const bars = Array.from({ length: 12 }, (_, index) => ({ key: String(index), label: `${index + 1}`, value: 8 + ((index * 7) % 30) }));
    const counts = Object.fromEntries(Array.from({ length: 30 }, (_, index) => { const day = new Date(Date.now() - index * 2 * 864e5); return [`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`, 1 + (index % 2)]; }));
    return (
      <div className="max-w-2xl space-y-8">
        <WeekBars bars={bars} selected="11" onSelect={() => undefined} unit="подходов" />
        <LineChart unit="кг" points={[{ label: "08-17", value: 70 }, { label: "08-24", value: 72.5 }, { label: "09-07", value: 77 }, { label: "09-21", value: 76 }, { label: "10-05", value: 82 }]} />
        <ConsistencyGrid counts={counts} weeks={12} />
      </div>
    );
  }
};

export const CreateExercise: Story = {
  render: () => (
    <div className="max-w-sm">
      <CreateExerciseForm
        copy={getStudioCopy("ru")}
        defaultName="Жим Свенда"
        muscles={[{ value: "chest", count: 12 }, { value: "lats", count: 9 }, { value: "quads", count: 7 }]}
        equipment={[{ value: "barbell", count: 30 }, { value: "dumbbell", count: 22 }]}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />
    </div>
  )
};

export const DropTarget: Story = {
  render: () => (
    <div className="relative h-40 max-w-xl rounded-[var(--s-radius-xl)] bg-[var(--s-surface-container)] p-6">
      <DropIndicator y={70} label={getStudioCopy("ru").builder.dropHere} />
    </div>
  )
};
