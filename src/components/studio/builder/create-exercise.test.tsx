import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStudioCopy } from "@/i18n/studio-messages";
import { CreateExerciseForm } from "./create-exercise";

afterEach(cleanup);

const copy = getStudioCopy("en");
const muscles = [{ value: "chest", count: 12 }, { value: "lats", count: 9 }];
const equipment = [{ value: "barbell", count: 30 }];

describe("CreateExerciseForm", () => {
  it("needs a name and a primary muscle before it can submit", () => {
    const onSubmit = vi.fn();
    render(<CreateExerciseForm copy={copy} defaultName="Svend Press" muscles={muscles} equipment={equipment} onSubmit={onSubmit} onCancel={() => undefined} />);
    const submit = screen.getByRole("button", { name: copy.builder.create });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Chest" }));
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "barbell" }));
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ name: "Svend Press", primaryMuscle: "chest", equipment: "barbell" });
  });

  it("offers a default muscle list when the catalog has no facets yet, and cancels", () => {
    const onCancel = vi.fn();
    render(<CreateExerciseForm copy={copy} defaultName="X" muscles={[]} equipment={[]} onSubmit={() => undefined} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Quads" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.common.cancel }));
    expect(onCancel).toHaveBeenCalled();
  });
});
