import { getEmergencyByShortCode } from "@/lib/store";

// Compact bracelet link (fits a 25x25 QR): /B/<CODE> -> /e/<token>.
// Unknown or switched-off codes land on the same "not available" page as any bad link.
export async function GET(req: Request, ctx: RouteContext<"/B/[code]">) {
  const { code } = await ctx.params;
  const card = getEmergencyByShortCode(code);
  const url = new URL(req.url);
  const target = new URL(card?.token ? `/e/${card.token}` : "/e/unavailable", url.origin);
  const lang = url.searchParams.get("lang");
  if (lang) target.searchParams.set("lang", lang);
  return Response.redirect(target, 307);
}
