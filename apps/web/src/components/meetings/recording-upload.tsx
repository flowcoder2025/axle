"use client";

import { useRef, useState } from "react";
import { Button } from "@axle/ui";
import { Upload, Music } from "lucide-react";

interface RecordingUploadProps {
  meetingId: string;
  recordingUrl: string | null;
  onChanged?: (newUrl: string) => void;
}

const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "video/webm",
];
const ALLOWED_EXTENSIONS = ".mp3,.wav,.webm,.mp4,.m4a";

export function RecordingUpload({
  meetingId,
  recordingUrl: initialUrl,
  onChanged,
}: RecordingUploadProps) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`지원하지 않는 파일 형식입니다. (${ALLOWED_TYPES.join(", ")})`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/meetings/${meetingId}/recording`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "업로드에 실패했습니다.");
        return;
      }

      const newUrl = json.data?.recordingUrl as string;
      setRecordingUrl(newUrl);
      onChanged?.(newUrl);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Existing recording player */}
      {recordingUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">녹음 파일</span>
          </div>
          <audio
            controls
            src={recordingUrl}
            className="w-full rounded-md"
          >
            브라우저가 오디오 재생을 지원하지 않습니다.
          </audio>
        </div>
      )}

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50",
          uploading ? "opacity-50 pointer-events-none" : "",
        ].join(" ")}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-center text-muted-foreground">
          {uploading
            ? "업로드 중..."
            : "녹음 파일을 드래그하거나 버튼을 클릭하세요"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          MP3, WAV, WebM, MP4 지원
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {recordingUrl ? "파일 교체" : "파일 선택"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
