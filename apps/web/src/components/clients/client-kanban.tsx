"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card } from "@axle/ui";

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export interface KanbanClient {
  id: string;
  name: string;
  ceoName?: string | null;
  status: ClientStatus;
  assignedToId?: string | null;
  assignedToUser?: { id: string; name: string | null; email: string } | null;
  industry?: string | null;
}

interface Column {
  status: ClientStatus;
  label: string;
  headerClass: string;
  countClass: string;
}

const COLUMNS: Column[] = [
  {
    status: "PROSPECT",
    label: "잠재고객",
    headerClass: "bg-blue-50 border-blue-200 text-blue-700",
    countClass: "bg-blue-100 text-blue-600",
  },
  {
    status: "ACTIVE",
    label: "활성",
    headerClass: "bg-green-50 border-green-200 text-green-700",
    countClass: "bg-green-100 text-green-600",
  },
  {
    status: "INACTIVE",
    label: "비활성",
    headerClass: "bg-gray-50 border-gray-200 text-gray-600",
    countClass: "bg-gray-100 text-gray-500",
  },
];

interface ClientKanbanProps {
  clients: KanbanClient[];
}

export function ClientKanban({ clients: initialClients }: ClientKanbanProps) {
  const [clients, setClients] = useState<KanbanClient[]>(initialClients);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ClientStatus | null>(null);
  const dragClientRef = useRef<KanbanClient | null>(null);

  function getColumnClients(status: ClientStatus) {
    return clients.filter((c) => c.status === status);
  }

  function handleDragStart(client: KanbanClient) {
    setDraggingId(client.id);
    dragClientRef.current = client;
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
    dragClientRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, status: ClientStatus) {
    e.preventDefault();
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: React.DragEvent, targetStatus: ClientStatus) {
    e.preventDefault();
    setDragOverColumn(null);

    const client = dragClientRef.current;
    if (!client || client.status === targetStatus) {
      setDraggingId(null);
      dragClientRef.current = null;
      return;
    }

    // Optimistic update
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, status: targetStatus } : c))
    );
    setDraggingId(null);
    dragClientRef.current = null;

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        // Rollback on failure
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, status: client.status } : c))
        );
      }
    } catch {
      // Rollback on network error
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, status: client.status } : c))
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const colClients = getColumnClients(col.status);
        const isOver = dragOverColumn === col.status;

        return (
          <div
            key={col.status}
            className={`flex flex-col rounded-lg border transition-colors ${
              isOver ? "border-2 border-dashed border-primary/50 bg-primary/5" : "border-border bg-muted/20"
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between rounded-t-lg border-b px-4 py-3 ${col.headerClass}`}>
              <span className="font-semibold text-sm">{col.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${col.countClass}`}>
                {colClients.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-3 min-h-[200px]">
              {colClients.length === 0 && (
                <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
                  {isOver ? "여기에 놓기" : "고객사 없음"}
                </div>
              )}
              {colClients.map((client) => {
                const isDragging = draggingId === client.id;
                return (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={() => handleDragStart(client)}
                    onDragEnd={handleDragEnd}
                    className={`transition-opacity ${isDragging ? "opacity-40" : "opacity-100"}`}
                  >
                    <Card className="cursor-grab p-3 shadow-sm hover:shadow-md active:cursor-grabbing">
                      <Link
                        href={`/clients/${client.id}`}
                        className="block font-medium text-sm hover:underline"
                        onClick={(e) => {
                          // Prevent navigation during drag
                          if (draggingId) e.preventDefault();
                        }}
                      >
                        {client.name}
                      </Link>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {client.ceoName && <p>대표: {client.ceoName}</p>}
                        {client.industry && <p>업종: {client.industry}</p>}
                        {client.assignedToUser && <p>담당: {client.assignedToUser.name ?? client.assignedToUser.email}</p>}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
