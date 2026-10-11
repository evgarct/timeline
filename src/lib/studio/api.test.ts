import { afterEach, describe, expect, it, vi } from "vitest";
import { createExerciseIfMissing } from "./api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(items: Array<{ id: string; name: string }>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ id: "new-id", name: "Created" }, { status: 201 });
    return Response.json({ items, page: 1, pageSize: 30, hasMore: false });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createExerciseIfMissing", () => {
  it("returns an existing exercise with the same name without posting (no metadata overwrite)", async () => {
    const fetchMock = stubFetch([{ id: "existing", name: "Bench  Press" }]);
    const result = await createExerciseIfMissing({ name: " bench press ", primaryMuscles: ["chest"] });
    expect(result.id).toBe("existing");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("includeArchived=true");
  });

  it("creates the exercise when nothing with that name exists", async () => {
    const fetchMock = stubFetch([{ id: "other", name: "Bench Press Close Grip" }]);
    const result = await createExerciseIfMissing({ name: "Bench Press", primaryMuscles: ["chest"] });
    expect(result.id).toBe("new-id");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });
});
