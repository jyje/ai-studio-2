"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export type SuggestionsProps = ComponentProps<"div">;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => {
  return (
    <div
      className={cn("w-full overflow-x-auto", className)}
      {...props}
    >
      <div className="flex gap-2 pb-2 px-1">
        {children}
      </div>
    </div>
  );
};

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion?: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  className,
  suggestion,
  onClick,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    if (suggestion && onClick) {
      onClick(suggestion);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "whitespace-nowrap cursor-pointer",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {suggestion || props.children}
    </Button>
  );
};

