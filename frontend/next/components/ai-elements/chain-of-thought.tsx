"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = ({
  className,
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ChainOfThoughtProps) => {
  return (
    <Collapsible
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={cn("not-prose mb-4 w-full rounded-md border", className)}
      {...props}
    >
      {children}
    </Collapsible>
  );
};

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  children?: ReactNode;
};

export const ChainOfThoughtHeader = ({
  className,
  children,
  ...props
}: ChainOfThoughtHeaderProps) => {
  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </CollapsibleTrigger>
  );
};

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: LucideIcon;
  label?: string;
  description?: string;
  status?: "complete" | "active" | "pending";
};

export const ChainOfThoughtStep = ({
  className,
  icon: Icon,
  label,
  description,
  status = "pending",
  ...props
}: ChainOfThoughtStepProps) => {
  const statusConfig = {
    complete: {
      icon: CheckCircleIcon,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    active: {
      icon: ClockIcon,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    pending: {
      icon: CircleIcon,
      color: "text-gray-400 dark:text-gray-500",
      bgColor: "bg-gray-50 dark:bg-gray-900",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = Icon || config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-md",
        config.bgColor,
        className
      )}
      {...props}
    >
      <StatusIcon className={cn("size-5 shrink-0 mt-0.5", config.color)} />
      <div className="flex-1 min-w-0">
        {label && (
          <div className="font-medium text-sm text-foreground">{label}</div>
        )}
        {description && (
          <div className="text-sm text-muted-foreground mt-1">
            {description}
          </div>
        )}
      </div>
      <Badge variant="outline" className="shrink-0">
        {status === "complete"
          ? "Complete"
          : status === "active"
          ? "Active"
          : "Pending"}
      </Badge>
    </div>
  );
};

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = ({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultsProps) => {
  return (
    <div
      className={cn("flex flex-wrap gap-2 p-3", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = ({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultProps) => {
  return (
    <Badge
      variant="outline"
      className={cn("cursor-pointer hover:bg-accent", className)}
      {...props}
    >
      {children}
    </Badge>
  );
};

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = ({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) => {
  return (
    <CollapsibleContent
      className={cn("px-4 pb-4 space-y-3", className)}
      {...props}
    >
      {children}
    </CollapsibleContent>
  );
};

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
};

export const ChainOfThoughtImage = ({
  className,
  caption,
  children,
  ...props
}: ChainOfThoughtImageProps) => {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="rounded-md overflow-hidden border">{children}</div>
      {caption && (
        <div className="text-sm text-muted-foreground italic">{caption}</div>
      )}
    </div>
  );
};

