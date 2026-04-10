"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axle/ui";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { ContactForm, type Contact } from "./contact-form";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ContactListProps {
  clientId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatPhone(phone: string | null | undefined) {
  return phone ?? "-";
}

function formatEmail(email: string | null | undefined) {
  return email ?? "-";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ContactList({ clientId }: ContactListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts?pageSize=100`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "인물 목록을 불러오지 못했습니다"
        );
      }
      const json = await res.json();
      setContacts((json as { data: Contact[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleAddClick() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function handleEditClick(contact: Contact) {
    setEditing(contact);
    setFormOpen(true);
  }

  async function handleDeleteClick(contact: Contact) {
    if (!confirm(`"${contact.name}"을(를) 삭제하시겠습니까?`)) return;

    setDeletingId(contact.id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/contacts/${contact.id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ??
            "삭제에 실패했습니다"
        );
      }
      await fetchContacts();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "삭제에 실패했습니다");
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">인물 목록</h3>
          {!loading && !error && (
            <p className="text-xs text-muted-foreground mt-0.5">
              총 {contacts.length}명
            </p>
          )}
        </div>
        <Button size="sm" onClick={handleAddClick}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          인물 추가
        </Button>
      </div>

      {/* Error states */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          불러오는 중...
        </div>
      )}

      {/* Empty */}
      {!loading && !error && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 인물이 없습니다.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleAddClick}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            첫 인물 추가
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && contacts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>직위</TableHead>
              <TableHead>부서</TableHead>
              <TableHead>전화</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>구분</TableHead>
              <TableHead className="w-20 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className={contact.isPrimary ? "bg-primary/5" : undefined}
              >
                {/* 이름 */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{contact.name}</span>
                    {contact.isResearcher && (
                      <span
                        title={`연구 분야: ${contact.researchField ?? "미지정"}`}
                        aria-label="연구원"
                        className="text-base"
                      >
                        🔬
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* 직위 */}
                <TableCell className="text-muted-foreground">
                  {contact.position ?? "-"}
                </TableCell>

                {/* 부서 */}
                <TableCell className="text-muted-foreground">
                  {contact.department ?? "-"}
                </TableCell>

                {/* 전화 */}
                <TableCell className="text-muted-foreground">
                  {formatPhone(contact.phone)}
                </TableCell>

                {/* 이메일 */}
                <TableCell className="text-muted-foreground">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:underline"
                    >
                      {formatEmail(contact.email)}
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>

                {/* 구분 badges */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.isPrimary && (
                      <Badge variant="default" className="text-xs">
                        주연락처
                      </Badge>
                    )}
                    {contact.isResearcher && (
                      <Badge variant="secondary" className="text-xs">
                        연구원
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="편집"
                      onClick={() => handleEditClick(contact)}
                      disabled={deletingId === contact.id}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">편집</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="삭제"
                      onClick={() => handleDeleteClick(contact)}
                      disabled={deletingId === contact.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">삭제</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Form dialog */}
      <ContactForm
        clientId={clientId}
        contact={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchContacts}
      />
    </div>
  );
}
