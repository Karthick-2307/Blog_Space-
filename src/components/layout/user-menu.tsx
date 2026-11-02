"use client";

import Link from "next/link";
import { Bookmark, LayoutDashboard, LogOut, PenSquare, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/user-avatar";
import { displayName } from "@/lib/format";
import type { Viewer } from "@/lib/auth";

export function UserMenu({ viewer }: { viewer: Viewer }) {
  const items = [
    { href: `/profile/${viewer.username}`, label: "Your profile", icon: User },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/write", label: "Write a post", icon: PenSquare },
    { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  function signOut() {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Open account menu"
      >
        <UserAvatar user={viewer} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-medium text-foreground">{displayName(viewer)}</span>
            <span className="truncate text-xs">@{viewer.username}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} render={<Link href={href} />}>
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
