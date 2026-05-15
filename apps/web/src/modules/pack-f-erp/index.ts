import type { ModuleConfig } from "@axle/core-module-system";
import { erpCustomersModule } from "./erp-customers/module.config";
import { erpReportsModule } from "./erp-reports/module.config";
import { intakeModule } from "./intake/module.config";
import { inventoryModule } from "./inventory/module.config";
import { ordersModule } from "./orders/module.config";
import { packF } from "./pack.config";
import { productsModule } from "./products/module.config";
import { purchaseModule } from "./purchase/module.config";
import { shippingModule } from "./shipping/module.config";

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
