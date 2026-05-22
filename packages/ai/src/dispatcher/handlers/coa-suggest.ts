/**
 * COA_SUGGEST AiJob handler (Phase 21 WI-727).
 *
 * Input  : { items: [{ lineIndex, productName, orderType }] }
 * Output : { suggestions: CoaSuggestion[] }
 *
 * The actual rule engine lives in `../../erp/coa-suggest.ts`. This file is
 * the thin adapter the AiJob dispatcher uses; intake confirm calls the
 * engine directly without an AiJob row on the hot path. The handler
 * exists so retroactive batch tagging (planned for M2) can submit
 * COA_SUGGEST jobs through the same dispatcher surface.
 */

import type { AiJobHandler } from "../types.js";
import { asRecord } from "../input-utils.js";
import { InvalidJobInputError } from "../types.js";
import {
  suggestForLines,
  type CoaSuggestLineInput,
  type CoaSuggestion,
  type OrderDirection,
} from "../../erp/coa-suggest.js";

interface CoaSuggestInput {
  items: CoaSuggestLineInput[];
}

interface CoaSuggestOutput {
  suggestions: CoaSuggestion[];
}

function readItems(rec: Record<string, unknown>): CoaSuggestLineInput[] {
  const raw = rec.items;
  if (!Array.isArray(raw)) {
    throw new InvalidJobInputError(
      "COA_SUGGEST handler: 'items' must be an array",
    );
  }
  return raw.map((entry, idx) => {
    if (typeof entry !== "object" || entry === null) {
      throw new InvalidJobInputError(
        `COA_SUGGEST handler: items[${idx}] must be an object`,
      );
    }
    const row = entry as Record<string, unknown>;
    const productName = row.productName;
    if (typeof productName !== "string") {
      throw new InvalidJobInputError(
        `COA_SUGGEST handler: items[${idx}].productName must be a string`,
      );
    }
    const orderTypeRaw = row.orderType;
    if (orderTypeRaw !== "SALE" && orderTypeRaw !== "PURCHASE") {
      throw new InvalidJobInputError(
        `COA_SUGGEST handler: items[${idx}].orderType must be 'SALE' or 'PURCHASE'`,
      );
    }
    const lineIndexRaw = row.lineIndex;
    const lineIndex =
      typeof lineIndexRaw === "number" && Number.isInteger(lineIndexRaw)
        ? lineIndexRaw
        : idx;
    return {
      lineIndex,
      productName,
      orderType: orderTypeRaw as OrderDirection,
    };
  });
}

export const coaSuggestHandler: AiJobHandler<CoaSuggestInput, CoaSuggestOutput> = {
  type: "COA_SUGGEST",
  async run(input) {
    const rec = asRecord(input, "COA_SUGGEST");
    const items = readItems(rec);
    const suggestions = suggestForLines(items);
    return { suggestions };
  },
};
