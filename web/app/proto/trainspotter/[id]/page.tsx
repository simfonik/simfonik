import { redirect } from "next/navigation";

// PROTOTYPE (SIM-37). The page moved to a shorter address; a link to the old one still arrives.
export default async function TrainspotterMoved({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/spot/${(await params).id}`);
}
