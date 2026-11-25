import React from "react";
import { listListings } from "@/domain/listing/listingService";
import { HomeCatalogClient } from "@/components/home/HomeCatalogClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data } = await listListings({ limit: 24, sort: "newest" });
  return <HomeCatalogClient initialListings={data} />;
}
