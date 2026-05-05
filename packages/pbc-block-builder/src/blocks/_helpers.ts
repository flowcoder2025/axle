/**
 * Block-definition helper — keeps the 23 block files terse and consistent.
 *
 * The placeholder `render` returned here is a stable marker the renderer
 * adapters (WI-503..WI-506) will replace at registration time. Until those
 * land, calling `block.render(data, ctx)` returns a self-describing string
 * so consumers can wire the pipeline end-to-end before any renderer is
 * implemented.
 */

import type { ZodSchema } from "zod";
import type {
  BlockCategory,
  BlockDefinition,
  BlockId,
  RenderContext,
  RenderResult,
} from "../types.js";

export interface BlockSpec<TData> {
  id: BlockId;
  category: BlockCategory;
  /** English name — stable across builder UI / AI prompts / docs. */
  name: string;
  /** Korean name — preserved from the FlowStudio v2 source spec. */
  nameKo: string;
  description: string;
  /** Variant ids (e.g. `"full-bleed"`, `"split-half"`). First entry is the default. */
  variants: string[];
  /**
   * Priority hint from the visuals spec:
   *   - "required"   — must appear in any composition of this category
   *   - "recommended"— commonly included
   *   - "optional"   — included when relevant
   *   - "automatic"  — inserted by the renderer (e.g. F3 dividers)
   */
  priority: "required" | "recommended" | "optional" | "automatic";
  schema: ZodSchema<TData>;
}

export function defineBlock<TData>(
  spec: BlockSpec<TData>,
): BlockDefinition<TData, string> {
  if (!spec.id.startsWith(spec.category)) {
    throw new Error(
      `Block id '${spec.id}' does not start with category '${spec.category}'`,
    );
  }
  if (spec.variants.length === 0) {
    throw new Error(`Block '${spec.id}' must declare at least one variant`);
  }

  return {
    id: spec.id,
    category: spec.category,
    name: spec.name,
    description: spec.description,
    variants: spec.variants,
    schema: spec.schema,
    render: (data, context) => placeholderRender(spec, data, context),
  };
}

function placeholderRender<TData>(
  spec: BlockSpec<TData>,
  data: TData,
  context: RenderContext,
): RenderResult<string> {
  // The marker stays grep-able so a CI-side audit can confirm no
  // placeholder leaked into production once the renderers ship.
  return {
    content: `[pbc-block-builder placeholder] ${spec.id} ${spec.name} → ${context.output}`,
    metadata: {
      blockId: spec.id,
      category: spec.category,
      output: context.output,
      hasData: data != null,
      placeholder: true,
      followupWi: "WI-503..WI-506",
    },
  };
}
