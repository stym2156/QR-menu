"use client";

// Top-level error boundary required for Sentry to report fatal client
// errors that escape route segments. Next.js calls this when an error
// bubbles out of the whole tree.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="th">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            เกิดข้อผิดพลาด
          </h2>
          <p className="mt-2 text-sm text-muted">
            ระบบเจอปัญหา — ทีมงานได้รับการแจ้งเตือนแล้ว ลองกดด้านล่างเพื่อโหลดใหม่
          </p>
          {error.digest ? (
            <p className="mt-3 text-[10px] font-mono text-muted">
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface transition hover:bg-ink/85"
          >
            โหลดใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
