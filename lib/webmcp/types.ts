/**
 * Minimal typings for the browser-native WebMCP surface.
 *
 * The spec moved the getter Navigator -> Document on 2026-05-27;
 * `navigator.modelContext` survives as a deprecated alias (Chrome warns from 150).
 * We therefore read `document.modelContext ?? navigator.modelContext`.
 *
 * Deliberately NOT modelled: `provideContext()` (removed 2026-03-05) and
 * `unregisterTool()` (removed 2026-04-23 in favour of AbortSignal).
 */

export type JSONSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface ToolAnnotations {
  /** Non-state-changing. Agents skip confirmation for these and assume mutation otherwise. */
  readOnlyHint?: boolean;
  /** Output embeds third-party/UGC data. Agents are asked to "spotlight" it as data, not instructions. */
  untrustedContentHint?: boolean;
}

export interface ToolTextContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolTextContent[];
  isError?: boolean;
}

/** What an `execute` may return. We always normalise to the canonical envelope. */
export type LooseToolResult = ToolResult | string | Record<string, unknown>;

export interface ToolDescriptor<Args = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  execute: (
    args: Args,
    ctx?: { signal?: AbortSignal },
  ) => Promise<LooseToolResult> | LooseToolResult;
}

export interface ModelContext {
  registerTool(
    tool: ToolDescriptor<never>,
    options?: { signal?: AbortSignal },
  ): Promise<void> | void;
  getTools?(options?: unknown): Promise<unknown>;
  executeTool?(
    name: string,
    args: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  addEventListener?(type: "toolchange", cb: () => void): void;
  removeEventListener?(type: "toolchange", cb: () => void): void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    modelContext?: ModelContext;
  }
}

/** Canonical accessor. Returns undefined when the browser has no WebMCP. */
export function getModelContext(): ModelContext | undefined {
  if (typeof document === "undefined") return undefined;
  return document.modelContext ?? navigator.modelContext;
}

export function isWebMCPSupported(): boolean {
  return typeof getModelContext()?.registerTool === "function";
}
