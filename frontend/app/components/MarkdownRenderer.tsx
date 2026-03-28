"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-7 text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="my-4 first:mt-0 last:mb-0">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-slate-200">{children}</em>;
          },
          ul({ children }) {
            return <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>;
          },
          li({ children }) {
            return <li className="pl-1">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-accent/30 underline-offset-4 transition hover:text-accentStrong"
              >
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-2 border-accent/40 pl-4 text-slate-300">
                {children}
              </blockquote>
            );
          },
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
              return <CodeBlock code={code} language={match[1]} />;
            }

            return (
              <code className="rounded-md bg-white/5 px-1.5 py-0.5 text-[0.9em] text-emerald-200">
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}