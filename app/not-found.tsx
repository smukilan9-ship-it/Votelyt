import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="We couldn't find that page"
      message="The link may be out of date, or the election ID might be wrong. Double-check the address, or head back to the start."
      actions={
        <>
          <Link href="/" className="btn btn-primary">Back to home</Link>
          <Link href="/vote" className="btn btn-glass">Enter an election ID</Link>
        </>
      }
    />
  );
}
