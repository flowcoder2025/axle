import type { ModuleConfig, ModuleId, PackConfig, PackId } from "./types.js";

const moduleRegistry = new Map<ModuleId, ModuleConfig>();
const packRegistry = new Map<PackId, PackConfig>();

export function registerModule(config: ModuleConfig): void {
  if (!config.id) {
    throw new Error("ModuleConfig.id is required");
  }
  if (!config.packId) {
    throw new Error(`Module ${config.id}: packId is required`);
  }
  moduleRegistry.set(config.id, config);
}

export function registerPack(config: PackConfig): void {
  if (!config.id) {
    throw new Error("PackConfig.id is required");
  }
  packRegistry.set(config.id, config);
}

export function getModule(id: ModuleId): ModuleConfig | undefined {
  return moduleRegistry.get(id);
}

export function getPack(id: PackId): PackConfig | undefined {
  return packRegistry.get(id);
}

export function listModules(): ModuleConfig[] {
  return Array.from(moduleRegistry.values());
}

export function listPacks(): PackConfig[] {
  return Array.from(packRegistry.values());
}

/** Test-only — wipe the in-memory catalog. */
export function clearRegistry(): void {
  moduleRegistry.clear();
  packRegistry.clear();
}
