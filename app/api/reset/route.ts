import { resetDemo } from "@/lib/store";

export async function POST() {
  resetDemo();
  return Response.json({ ok: true });
}
