"use client";

import { useEffect, useRef } from "react";

// View Only users read everything an Editor can, but can't change anything.
// Every write is refused on the server regardless (requirePermission in
// src/lib/access.ts); this just stops the page from offering controls that
// would only come back with "You don't have permission". It hides every form
// whose submit goes to a server action (React marks those with a hidden
// "$ACTION..." input) -- filters and period pickers are plain GET forms and
// stay. Rendered only for the VIEWER role, so Admin/Editor pages are untouched.
export default function ReadOnlyGuard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const hideWriteForms = () => {
      root.querySelectorAll("form").forEach((form) => {
        const writes = form.querySelector('input[name^="$ACTION"]') !== null;
        if (writes) form.style.display = "none";
      });
    };
    hideWriteForms();
    const observer = new MutationObserver(hideWriteForms);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
