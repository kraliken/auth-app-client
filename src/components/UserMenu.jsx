"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function UserMenu({ user }) {
    const router = useRouter();
    const api = process.env.NEXT_PUBLIC_API_URL;

    const handleLogout = async () => {
        await fetch(`${api}/auth/logout`, { method: "POST", credentials: "include" });
        router.push("/signin");
    };

    if (!user) {
        return (
            <Button asChild>
                <a href={`${api}/auth/login`}>Sign in with Microsoft</a>
            </Button>
        );
    }

    const label = user.name || user.email || user.preferred_username || "User";
    const initials = label
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[180px] truncate">{label}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
