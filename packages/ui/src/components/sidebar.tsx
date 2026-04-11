"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, collapsed = false, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col h-full transition-all duration-300",
        collapsed ? "w-14" : "w-64",
        className,
      )}
      style={{
        backgroundColor: "hsl(var(--sidebar-background))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
        color: "hsl(var(--sidebar-foreground))",
        ...style,
      }}
      {...props}
    />
  ),
);
Sidebar.displayName = "Sidebar";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center px-4 py-3 border-b border-[hsl(var(--sidebar-border))]", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto py-2", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-4 py-3 border-t border-[hsl(var(--sidebar-border))]", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

interface SidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  icon?: React.ReactNode;
  label?: string;
  collapsed?: boolean;
}

const SidebarItem = React.forwardRef<HTMLDivElement, SidebarItemProps>(
  ({ className, active = false, icon, label, collapsed = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 px-3 py-2 mx-1 rounded-md cursor-pointer transition-colors",
        active
          ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-semibold"
          : "text-[hsl(var(--sidebar-foreground)/0.7)] hover:bg-[hsl(var(--sidebar-accent)/0.5)] hover:text-[hsl(var(--sidebar-foreground))]",
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0 w-5 h-5">{icon}</span>}
      {!collapsed && label && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </div>
  ),
);
SidebarItem.displayName = "SidebarItem";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "px-4 py-1 text-xs font-semibold text-[hsl(var(--sidebar-foreground)/0.6)] uppercase tracking-wider",
      className,
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarGroup,
  SidebarGroupLabel,
};
