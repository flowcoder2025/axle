export { prisma, createPrismaClient } from "./client.js";
export { PrismaClient } from "@prisma/client";
export {
  check,
  grant,
  revoke,
  listPermissions,
  hasOrgAccess,
} from "./permissions.js";
export { checkProjectAccess } from "./project-access.js";
export const DB_PACKAGE = "@axle/db" as const;
