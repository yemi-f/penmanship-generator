import type { Metadata } from "next";

import { SampleLibrary } from "@/components/Dashboard/SampleLibrary";

export const metadata: Metadata = { title: "Handwriting Samples" };

export default function SamplesPage() {
  return <SampleLibrary />;
}
