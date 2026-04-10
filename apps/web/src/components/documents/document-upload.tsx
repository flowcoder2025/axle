"use client";

import { useState } from "react";
import { Button } from "@axle/ui";
import { Upload } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface DocumentUploadProps {
  clients: ClientOption[];
}

export function DocumentUpload({ clients }: DocumentUploadProps) {
  const [open, setOpen] = useState(false);

  // Minimal upload trigger — full upload dialog is out of WI-033 scope
  return (
    <Button size="sm" onClick={() => setOpen(!open)} disabled={clients.length === 0}>
      <Upload className="mr-1.5 h-4 w-4" />
      서류 업로드
    </Button>
  );
}
