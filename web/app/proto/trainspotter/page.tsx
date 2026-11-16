import { redirect } from "next/navigation";

// PROTOTYPE (SIM-37). The page moved to a shorter address; a link to the old one still arrives.
export default function TrainspotterIndex() {
  redirect("/spot");
}
