import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { getStudioCopy } from "@/i18n/studio-messages";
import type { ExerciseSummary } from "@/lib/studio/types";
import { TemplatesNav } from "./templates-nav";
import { ExerciseDetail } from "./exercise-detail";
import { YoutubePlayer } from "./youtube-player";

const frame = (theme?: "light" | "dark"): Decorator => function Frame(Story) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(["studio", "templates"], [
      { id: "t1", name: "Push A", exercises: [], isArchived: false, createdAt: "", updatedAt: "" },
      { id: "t2", name: "Pull B", exercises: [], isArchived: false, createdAt: "", updatedAt: "" }
    ]);
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="never">
        <div data-surface="studio" data-theme={theme} className="min-h-screen p-8">
          <Story />
        </div>
      </MotionConfig>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Studio/Exercise detail",
  parameters: { layout: "fullscreen" },
  decorators: [frame()]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const photo = (name: string) => `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/${name}`;

const split: ExerciseSummary = {
  id: "e1",
  name: "Split Squat with Dumbbells",
  primaryMuscles: ["quads"],
  secondaryMuscles: ["glutes", "hamstrings"],
  equipment: "dumbbell",
  movementPattern: "lunge",
  images: [photo("Split_Squat_with_Dumbbells/0.jpg"), photo("Split_Squat_with_Dumbbells/1.jpg")],
  instructions: [
    "Встаньте спиной к скамье, заведите одну ногу назад на опору, гантели в руках.",
    "Опускайтесь вниз, пока бедро передней ноги не станет параллельно полу, корпус держите вертикально.",
    "Оттолкнитесь передней ногой и вернитесь в исходное положение."
  ],
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
};

function Open({ exercise, locale = "ru", coachNote, withAdd }: { exercise: ExerciseSummary; locale?: "ru" | "en" | "cs"; coachNote?: string; withAdd?: boolean }) {
  return <ExerciseDetail exercise={exercise} copy={getStudioCopy(locale)} coachNote={coachNote} onClose={() => undefined} onAdd={withAdd ? () => undefined : undefined} />;
}

export const WithTechniqueNoteAndVideo: Story = {
  render: () => <Open exercise={split} coachNote="Пауза 1 секунда внизу, колено не заваливай внутрь. Если последний подход идёт легко — прибавь 2,5 кг." />
};
export const FromCatalogWithAddButton: Story = { render: () => <Open exercise={split} withAdd /> };
export const NoPhotosNoTechniqueNoVideo: Story = {
  render: () => <Open exercise={{ id: "e2", name: "Моё упражнение", primaryMuscles: ["biceps"] }} />
};
export const English: Story = { render: () => <Open exercise={split} locale="en" coachNote="Pause one second at the bottom." /> };
export const Czech: Story = { render: () => <Open exercise={split} locale="cs" coachNote="Pauza jednu sekundu dole." /> };
export const Dark: Story = { decorators: [frame("dark")], render: () => <Open exercise={split} coachNote="Пауза 1 секунда внизу." /> };

export const PlayerFacet: Story = {
  render: () => (
    <div className="max-w-xl">
      <YoutubePlayer url="https://youtu.be/dQw4w9WgXcQ" title="Split Squat" playLabel="Смотреть видео" />
    </div>
  )
};

export const TemplatesNavigation: Story = {
  render: () => <TemplatesNav locale="ru" copy={getStudioCopy("ru")} templateId="t1" />
};
