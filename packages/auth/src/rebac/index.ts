export {
  MODULE_SCOPES,
  MODULE_SCOPE_NAMESPACE,
  TENANT_SCOPE_NAMESPACE,
  anyScopeSatisfies,
  isKnownModuleScope,
  scopeSatisfies,
  type ModuleScope,
} from "./scopes.js";

export {
  checkModulePermission,
  checkModulePermissionLegacy,
  checkTenantScope,
  getUserModuleScopes,
  grantModuleScope,
  grantTenantScope,
  revokeModuleScope,
  revokeTenantScope,
  setRelationStore,
  type RelationStore,
} from "./check.js";
