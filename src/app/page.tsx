"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Tags, BarChart3, LogOut, BookOpen } from "lucide-react";
import { NotebookCard } from "@/components/notebook-card";
import { CreateNotebookDialog } from "@/components/create-notebook-dialog";
import { UserWelcome } from "@/components/user-welcome";
import { SettingsDialog } from "@/components/settings-dialog";
import { BroadcastNotification } from "@/components/broadcast-notification";
import { signOut } from "next-auth/react";
import { Notebook } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotebooksPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        fetchNotebooks();
    }, []);

    const fetchNotebooks = async () => {
        try {
            const data = await apiClient.get<Notebook[]>("/api/notebooks");
            setNotebooks(data);
        } catch (error) {
            console.error("Failed to fetch notebooks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (name: string) => {
        try {
            await apiClient.post("/api/notebooks", { name });
            await fetchNotebooks();
        } catch (error: any) {
            console.error(error);
            const message = error.data?.message || t.notebooks?.createError || "Failed to create";
            alert(message);
        }
    };

    const handleDelete = async (id: string, errorCount: number, name: string) => {
        if (errorCount > 0) {
            alert(t.notebooks?.deleteNotEmpty || "Please clear all items in this notebook first.");
            return;
        }
        if (!confirm((t.notebooks?.deleteConfirm || "Are you sure?").replace("{name}", name))) return;

        try {
            await apiClient.delete(`/api/notebooks/${id}`);
            await fetchNotebooks();
        } catch (error: any) {
            console.error(error);
            const message = error.data?.message || t.notebooks?.deleteError || "Failed to delete";
            alert(message);
        }
    };

    const handleNotebookClick = (id: string) => {
        router.push(`/notebooks/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
                <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 pb-20 max-w-7xl">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <UserWelcome />

                    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm p-2 rounded-xl border shadow-sm hover:shadow-md transition-shadow shrink-0 w-full sm:w-auto justify-end">
                        <BroadcastNotification />
                        <SettingsDialog />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title={t.app?.logout || 'Logout'}
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
                    <Link href="/upload" className="w-full group">
                        <Button
                            size="lg"
                            className="w-full h-auto py-5 px-6 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] bg-primary hover:bg-primary/90"
                        >
                            <div className="flex items-center gap-2.5">
                                <Upload className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
                                <span>{t.app.uploadNew}</span>
                            </div>
                        </Button>
                    </Link>

                    <Link href="/tags" className="w-full group">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full h-auto py-5 px-6 text-base font-medium shadow-sm hover:shadow-md transition-all duration-300 border-2 hover:border-primary/50 hover:bg-accent/50 transform hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <div className="flex items-center gap-2.5">
                                <Tags className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
                                <span>{t.app?.tags || 'Tags'}</span>
                            </div>
                        </Button>
                    </Link>

                    <Link href="/stats" className="w-full group">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full h-auto py-5 px-6 text-base font-medium shadow-sm hover:shadow-md transition-all duration-300 border-2 hover:border-primary/50 hover:bg-accent/50 transform hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <div className="flex items-center gap-2.5">
                                <BarChart3 className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
                                <span>{t.app?.stats || 'Stats'}</span>
                            </div>
                        </Button>
                    </Link>
                </div>

                {/* Notebooks Section */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                                <BookOpen className="h-7 w-7 text-primary" />
                                {t.notebooks?.title || "My Notebooks"}
                            </h2>
                            <p className="text-muted-foreground text-sm md:text-base mt-1">
                                {t.notebooks?.subtitle || "Manage your mistakes by subject"}
                            </p>
                        </div>
                        <Button 
                            onClick={() => setDialogOpen(true)} 
                            size="sm" 
                            className="hidden sm:flex shadow-sm hover:shadow-md transition-all"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {t.notebooks?.create || "New Notebook"}
                        </Button>
                        <Button 
                            onClick={() => setDialogOpen(true)} 
                            size="icon" 
                            className="sm:hidden shadow-sm hover:shadow-md transition-all"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {notebooks.length === 0 ? (
                        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-card/50 backdrop-blur-sm animate-in fade-in duration-500">
                            <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground mb-6 text-lg">
                                {t.notebooks?.empty || "No notebooks yet."}
                            </p>
                            <Button 
                                onClick={() => setDialogOpen(true)}
                                size="lg"
                                className="shadow-md hover:shadow-lg transition-all"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {t.notebooks?.createFirst || "Create Notebook"}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                            {notebooks.map((notebook, index) => (
                                <div 
                                    key={notebook.id}
                                    className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <NotebookCard
                                        id={notebook.id}
                                        name={notebook.name}
                                        errorCount={notebook._count?.errorItems || 0}
                                        onClick={() => handleNotebookClick(notebook.id)}
                                        onDelete={() => handleDelete(notebook.id, notebook._count?.errorItems || 0, notebook.name)}
                                        itemLabel={t.notebooks?.items || "items"}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <CreateNotebookDialog
                    key={t.common.loading}
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onCreate={handleCreate}
                />
            </div>
        </main>
    );
}
