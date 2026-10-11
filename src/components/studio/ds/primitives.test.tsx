import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stepper } from "./primitives";

afterEach(cleanup);

describe("Stepper", () => {
  it("keeps the typed text until blur so decimals survive", () => {
    const onChange = vi.fn();
    render(<Stepper label="Weight" value={undefined} step={2.5} max={1000} optional onChange={onChange} />);
    const input = screen.getByLabelText("Weight", { selector: "input" });

    fireEvent.change(input, { target: { value: "62." } });
    expect(input).toHaveValue("62.");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "62.5" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(62.5);
  });

  it("commits an emptied optional field as undefined and snaps a required one back", () => {
    const optional = vi.fn();
    const required = vi.fn();
    const { rerender } = render(<Stepper label="Reps" value={8} min={1} optional onChange={optional} />);
    let input = screen.getByLabelText("Reps", { selector: "input" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(optional).toHaveBeenLastCalledWith(undefined);

    rerender(<Stepper label="Reps" value={8} min={1} onChange={required} />);
    input = screen.getByLabelText("Reps", { selector: "input" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(required).not.toHaveBeenCalled();
    expect(input).toHaveValue("8");
  });

  it("starts an empty optional field at one step with +", () => {
    const onChange = vi.fn();
    render(<Stepper label="Weight" value={undefined} step={2.5} optional onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Weight +" }));
    expect(onChange).toHaveBeenCalledWith(2.5);
  });
});
