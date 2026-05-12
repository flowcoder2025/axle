export type {
  BuildSidebarInput,
  InstallerDeps,
  ModuleConfig,
  ModuleDeps,
  ModuleId,
  ModuleInstallHookContext,
  NavItem,
  PackConfig,
  PackId,
  PackPricing,
  PrismaClientLike,
  SidebarSection,
  WidgetDef,
} from "./types.js";

export {
  clearRegistry,
  getModule,
  getPack,
  listModules,
  listPacks,
  registerModule,
  registerPack,
} from "./registry.js";

export {
  checkDependencies,
  findDependents,
  topologicalSort,
  type DependencyCheckResult,
} from "./dependencies.js";

export {
  getInstalledModules,
  installModule,
  installPack,
  isModuleInstalled,
  uninstallModule,
} from "./installer.js";

export { buildSidebar } from "./sidebar.js";
