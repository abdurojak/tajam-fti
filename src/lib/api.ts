import { NextResponse } from "next/server";
export function mutationAllowed(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next can normalize request.url to localhost; the browser uses the Host header.
  const expectedOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (origin && origin !== expectedOrigin)
    return NextResponse.json(
      { error: "Permintaan lintas situs tidak diizinkan." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json(
      { error: "Gunakan format JSON." },
      { status: 415 },
    );
  return null;
}
export async function readJson(request: Request) {
  const body = await request.text();
  if (body.length > 8_000_000)
    throw new Error("Data terlalu besar. Maksimal 8 MB.");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Data JSON tidak valid.");
  }
}
export function fail(error: unknown) {
  console.error(error);
  return NextResponse.json(
    {
      error:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Data tidak dapat disimpan. Silakan coba lagi.",
    },
    { status: 400 },
  );
}
