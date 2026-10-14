import { requireOwner } from "@/lib/auth";
import { BlocksGallery } from "./BlocksGallery";

export default async function BlocksPage() {
  await requireOwner();
  return <BlocksGallery />;
}
