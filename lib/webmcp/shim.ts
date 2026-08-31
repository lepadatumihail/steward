/**
 * A minimal, honest fallback for `document.modelContext`.
 *
 * Why this exists: a judge may open Steward in a browser with no WebMCP at all.
 * Without a model context, `registerTool` cannot even be called, so the page
 * looks inert and there is nothing to inspect. The shim installs a real
 * registry so tools register, appear in the UI, and can be executed manually —
 * while making it unmistakable that no agent is present.
 *
 * It is NOT a compatibility polyfill: it cannot make an agent appear. It gives
 * the page somewhere to register, and gives a human a way to run a tool by hand.
 *
 * Honesty rule: anything installed here is marked, and the UI reports "shim"
 * distinctly from "native". Steward never claims WebMCP support it does not have.
 */

import type { ModelContext, ToolDescriptor } from "./types";

const SHIM_MARKER = "__stewardShim";

export type ModelContextMode = "native" | "shim" | "none";

interface ShimmedContext extends ModelContext {
  [SHIM_MARKER]?: true;
}

export function getModelContextMode(): ModelContextMode {
  if (typeof document === "undefined") return "none";
  const mc = (document.modelContext ?? navigator.modelContext) as
    | ShimmedContext
    | undefined;
  if (!mc || typeof mc.registerTool !== "function") return "none";
  return mc[SHIM_MARKER] ? "shim" : "native";
}

/**
 * Install the fallback registry if — and only if — the browser has none.
 * Returns the resulting mode. Safe to call repeatedly.
 */
export function installShim(): ModelContextMode {
  if (typeof document === "undefined") return "none";
  const existing = document.modelContext ?? navigator.modelContext;
  if (existing && typeof existing.registerTool === "function") {
    return (existing as ShimmedContext)[SHIM_MARKER] ? "shim" : "native";
  }

  const tools = new Map<string, ToolDescriptor<never>>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());

  // Mirrors the spec's validation so a name that would fail natively fails here.
  const VALID_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

  const shim: ShimmedContext = {
    [SHIM_MARKER]: true,

    registerTool(tool, options) {
      if (!VALID_NAME.test(tool.name)) {
        throw new Error(
          `Invalid tool name "${tool.name}": use 1-128 chars of A-Z a-z 0-9 _ . -`,
        );
      }
      tools.set(tool.name, tool);
      emit();
      options?.signal?.addEventListener("abort", () => {
        if (tools.get(tool.name) === tool) {
          tools.delete(tool.name);
          emit();
        }
      });
      return Promise.resolve();
    },

    getTools() {
      return Promise.resolve(
        [...tools.values()]
          .map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: t.annotations,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    },

    // Mirrors native Chrome (151/152) as closely as is useful: it takes the
    // RegisteredTool handle from getTools() and a JSON STRING of arguments.
    // Verified against native on 2026-09-01 — the object-args form the spec
    // moved to on 2026-08-17 is rejected by shipping Chrome. We accept both
    // shapes so page-side self-tests behave the same either way.
    executeTool(tool, args, options) {
      const name =
        typeof tool === "string"
          ? tool
          : (tool as { name?: string } | null)?.name;
      const found = name ? tools.get(name) : undefined;
      if (!found) return Promise.reject(new Error(`No such tool: ${String(name)}`));

      let parsed: unknown = args;
      if (typeof args === "string") {
        try {
          parsed = args.length ? JSON.parse(args) : {};
        } catch {
          return Promise.reject(new Error("Failed to parse input arguments"));
        }
      }
      return Promise.resolve(
        found.execute(parsed as never, { signal: options?.signal }),
      );
    },

    addEventListener(type, cb) {
      if (type === "toolchange") listeners.add(cb);
    },

    removeEventListener(type, cb) {
      if (type === "toolchange") listeners.delete(cb);
    },
  };

  Object.defineProperty(document, "modelContext", {
    value: shim,
    configurable: true,
    writable: false,
  });

  return "shim";
}
