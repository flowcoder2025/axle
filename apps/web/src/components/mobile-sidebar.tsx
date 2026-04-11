"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@axle/ui";
import { AppSidebar } from "./app-sidebar";

interface MobileSidebarProps {
  userMenu: React.ReactNode;
}

export function MobileSidebar({ userMenu }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sheet on navigation
  const handleClick = () => {
    // Small delay to allow navigation to start
    setTimeout(() => setOpen(false), 100);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="메뉴 열기"
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <Menu size={20} className="text-foreground/70" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" onClick={handleClick}>
        <SheetTitle className="sr-only">메뉴</SheetTitle>
        <AppSidebar userMenu={userMenu} />
      </SheetContent>
    </Sheet>
  );
}
