"use server";
import { cookies } from "next/headers";

export async function setLang(lang: "en" | "ka") {
  (await cookies()).set("lang", lang === "ka" ? "ka" : "en", { path: "/", maxAge: 31536000, sameSite: "lax" });
}
