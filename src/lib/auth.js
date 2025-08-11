import { cookies } from "next/headers";

export async function getUser() {
    const api = process.env.NEXT_PUBLIC_API_URL;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll()
        .map(c => `${c.name}=${encodeURIComponent(c.value)}`)
        .join("; ");
    try {
        const res = await fetch(`${api}/me`, {
            cache: "no-store",
            headers: { Cookie: cookieHeader },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.user ?? null;
    } catch {
        return null;
    }
}
