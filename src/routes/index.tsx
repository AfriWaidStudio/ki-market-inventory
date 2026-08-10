import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBasket, HeartPulse, Briefcase, Store } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sabi — Know the price before you spend" },
      {
        name: "description",
        content:
          "Sabi shows what things really cost near you — food, fuel, transport, medicine — plus work that pays and a simple book for your shop.",
      },
      { property: "og:title", content: "Sabi — Know the price before you spend" },
      {
        property: "og:description",
        content: "Real prices from real people. Cheaper medicine. Work that pays. A shop book that adds up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  { icon: ShoppingBasket, title: "Prices", line: "See where rice, gas, fuel and data are cheapest today." },
  { icon: HeartPulse, title: "Health", line: "Find your medicine in stock, at the lowest price nearby." },
  { icon: Briefcase, title: "Work", line: "Jobs and gigs near you, with what they actually pay per hour." },
  { icon: Store, title: "My Shop", line: "Stock, sales, debtors and today's profit — in one place." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-2xl font-bold tracking-tight text-primary">Sabi</span>
        <Link
          to="/auth"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-10 md:py-16">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Sabi means "to know"</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Know what it really costs
            <br />
            <span className="text-primary">before you spend.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Prices from people around you. Medicine that's actually in stock. Work that pays. And a shop book
            that adds itself up. One app, four things that eat your day.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:opacity-90"
            >
              Start free
            </Link>
            <Link
              to="/home"
              className="rounded-full border border-border px-6 py-3 text-base font-medium hover:bg-muted"
            >
              Open Sabi
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, line }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{line}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
        <p className="mt-2">Sabi — built for everyday money decisions.</p>
      </footer>
    </div>
  );
}
