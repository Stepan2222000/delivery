import { LookupDetailView } from "@/components/lookup/LookupDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LookupDetailView id={id} role="admin" backHref="/admin/unknown" />;
}
