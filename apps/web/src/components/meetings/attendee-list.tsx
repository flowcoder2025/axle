"use client";

import { useState } from "react";
import { Button, Input, Label } from "@axle/ui";
import { Plus, Trash2, User } from "lucide-react";

export interface Attendee {
  id: string;
  name: string;
  role: string | null;
  contactId: string | null;
  userId: string | null;
}

interface AttendeeListProps {
  meetingId: string;
  attendees: Attendee[];
  onChanged?: () => void;
}

export function AttendeeList({ meetingId, attendees: initial, onChanged }: AttendeeListProps) {
  const [attendees, setAttendees] = useState<Attendee[]>(initial);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "참석자 추가에 실패했습니다.");
        return;
      }
      setAttendees((prev) => [...prev, json.data]);
      setNewName("");
      setNewRole("");
      setShowAddForm(false);
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(attendeeId: string) {
    setRemovingId(attendeeId);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message ?? "삭제에 실패했습니다.");
        return;
      }
      setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
      onChanged?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {attendees.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          참석자가 없습니다.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {attendees.map((attendee) => (
            <li
              key={attendee.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{attendee.name}</p>
                  {attendee.role && (
                    <p className="text-xs text-muted-foreground">{attendee.role}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={removingId === attendee.id}
                onClick={() => handleRemove(attendee.id)}
                aria-label={`${attendee.name} 제거`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showAddForm ? (
        <form onSubmit={handleAdd} className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">참석자 추가</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="attendee-name">
                이름 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attendee-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="홍길동"
                disabled={adding}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attendee-role">역할</Label>
              <Input
                id="attendee-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="예: 대표이사"
                disabled={adding}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
              {adding ? "추가 중..." : "추가"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
                setNewRole("");
              }}
              disabled={adding}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          참석자 추가
        </Button>
      )}
    </div>
  );
}
