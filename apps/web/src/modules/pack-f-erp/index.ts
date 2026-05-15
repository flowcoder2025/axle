import type { ModuleConfig } from "@axle/core-module-system";
import { erpCustomersModule } from "./erp-customers/module.config.js";
import { erpReportsModule } from "./erp-reports/module.config.js";
import { intakeModule } from "./intake/module.config.js";
import { inventoryModule } from "./inventory/module.config.js";
import { ordersModule } from "./orders/module.config.js";
import { packF } from "./pack.config.js";
import { productsModule } from "./products/module.config.js";
import { purchaseModule } from "./purchase/module.config.js";
import { shippingModule } from "./shipping/module.config.js";

export { packF };
export {
  erpCustomersModule,
  erpReportsModule,
  intakeModule,
  inventoryModule,
  ordersModule,
  productsModule,
  purchaseModule,
  shippingModule,
};

export const packFModules: ModuleConfig[] = [
  productsModule,
  inventoryModule,
  ordersModule,
  intakeModule,
  erpCustomersModule,
  shippingModule,
  purchaseModule,
  erpReportsModule,
];
