/**
 * Platform module registry entry point (WI-622~626, WI-701).
 *
 * Side-effect import: calling `registerAllPacks()` registers every pack +
 * module from packs A/B/D/E/F/G into `@axle/core-module-system`'s in-memory
 * registry. Pack F (ERP) entered the registry in WI-701 (Phase 20) with
 * metadata-only entries ahead of the schema + UI WIs.
 *
 * The existing `apps/web/src/lib/sidebar-builder.ts` still bootstraps from
 * `module-catalog.ts` for backward compatibility; this entry point can be
 * substituted in a follow-up WI without breaking the sidebar.
 */

import {
  registerModule,
  registerPack,
} from "@axle/core-module-system";

import { packA, packAModules } from "./pack-a-business/index.js";
import { packB, packBModules } from "./pack-b-rd-support/index.js";
import { packD, packDModules } from "./pack-d-hr/index.js";
import { packE, packEModules } from "./pack-e-content/index.js";
import { packF, packFModules } from "./pack-f-erp/index.js";
import { packG, packGModules } from "./pack-g-desktop/index.js";

let registered = false;

export function registerAllPacks(): void {
  if (registered) return;
  for (const pack of [packA, packB, packD, packE, packF, packG]) {
    registerPack(pack);
  }
  for (const mod of [
    ...packAModules,
    ...packBModules,
    ...packDModules,
    ...packEModules,
    ...packFModules,
    ...packGModules,
  ]) {
    registerModule(mod);
  }
  registered = true;
}

/** Test-only — re-register on the next call. */
export function resetPlatformRegistration(): void {
  registered = false;
}

export const ALL_PACKS = [packA, packB, packD, packE, packF, packG] as const;
export const ALL_MODULES = [
  ...packAModules,
  ...packBModules,
  ...packDModules,
  ...packEModules,
  ...packFModules,
  ...packGModules,
];
