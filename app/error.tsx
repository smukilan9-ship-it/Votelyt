"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message="We hit an unexpected problem loading this page. You can try again, or contact the election admin if it keeps happening."
      actions={
        <>
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-glass">Back to home</Link>
        </>
      }
    />
  );
}
