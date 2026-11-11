// Slim notice shown above the site so visitors (and reviewers) know this is a portfolio demo.
// Hide it with NEXT_PUBLIC_DEMO_BANNER=false once this becomes a real store.
export default function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_BANNER === "false") return null;
  const testMode = /^sk_test_[A-Za-z0-9]{10,}$/.test(process.env.STRIPE_SECRET_KEY ?? "");
  return (
    <div className="bg-ink-950 px-4 py-2 text-center text-xs text-white/80">
      <strong className="font-semibold text-white">Portfolio demo</strong> &mdash; not a real store.{" "}
      {testMode ? (
        <>
          Payments run in Stripe test mode (card <span className="font-mono">4242 4242 4242 4242</span>, any future date,
          any CVC); nothing will ship.
        </>
      ) : (
        <>Browse, search, build a cart, and create an account; checkout is turned off and nothing will ship.</>
      )}
    </div>
  );
}
