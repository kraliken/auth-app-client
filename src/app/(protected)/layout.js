import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import { UserProvider } from "@/components/UserContext";

// biztos, hogy mindig frissüljön (ne statikusan épüljön)
export const dynamic = "force-dynamic";
// vagy: export const revalidate = 0;

export default async function ProtectedLayout({ children }) {
    const user = await getUser();       // SSR-ben lekérjük az API /me-t (cookie forward!)
    if (!user) redirect("/signin");     // nincs belépve → signin
    return (
        <UserProvider value={user}>
            <main className="min-h-[calc(100vh-68px)] p-6 flex flex-col items-center gap-6">
                <header className="w-full max-w-3xl flex justify-end">
                    <UserMenu user={user} />
                </header>
                {children}
            </main>
        </UserProvider>
    );
}
