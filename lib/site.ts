// The public address printed on bracelet QR codes. A bracelet outlives any one deployment,
// so it always points at the stable production domain, never at localhost or a preview URL.
// Override with NEXT_PUBLIC_SITE_URL if the domain ever changes.
export const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://genomed-ai-jade.vercel.app").replace(/\/+$/, "");
