import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Person = { username: string; display_name: string | null; avatar_url: string | null } | null;

export function UserAvatar({
  user,
  size = "default",
  className,
}: {
  user: Person;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const name = displayName(user);
  return (
    <Avatar size={size} className={className}>
      {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
      <AvatarFallback
        className={cn("bg-accent font-medium text-accent-foreground", size === "lg" && "text-base")}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
