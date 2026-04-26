"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@axle/ui";
import { ShieldCheck, Trash2, Upload, KeyRound } from "lucide-react";

interface CertificateRow {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
}

interface AccountRow {
  id: string;
  portal: "HOMETAX" | "MINWON24" | "INSURANCE";
  userId: string;
  createdAt: string;
}

interface PortalCredentialsResponse {
  data: {
    certificates: CertificateRow[];
    accounts: AccountRow[];
  };
}

interface PortalCredentialsTabProps {
  clientId: string;
}

const PORTAL_LABELS: Record<AccountRow["portal"], string> = {
  HOMETAX: "홈택스",
  MINWON24: "정부24",
  INSURANCE: "4대보험",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR");
}

function expiryBadge(validTo: string) {
  const ms = new Date(validTo).getTime() - Date.now();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return <Badge variant="destructive">만료됨</Badge>;
  }
  if (days <= 30) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        {days}일 후 만료
      </Badge>
    );
  }
  return <Badge variant="secondary">{formatDate(validTo)}</Badge>;
}

async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function PortalCredentialsTab({ clientId }: PortalCredentialsTabProps) {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState("");

  const [accountPortal, setAccountPortal] =
    useState<AccountRow["portal"]>("MINWON24");
  const [accountUserId, setAccountUserId] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  const baseUrl = useMemo(
    () => `/api/clients/${clientId}/portal-credentials`,
    [clientId],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PortalCredentialsResponse;
      setCertificates(json.data.certificates);
      setAccounts(json.data.accounts);
    } catch (err) {
      toast.error("자격증명을 불러오지 못했습니다");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleUpload = async () => {
    if (!pfxFile) {
      toast.error("PFX 파일을 선택하세요");
      return;
    }
    if (!pfxPassword) {
      toast.error("인증서 비밀번호를 입력하세요");
      return;
    }
    setUploading(true);
    try {
      const pfxBase64 = await readFileAsBase64(pfxFile);
      const res = await fetch(`${baseUrl}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pfxBase64, password: pfxPassword }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("인증서를 등록했습니다");
      setPfxFile(null);
      setPfxPassword("");
      await fetchAll();
    } catch (err) {
      toast.error(`인증서 등록 실패: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (!window.confirm("인증서를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${baseUrl}/certificates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("인증서를 삭제했습니다");
      await fetchAll();
    } catch (err) {
      toast.error(`삭제 실패: ${(err as Error).message}`);
    }
  };

  const handleSaveAccount = async () => {
    if (!accountUserId.trim() || !accountPassword) {
      toast.error("아이디와 비밀번호를 모두 입력하세요");
      return;
    }
    setSavingAccount(true);
    try {
      const res = await fetch(`${baseUrl}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal: accountPortal,
          userId: accountUserId.trim(),
          password: accountPassword,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("포털 계정을 등록했습니다");
      setAccountUserId("");
      setAccountPassword("");
      await fetchAll();
    } catch (err) {
      toast.error(`계정 등록 실패: ${(err as Error).message}`);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm("포털 계정을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${baseUrl}/accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("포털 계정을 삭제했습니다");
      await fetchAll();
    } catch (err) {
      toast.error(`삭제 실패: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-8" data-testid="portal-credentials-tab">
      <p className="text-sm text-muted-foreground">
        포털 자동화에 사용할 공인인증서와 계정을 관리합니다. 모든 자격증명은
        AES-256-GCM으로 암호화되어 저장되며, 평문은 화면에 노출되지 않습니다.
      </p>

      {/* Certificates */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">공인인증서 (PFX)</h2>
        </div>

        <div
          data-testid="certificate-upload-form"
          className="rounded-lg border bg-muted/30 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pfx-file">PFX 파일</Label>
              <Input
                id="pfx-file"
                data-testid="pfx-file-input"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(e) => setPfxFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pfx-password">인증서 비밀번호</Label>
              <Input
                id="pfx-password"
                data-testid="pfx-password-input"
                type="password"
                value={pfxPassword}
                onChange={(e) => setPfxPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <Button
            data-testid="upload-certificate-btn"
            onClick={handleUpload}
            disabled={uploading || !pfxFile || !pfxPassword}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "업로드 중..." : "인증서 등록"}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주체 (Subject)</TableHead>
                <TableHead>발급자</TableHead>
                <TableHead>유효기간</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    등록된 인증서가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                certificates.map((cert) => (
                  <TableRow key={cert.id} data-testid={`certificate-row-${cert.id}`}>
                    <TableCell className="font-medium">{cert.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cert.issuer}
                    </TableCell>
                    <TableCell>{expiryBadge(cert.validTo)}</TableCell>
                    <TableCell>
                      <Button
                        data-testid={`delete-certificate-${cert.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCertificate(cert.id)}
                        aria-label="인증서 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Portal accounts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">포털 계정 (ID/PW)</h2>
        </div>

        <div
          data-testid="account-form"
          className="rounded-lg border bg-muted/30 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="account-portal">포털</Label>
              <select
                id="account-portal"
                data-testid="account-portal-select"
                value={accountPortal}
                onChange={(e) =>
                  setAccountPortal(e.target.value as AccountRow["portal"])
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {(Object.keys(PORTAL_LABELS) as Array<keyof typeof PORTAL_LABELS>).map(
                  (k) => (
                    <option key={k} value={k}>
                      {PORTAL_LABELS[k]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-user-id">아이디</Label>
              <Input
                id="account-user-id"
                data-testid="account-user-id-input"
                value={accountUserId}
                onChange={(e) => setAccountUserId(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-password">비밀번호</Label>
              <Input
                id="account-password"
                data-testid="account-password-input"
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <Button
            data-testid="save-account-btn"
            onClick={handleSaveAccount}
            disabled={savingAccount || !accountUserId || !accountPassword}
          >
            {savingAccount ? "저장 중..." : "계정 등록"}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>포털</TableHead>
                <TableHead>아이디</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    등록된 포털 계정이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id} data-testid={`account-row-${acc.id}`}>
                    <TableCell>
                      <Badge variant="secondary">{PORTAL_LABELS[acc.portal]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{acc.userId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(acc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        data-testid={`delete-account-${acc.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAccount(acc.id)}
                        aria-label="계정 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
