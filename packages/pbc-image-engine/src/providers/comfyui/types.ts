/**
 * ComfyUI-specific types — shared by Local (WI-404) and Cloud (WI-405).
 *
 * ComfyUI represents a workflow as a flat dictionary of nodes keyed by string
 * id. Each node declares its `class_type` and an `inputs` map; inputs that
 * reference other node outputs use the `[nodeId, outputIndex]` tuple form.
 */

import type { GenerationMode, GenerationRequest } from "../../types.js";

/** Reference to another node's output: `[nodeId, outputIndex]`. */
export type ComfyUINodeRef = [string, number];

export interface ComfyUINode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title?: string };
}

/** A ComfyUI prompt graph: dictionary of nodeId → node. */
export type ComfyUIPrompt = Record<string, ComfyUINode>;

export interface ComfyUIWorkflow {
  /** The graph itself. */
  prompt: ComfyUIPrompt;
  /**
   * Node ids that produce final image outputs (SaveImage / PreviewImage).
   * The adapter polls `history/{prompt_id}` and pulls files from these
   * nodes' `outputs.images[]`.
   */
  outputNodeIds: string[];
}

/**
 * A workflow builder turns a `GenerationRequest` into a concrete ComfyUI
 * graph. Keeping this as an interface lets us register multiple workflows
 * (Z-Image, FLUX.2 Klein, etc.) under stable ids and pick by request.model
 * or request.metadata.workflow.
 */
export interface ComfyUIWorkflowBuilder {
  /** Stable workflow id, e.g. "z-image-default". */
  readonly id: string;
  /** Modes this workflow is valid for. */
  readonly modes: readonly GenerationMode[];
  /**
   * Produce a fresh workflow graph for the given request. Builders MUST be
   * pure (no I/O, no global state) so tests can verify the graph shape
   * deterministically.
   */
  build(req: GenerationRequest): ComfyUIWorkflow;
}

/**
 * /history/{prompt_id} response shape — only the fields we read.
 * ComfyUI returns a dict keyed by prompt id; values include status + outputs.
 */
export interface ComfyUIHistoryEntry {
  status?: {
    /** "success" | "error" — the finalized outcome. */
    status_str?: string;
    /** True once the prompt has fully drained the queue. */
    completed?: boolean;
    messages?: Array<[string, Record<string, unknown>]>;
  };
  outputs?: Record<
    string,
    {
      images?: Array<{
        filename: string;
        subfolder?: string;
        type?: string;
      }>;
    }
  >;
}

export type ComfyUIHistoryResponse = Record<string, ComfyUIHistoryEntry>;

export interface ComfyUIPromptResponse {
  prompt_id?: string;
  number?: number;
  node_errors?: Record<string, unknown>;
}
