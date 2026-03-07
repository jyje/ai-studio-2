"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  type ComponentProps,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type NodeComponentProps = Omit<NodeProps, 'data'> & {
  handles?: { target: boolean; source: boolean };
  className?: string;
  children?: React.ReactNode;
};

export const Node = ({
  handles = { target: true, source: true },
  className,
  children,
  ...props
}: NodeComponentProps) => {
  return (
    <Card
      className={cn("w-[200px] min-w-[200px]", className)}
      {...(props as ComponentProps<typeof Card>)}
    >
      {handles.target && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-primary !border-2 !border-background !w-3 !h-3"
        />
      )}
      {children}
      {handles.source && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-primary !border-2 !border-background !w-3 !h-3"
        />
      )}
    </Card>
  );
};

export type NodeHeaderProps = ComponentProps<typeof CardHeader>;

export const NodeHeader = ({ className, ...props }: NodeHeaderProps) => (
  <CardHeader className={className} {...props} />
);

export type NodeTitleProps = ComponentProps<typeof CardTitle>;

export const NodeTitle = ({ ...props }: NodeTitleProps) => (
  <CardTitle {...props} />
);

export type NodeDescriptionProps = ComponentProps<typeof CardDescription>;

export const NodeDescription = ({ ...props }: NodeDescriptionProps) => (
  <CardDescription {...props} />
);

export type NodeActionProps = ComponentProps<typeof CardAction>;

export const NodeAction = ({ ...props }: NodeActionProps) => (
  <CardAction {...props} />
);

export type NodeContentProps = ComponentProps<typeof CardContent> & {
  className?: string;
};

export const NodeContent = ({ className, ...props }: NodeContentProps) => (
  <CardContent className={className} {...props} />
);

export type NodeFooterProps = ComponentProps<typeof CardFooter> & {
  className?: string;
};

export const NodeFooter = ({ className, ...props }: NodeFooterProps) => (
  <CardFooter className={className} {...props} />
);

