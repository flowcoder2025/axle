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
