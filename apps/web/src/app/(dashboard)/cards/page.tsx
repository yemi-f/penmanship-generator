import type { Metadata } from "next";

import { CardGrid } from "@/components/Dashboard/CardGrid";

export const metadata: Metadata = { title: "Cards" };

export default function CardsPage() {
  return <CardGrid />;
}
