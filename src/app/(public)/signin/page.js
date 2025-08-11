import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
    const user = await getUser();
    if (user) redirect("/"); // extra védelem: ha már belépve vagy

    const api = process.env.NEXT_PUBLIC_API_URL;
    return (
        <main className="min-h-screen grid place-items-center p-6">
            <div className="max-w-md w-full text-center space-y-4">
                <h1 className="text-3xl font-bold">Bejelentkezés</h1>
                <p className="text-muted-foreground">Lépj be Microsoft-fiókkal.</p>
                <Button className="w-full" asChild>
                    <a href={`${api}/auth/login`}>Sign in with Microsoft</a>
                </Button>
            </div>
        </main>
    );
}
