"use client";

import { useState, useEffect } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function UserWelcome() {
    const { t, language } = useLanguage();
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Server always renders 'User' (no session). Client matches this initially.
    // After mount, we show the real name.
    const userName = mounted && session?.user ? (session.user.name || session.user.email) : 'User';

    return (
        <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm p-4 md:p-5 rounded-xl border shadow-md hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-base md:text-lg">
                {t.common.welcome || 'Welcome back, '}
                <span className="text-primary">{userName}</span>
            </span>
        </div>
    );
}
