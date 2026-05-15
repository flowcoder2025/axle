export interface BusinessCardData {
  name: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  address: string | null;
}

export interface BusinessVerifyResult {
  valid: boolean;
  status: "정상" | "휴업" | "폐업";
  businessName?: string;
  ceoName?: string;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  unit: string | null;
}

export interface ReceiptData {
  vendor: string;
  date: string | null;
  type: "purchase" | "sale" | "unknown";
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: "KRW";
  confidence: number;
}
