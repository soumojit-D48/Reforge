import type { Metadata } from "next";
import { ReforgeLanding } from "../components/landing/reforge-landing";

export const metadata: Metadata = {
  title: "Reforge - Controlled replay for AI-agent failures",
  description:
    "Inspect failed AI-agent traces, replay one controlled change, compare the result, and lock the fix into regression coverage.",
  openGraph: {
    title: "Reforge - Failures are evidence",
    description: "Turn an AI-agent failure from a mystery into a reproducible fix.",
    type: "website",
  },
};

export default function Home(): React.JSX.Element {
  return <ReforgeLanding />;
}
