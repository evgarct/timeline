import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStudioCopy } from "@/i18n/studio-messages";
import type { ExerciseSummary } from "@/lib/studio/types";
import { ExerciseDetail } from "./exercise-detail";
import { YoutubePlayer } from "./youtube-player";

afterEach(cleanup);

const copy = getStudioCopy("en");
const exercise: ExerciseSummary = {
  id: "e1", name: "Split Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: "dumbbell",
  images: ["https://cdn.example.test/0.jpg", "https://cdn.example.test/1.jpg"],
  instructions: ["Step back.", "Lower down."],
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
};

function renderDetail(props: Partial<React.ComponentProps<typeof ExerciseDetail>> = {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ExerciseDetail exercise={exercise} copy={copy} onClose={() => undefined} {...props} />
    </QueryClientProvider>
  );
}

describe("ExerciseDetail", () => {
  it("shows both photos, the technique, the coach's note and the muscles", () => {
    renderDetail({ coachNote: "Pause at the bottom." });
    expect(screen.getByRole("dialog", { name: "Split Squat" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Split Squat" })).toHaveLength(2);
    expect(screen.getByText("Step back.")).toBeInTheDocument();
    expect(screen.getByText("Lower down.")).toBeInTheDocument();
    expect(screen.getByText("Pause at the bottom.")).toBeInTheDocument();
    expect(screen.getByLabelText(copy.builder.coachNote)).toBeInTheDocument();
  });

  it("says so when there is no technique, note or video", () => {
    renderDetail({ exercise: { id: "e2", name: "Mine", primaryMuscles: ["biceps"] } });
    expect(screen.getByText(copy.builder.noTechnique)).toBeInTheDocument();
    expect(screen.queryByTestId("youtube-player")).toBeNull();
    expect(screen.queryByLabelText(copy.builder.coachNote)).toBeNull();
  });

  it("closes with Escape and the close button, and offers Add only from the catalog", () => {
    const onClose = vi.fn();
    const onAdd = vi.fn();
    renderDetail({ onClose, onAdd });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: copy.builder.addToTemplate }));
    expect(onAdd).toHaveBeenCalledWith(exercise);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("refuses a link that is not YouTube before saving it", () => {
    renderDetail({ exercise: { ...exercise, videoUrl: undefined } });
    const input = screen.getByLabelText(copy.builder.videoLink);
    fireEvent.change(input, { target: { value: "https://example.com/video" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: copy.builder.videoSave }));
    expect(screen.queryByTestId("youtube-player")).toBeNull();
  });
});

describe("YoutubePlayer", () => {
  it("loads nothing from YouTube until play is pressed, then embeds the privacy-enhanced player", () => {
    const { container } = render(<YoutubePlayer url="https://youtu.be/dQw4w9WgXcQ" title="Split Squat" playLabel="Play" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Play: Split Squat" }));
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("renders nothing for a link that is not a YouTube video", () => {
    const { container } = render(<YoutubePlayer url="https://example.com/x" title="x" playLabel="Play" />);
    expect(container).toBeEmptyDOMElement();
  });
});
