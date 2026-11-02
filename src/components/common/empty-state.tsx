import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-y border-border py-12", className)}>
      <div className="flex max-w-lg items-start gap-4">
        <Icon className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
