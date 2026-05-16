/**
 * JSON-safe serializers for ERP Prisma rows.
 *
 * Server Components and API route handlers pass these through to Client
 * Components / HTTP responses. Two recurring hazards are converted here:
 *
 *   1. `Prisma.Decimal` instances do not survive `Response.json` faithfully
 *      (precision loss + opaque toJSON) — convert to canonical string.
 *   2. `Date` instances are stringified inconsistently across the RSC
 *      boundary — convert to ISO-8601 strings.
 *
 * All helpers are null-safe and return narrowed objects so callers get
 * predictable JSON shapes regardless of whether nullable columns are null.
 */

import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Convert any Decimal-shaped value to its canonical string form. Nullish → "0". */
export function decimalToString(value: DecimalLike): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return value.toString();
}

/** Convert a Decimal column to a JSON-safe string, preserving null. */
export function decimalToStringOrNull(value: DecimalLike): string | null {
  if (value === null || value === undefined) return null;
  return decimalToString(value);
}

/** Convert a Date to ISO-8601 string. Nullish → null. */
export function dateToISO(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ---------------- Product ----------------

export interface SerializedProduct {
  id: string;
  orgId: string;
  sku: string | null;
  name: string;
  unit: string;
  unitPrice: string;
  category: string | null;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function serializeProduct(p: {
  id: string;
  orgId: string;
  sku: string | null;
  name: string;
  unit: string;
  unitPrice: DecimalLike;
  category: string | null;
  archived: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}): SerializedProduct {
  return {
    id: p.id,
    orgId: p.orgId,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    unitPrice: decimalToString(p.unitPrice),
    category: p.category,
    archived: p.archived,
    createdAt: dateToISO(p.createdAt),
    updatedAt: dateToISO(p.updatedAt),
  };
}

// ---------------- InventoryMovement ----------------

export interface SerializedInventoryMovement {
  id: string;
  orgId: string;
  productId: string;
  type: string;
  qty: number;
  source: string | null;
  sourceId: string | null;
  unitCost: string | null;
  note: string | null;
  occurredAt: string | null;
  createdAt: string | null;
}

export function serializeInventoryMovement(m: {
  id: string;
  orgId: string;
  productId: string;
  type: string;
  qty: number;
  source: string | null;
  sourceId: string | null;
  unitCost: DecimalLike;
  note: string | null;
  occurredAt: Date | null;
  createdAt: Date | null;
}): SerializedInventoryMovement {
  return {
    id: m.id,
    orgId: m.orgId,
    productId: m.productId,
    type: m.type,
    qty: m.qty,
    source: m.source,
    sourceId: m.sourceId,
    unitCost: decimalToStringOrNull(m.unitCost),
    note: m.note,
    occurredAt: dateToISO(m.occurredAt),
    createdAt: dateToISO(m.createdAt),
  };
}

// ---------------- OrderItem ----------------

export interface SerializedOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
}

export function serializeOrderItem(i: {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  qty: number;
  unitPrice: DecimalLike;
  lineTotal: DecimalLike;
}): SerializedOrderItem {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    productName: i.productName,
    qty: i.qty,
    unitPrice: decimalToString(i.unitPrice),
    lineTotal: decimalToString(i.lineTotal),
  };
}

// ---------------- Order ----------------

export interface SerializedOrder {
  id: string;
  orgId: string;
  type: string;
  counterpartyId: string | null;
  counterpartyName: string;
  status: string;
  total: string;
  tax: string;
  occurredAt: string | null;
  source: string | null;
  sourceId: string | null;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items?: SerializedOrderItem[];
}

export function serializeOrder(o: {
  id: string;
  orgId: string;
  type: string;
  counterpartyId: string | null;
  counterpartyName: string;
  status: string;
  total: DecimalLike;
  tax: DecimalLike;
  occurredAt: Date | null;
  source: string | null;
  sourceId: string | null;
  note: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  items?: Parameters<typeof serializeOrderItem>[0][];
}): SerializedOrder {
  return {
    id: o.id,
    orgId: o.orgId,
    type: o.type,
    counterpartyId: o.counterpartyId,
    counterpartyName: o.counterpartyName,
    status: o.status,
    total: decimalToString(o.total),
    tax: decimalToString(o.tax),
    occurredAt: dateToISO(o.occurredAt),
    source: o.source,
    sourceId: o.sourceId,
    note: o.note,
    createdAt: dateToISO(o.createdAt),
    updatedAt: dateToISO(o.updatedAt),
    ...(o.items ? { items: o.items.map(serializeOrderItem) } : {}),
  };
}

// ---------------- IntakeDraft ----------------

export interface SerializedIntakeDraft {
  id: string;
  orgId: string;
  userId: string | null;
  blobUrl: string;
  ocrJson: unknown;
  parsedJson: unknown;
  matchSuggestions: unknown;
  status: string;
  confirmedOrderId: string | null;
  errorMsg: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function serializeIntakeDraft(d: {
  id: string;
  orgId: string;
  userId: string | null;
  blobUrl: string;
  ocrJson: unknown;
  parsedJson: unknown;
  matchSuggestions: unknown;
  status: string;
  confirmedOrderId: string | null;
  errorMsg: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): SerializedIntakeDraft {
  return {
    id: d.id,
    orgId: d.orgId,
    userId: d.userId,
    blobUrl: d.blobUrl,
    ocrJson: d.ocrJson,
    parsedJson: d.parsedJson,
    matchSuggestions: d.matchSuggestions,
    status: d.status,
    confirmedOrderId: d.confirmedOrderId,
    errorMsg: d.errorMsg,
    createdAt: dateToISO(d.createdAt),
    updatedAt: dateToISO(d.updatedAt),
  };
}

// ---------------- ErpCounterparty (Phase 21 WI-722) ----------------

export interface SerializedErpCounterparty {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  bizRegNo: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  defaultCoaCode: string | null;
  deletedAt: string | null;
  mergedIntoId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function serializeCounterparty(c: {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  bizRegNo: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  type: string;
  defaultCoaCode: string | null;
  deletedAt: Date | null;
  mergedIntoId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): SerializedErpCounterparty {
  return {
    id: c.id,
    orgId: c.orgId,
    name: c.name,
    normalizedName: c.normalizedName,
    bizRegNo: c.bizRegNo,
    address: c.address,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    contactEmail: c.contactEmail,
    type: c.type as "CUSTOMER" | "SUPPLIER" | "BOTH",
    defaultCoaCode: c.defaultCoaCode,
    deletedAt: dateToISO(c.deletedAt),
    mergedIntoId: c.mergedIntoId,
    createdAt: dateToISO(c.createdAt),
    updatedAt: dateToISO(c.updatedAt),
  };
}
