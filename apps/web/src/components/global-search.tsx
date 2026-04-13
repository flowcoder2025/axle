"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@axle/ui";
import { Users, FolderOpen, Video, FileText, Briefcase } from "lucide-react";

interface SearchResults {
  clients: Array<{ id: string; name: string; industry?: string | null }>;
  projects: Array<{ id: string; title: string; status: string; client: { name: string } }>;
  meetings: Array<{ id: string; title: string; date: string }>;
  documents: Array<{ id: string; name: string; category: string }>;
  programs: Array<{ id: string; name: string; category?: string | null }>;
}

const EMPTY_RESULTS: SearchResults = {
  clients: [],
  projects: [],
  meetings: [],
  documents: [],
  programs: [],
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);

  // Cmd+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const hasResults =
    results.clients.length > 0 ||
    results.projects.length > 0 ||
    results.meetings.length > 0 ||
    results.documents.length > 0 ||
    results.programs.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <span className="hidden sm:inline">검색...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="고객, 프로젝트, 미팅, 서류 검색..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              검색 중...
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          )}

          {results.clients.length > 0 && (
            <CommandGroup heading="고객사">
              {results.clients.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => navigate(`/clients/${c.id}`)}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{c.name}</span>
                  {c.industry && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {c.industry}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.projects.length > 0 && (
            <CommandGroup heading="프로젝트">
              {results.projects.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => navigate(`/projects/${p.id}`)}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {p.client.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.meetings.length > 0 && (
            <CommandGroup heading="미팅">
              {results.meetings.map((m) => (
                <CommandItem
                  key={m.id}
                  onSelect={() => navigate(`/meetings/${m.id}`)}
                >
                  <Video className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{m.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(m.date).toLocaleDateString("ko-KR")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.documents.length > 0 && (
            <CommandGroup heading="서류">
              {results.documents.map((d) => (
                <CommandItem
                  key={d.id}
                  onSelect={() => navigate("/documents")}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{d.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.programs.length > 0 && (
            <CommandGroup heading="지원사업">
              {results.programs.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => navigate(`/programs/${p.id}`)}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
