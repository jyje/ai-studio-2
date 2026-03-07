"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { type BundledLanguage, codeToHtml, type ShikiTransformer } from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
  showLineNumbers?: boolean;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

const lineNumberTransformer: ShikiTransformer = {
  name: "line-numbers",
  line(node, line) {
    node.children.unshift({
      type: "element",
      tagName: "span",
      properties: {
        className: [
          "inline-block",
          "min-w-10",
          "mr-4",
          "text-right",
          "select-none",
          "text-muted-foreground",
        ],
      },
      children: [{ type: "text", value: String(line) }],
    });
  },
};

// Remove trailing empty span and blank lines from HTML to prevent extra blank line
function removeTrailingEmptySpan(html: string): string {
  // Remove all trailing empty spans (one or more) that appear right before </code>
  // Empty spans can have any attributes but contain only whitespace or nothing
  // Pattern: match one or more empty spans (with optional whitespace between them) followed by </code>
  // Empty span pattern: <span[any-attributes]>optional-whitespace</span>
  // This handles both single and multiple consecutive empty spans
  let cleaned = html;
  
  // First, try to match and remove empty spans right before </code>
  // Match: (empty span with optional whitespace around it) one or more times, then </code>
  cleaned = cleaned.replace(/(<span[^>]*>\s*<\/span>[\s\n\r]*)+<\/code>/s, '</code>');
  
  // If that didn't work, try a more aggressive pattern that matches any whitespace
  if (cleaned === html) {
    cleaned = cleaned.replace(/(<span[^>]*>\s*<\/span>\s*)+<\/code>/s, '</code>');
  }
  
  return cleaned;
}

export async function highlightCode(
  code: string,
  language: BundledLanguage,
  showLineNumbers = false
) {
  // Remove all trailing whitespace and newlines to prevent extra blank lines at the end
  const trimmedCode = code.trimEnd();
  
  const transformers: ShikiTransformer[] = showLineNumbers
    ? [lineNumberTransformer]
    : [];

  const [lightHtml, darkHtml] = await Promise.all([
    codeToHtml(trimmedCode, {
      lang: language,
      theme: "one-light",
      transformers,
    }),
    codeToHtml(trimmedCode, {
      lang: language,
      theme: "one-dark-pro",
      transformers,
    }),
  ]);

  // Remove trailing empty span from both HTML outputs
  return [removeTrailingEmptySpan(lightHtml), removeTrailingEmptySpan(darkHtml)];
}

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const [html, setHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");
  const mounted = useRef(false);

  useEffect(() => {
    highlightCode(code, language, showLineNumbers).then(([light, dark]) => {
      if (!mounted.current) {
        setHtml(light);
        setDarkHtml(dark);
        mounted.current = true;
      }
    });

    return () => {
      mounted.current = false;
    };
  }, [code, language, showLineNumbers]);

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
          className
        )}
        {...props}
      >
        <div className="relative w-full">
          <div
            className="overflow-x-auto overflow-y-hidden dark:hidden [&>pre]:m-0 [&>pre]:w-full [&>pre]:box-border [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-foreground! [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm [&_code]:block [&_code]:w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div
            className="hidden overflow-x-auto overflow-y-hidden dark:block [&>pre]:m-0 [&>pre]:w-full [&>pre]:box-border [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-foreground! [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm [&_code]:block [&_code]:w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
            dangerouslySetInnerHTML={{ __html: darkHtml }}
          />
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
