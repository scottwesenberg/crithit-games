// Slim notice shown above the site so visitors (and reviewers) know this is a portfolio demo.
// Hide it with NEXT_PUBLIC_DEMO_BANNER=false once this becomes a real store.
export default function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_BANNER === "false") return null;
  return (
    <div className="bg-ink-950 px-4 py-2 text-center text-xs text-white/80">
      <strong className="font-semibold text-white">Portfolio demo</strong> &mdash; not a real store. Payments run in Stripe
      test mode (card <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC); nothing will ship.
    </div>
  );
}
