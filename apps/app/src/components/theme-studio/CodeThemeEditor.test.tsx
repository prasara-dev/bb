// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeThemeFiles } from "@bb/domain";
import { CodeThemeEditor } from "./CodeThemeEditor";

afterEach(cleanup);

const FILES: CodeThemeFiles = {
  dark: {
    text: '{"name":"QA","type":"dark"}',
    overriddenByManifest: false,
    manifestValue: null,
  },
  light: {
    text: null,
    overriddenByManifest: false,
    manifestValue: null,
  },
};

const SAMPLE = '{"name":"QA","type":"dark","colors":{"editor.background":"#101010"}}';

describe("code theme editor", () => {
  it("shows existing sidecars and marks a side with no file", () => {
    render(<CodeThemeEditor files={FILES} pending={false} onSave={vi.fn()} />);

    expect(
      (screen.getByLabelText("Dark code theme JSON") as HTMLTextAreaElement).value,
    ).toContain("QA");
    expect(
      (screen.getByLabelText("Light code theme JSON") as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(screen.getByText("No sidecar file")).toBeTruthy();
  });

  it("blocks saving invalid JSON and explains why", () => {
    render(<CodeThemeEditor files={FILES} pending={false} onSave={vi.fn()} />);
    const textarea = screen.getByLabelText("Dark code theme JSON");

    fireEvent.change(textarea, { target: { value: "{ not json" } });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /save dark/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("rejects a JSON array as a code theme", () => {
    render(<CodeThemeEditor files={FILES} pending={false} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Dark code theme JSON"), {
      target: { value: "[]" },
    });

    expect(screen.getByText("Expected a JSON object.")).toBeTruthy();
  });

  it("saves pretty-printed JSON for the edited side only", async () => {
    const onSave = vi.fn().mockResolvedValue(FILES);
    render(<CodeThemeEditor files={FILES} pending={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Dark code theme JSON"), {
      target: { value: SAMPLE },
    });
    fireEvent.click(screen.getByRole("button", { name: /save dark/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [side, text] = onSave.mock.calls[0];
    expect(side).toBe("dark");
    expect(JSON.parse(String(text)).colors["editor.background"]).toBe("#101010");
    expect(String(text)).toContain("\n");
  });

  it("clears a side by saving null", async () => {
    const onSave = vi.fn().mockResolvedValue(FILES);
    render(<CodeThemeEditor files={FILES} pending={false} onSave={onSave} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear dark code theme" }),
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("dark", null));
  });

  it("cannot clear a side that has no sidecar", () => {
    render(<CodeThemeEditor files={FILES} pending={false} onSave={vi.fn()} />);

    expect(
      (
        screen.getByRole("button", {
          name: "Clear dark code theme",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Clear light code theme",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("warns that theme.json overrides a side", () => {
    render(
      <CodeThemeEditor
        files={{
          dark: {
            text: null,
            overriddenByManifest: true,
            manifestValue: "github-dark",
          },
          light: {
            text: null,
            overriddenByManifest: false,
            manifestValue: null,
          },
        }}
        pending={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/theme\.json overrides this side/)).toBeTruthy();
    expect(screen.getByText(/github-dark/)).toBeTruthy();
  });

  it("disables save when unchanged", () => {
    render(<CodeThemeEditor files={FILES} pending={false} onSave={vi.fn()} />);

    expect(
      (screen.getByRole("button", { name: /save dark/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});