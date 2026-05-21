import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  decimalToString,
  decimalToStringOrNull,
  dateToISO,
  serializeProduct,
  serializeInventoryMovement,
  serializeOrder,
  serializeOrderItem,
  serializeIntakeDraft,
} from "../../../lib/erp/serialize";

const ISO = "2026-05-15T00:00:00.000Z";

describe("decimalToString", () => {
  it("converts a Prisma.Decimal to its canonical string", () => {
    expect(decimalToString(new Prisma.Decimal("1234.56"))).toBe("1234.56");
  });
  it("treats null/undefined as 0", () => {
    expect(decimalToString(null)).toBe("0");
    expect(decimalToString(undefined)).toBe("0");
  });
  it("passes through plain numbers and strings", () => {
    expect(decimalToString(42)).toBe("42");
    expect(decimalToString("99.5")).toBe("99.5");
  });
});

describe("decimalToStringOrNull", () => {
  it("preserves null", () => {
    expect(decimalToStringOrNull(null)).toBeNull();
    expect(decimalToStringOrNull(undefined)).toBeNull();
  });
  it("converts present values like decimalToString", () => {
    expect(decimalToStringOrNull(new Prisma.Decimal("10"))).toBe("10");
  });
});

describe("dateToISO", () => {
  it("converts Date to ISO-8601", () => {
    expect(dateToISO(new Date("2026-05-15"))).toBe(ISO);
  });
  it("treats null/undefined as null", () => {
    expect(dateToISO(null)).toBeNull();
    expect(dateToISO(undefined)).toBeNull();
  });
});

describe("serializeProduct", () => {
  it("serializes Decimal + Date fields", () => {
    const s = serializeProduct({
      id: "p1",
      orgId: "org_1",
      sku: "SKU-1",
      name: "콜라",
      unit: "캔",
      unitPrice: new Prisma.Decimal("1500"),
      category: "음료",
      archived: false,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
    expect(s).toEqual({
      id: "p1",
      orgId: "org_1",
      sku: "SKU-1",
      name: "콜라",
      unit: "캔",
      unitPrice: "1500",
      category: "음료",
      // WI-726: coaCode is part of the serialized envelope; default null
      // when the caller doesn't pass one.
      coaCode: null,
      archived: false,
      createdAt: ISO,
      updatedAt: ISO,
    });
  });
  it("handles nullable sku/category/dates safely", () => {
    const s = serializeProduct({
      id: "p2",
      orgId: "org_1",
      sku: null,
      name: "기타",
      unit: "개",
      unitPrice: new Prisma.Decimal("0"),
      category: null,
      archived: true,
      createdAt: null,
      updatedAt: null,
    });
    expect(s.sku).toBeNull();
    expect(s.category).toBeNull();
    expect(s.coaCode).toBeNull();
    expect(s.createdAt).toBeNull();
    expect(s.unitPrice).toBe("0");
  });
});

describe("serializeInventoryMovement", () => {
  it("converts unitCost (nullable Decimal) + occurredAt", () => {
    const s = serializeInventoryMovement({
      id: "m1",
      orgId: "org_1",
      productId: "p1",
      type: "IN",
      qty: 10,
      source: "RECEIPT_INTAKE",
      sourceId: "draft1",
      unitCost: new Prisma.Decimal("1200"),
      note: null,
      occurredAt: new Date("2026-05-15"),
      createdAt: new Date("2026-05-15"),
    });
    expect(s.unitCost).toBe("1200");
    expect(s.occurredAt).toBe(ISO);
  });
  it("keeps unitCost null when absent", () => {
    const s = serializeInventoryMovement({
      id: "m2",
      orgId: "org_1",
      productId: "p1",
      type: "OUT",
      qty: 1,
      source: null,
      sourceId: null,
      unitCost: null,
      note: null,
      occurredAt: new Date("2026-05-15"),
      createdAt: new Date("2026-05-15"),
    });
    expect(s.unitCost).toBeNull();
  });
});

describe("serializeOrderItem", () => {
  it("converts unitPrice + lineTotal", () => {
    const s = serializeOrderItem({
      id: "i1",
      orderId: "o1",
      productId: "p1",
      productName: "콜라",
      qty: 2,
      unitPrice: new Prisma.Decimal("1500"),
      lineTotal: new Prisma.Decimal("3000"),
    });
    expect(s.unitPrice).toBe("1500");
    expect(s.lineTotal).toBe("3000");
  });
});

describe("serializeOrder", () => {
  it("serializes top-level Decimal + Date and recurses into items", () => {
    const s = serializeOrder({
      id: "o1",
      orgId: "org_1",
      type: "SALE",
      counterpartyId: null,
      counterpartyName: "현금",
      status: "CONFIRMED",
      total: new Prisma.Decimal("3000"),
      tax: new Prisma.Decimal("273"),
      occurredAt: new Date("2026-05-15"),
      source: null,
      sourceId: null,
      note: null,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
      items: [
        {
          id: "i1",
          orderId: "o1",
          productId: "p1",
          productName: "콜라",
          qty: 2,
          unitPrice: new Prisma.Decimal("1500"),
          lineTotal: new Prisma.Decimal("3000"),
        },
      ],
    });
    expect(s.total).toBe("3000");
    expect(s.tax).toBe("273");
    expect(s.items?.[0]?.unitPrice).toBe("1500");
  });
});

describe("serializeIntakeDraft", () => {
  it("passes through JSON columns and serializes timestamps", () => {
    const s = serializeIntakeDraft({
      id: "d1",
      orgId: "org_1",
      userId: "u1",
      blobUrl: "https://blob/x",
      ocrJson: { text: "raw" },
      parsedJson: { lines: [] },
      matchSuggestions: [{ score: 0.9 }],
      status: "PENDING",
      confirmedOrderId: null,
      errorMsg: null,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
    expect(s.createdAt).toBe(ISO);
    expect(s.parsedJson).toEqual({ lines: [] });
  });
});
