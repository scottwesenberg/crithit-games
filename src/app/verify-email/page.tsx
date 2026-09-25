import Link from "next/link";

const COPY: Record<string, { title: string; body: string }> = {
  success: {
    title: "Email verified!",
    body: "Your account is active. You can sign in now.",
  },
  expired: {
    title: "That link expired",
    body: "Verification links expire after 24 hours. Try registering again or contact support for a fresh link.",
  },
  missing: {
    title: "Missing verification token",
    body: "This link looks incomplete. Please use the link from your verification email.",
  },
};

export default function VerifyEmailPage({ searchParams }: { searchParams: { status?: string } }) {
  const copy = COPY[searchParams.status ?? ""] ?? {
    title: "Verify your email",
    body: "Check your inbox for a verification link to activate your account.",
  };

  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold">{copy.title}</h1>
      <p className="max-w-sm text-black/60">{copy.body}</p>
      <Link href="/login" className="btn-primary">Go to sign in</Link>
    </div>
  );
}
