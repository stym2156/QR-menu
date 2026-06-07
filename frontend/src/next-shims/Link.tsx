import type { AnchorHTMLAttributes, ReactNode } from "react";
import { go } from "../lib/router";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  prefetch?: boolean;
};

export default function Link({ href, children, onClick, ...props }: LinkProps) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target
        ) {
          return;
        }
        event.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}
