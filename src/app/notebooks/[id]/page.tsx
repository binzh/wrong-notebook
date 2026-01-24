"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Plus, House, BookOpen } from "lucide-react";
import Link from "next/link";
import { ErrorList } from "@/components/error-list";
import { GrammarSummaryDialog } from "@/components/grammar-summary-dialog";

import { Notebook } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getNotebookColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ... imports

export default function NotebookDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [loading, setLoading] = useState(true);
    const [grammarDialogOpen, setGrammarDialogOpen] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchNotebook(params.id as string);
        }
    }, [params.id]);

    const fetchNotebook = async (id: string) => {
        try {
            const data = await apiClient.get<Notebook>(`/api/notebooks/${id}`);
            setNotebook(data);
        } catch (error) {
            console.error("Failed to fetch notebook:", error);
            alert(t.notebooks?.notFound || "Notebook not found");
            router.push("/");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
                <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
        );
    }

    if (!notebook) return null;

    const notebookColors = getNotebookColor(notebook.id);

    return (
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 pb-20 max-w-7xl">
                <div className="flex flex-col sm:flex-row items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <BackButton fallbackUrl="/" className="shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className={cn("inline-flex items-center gap-3 px-4 py-2 rounded-xl", notebookColors.bg, "bg-opacity-40")}>
                            <div className={cn("p-2 rounded-lg bg-background/50", notebookColors.bg)}>
                                <BookOpen className={cn("h-5 w-5", notebookColors.icon)} />
                            </div>
                            <div>
                                <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight truncate", notebookColors.text)}>
                                    {notebook.name}
                                </h1>
                                <p className={cn("text-sm sm:text-base mt-1", notebookColors.text, "opacity-70")}>
                                    {(t.notebooks?.totalErrors || "Total {count} errors").replace("{count}", (notebook._count?.errorItems || 0).toString())}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* 语法点总结按钮 - 仅对英语错题本显示 */}
                        {(notebook.name.includes("英语") || notebook.name.toLowerCase().includes("english")) && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setGrammarDialogOpen(true)}
                                className="hidden sm:flex shadow-sm hover:shadow-md transition-all"
                            >
                                <BookOpen className="mr-2 h-4 w-4" />
                                {t.notebooks?.grammarSummary?.button || "语法点总结"}
                            </Button>
                        )}
                        <Link href={`/notebooks/${notebook.id}/add`}>
                            <Button 
                                size="sm" 
                                className={cn(
                                    "hidden sm:flex shadow-md hover:shadow-lg transition-all",
                                    notebookColors.bg,
                                    notebookColors.text,
                                    "border-2",
                                    notebookColors.border.split(" ")[0]
                                )}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                {t.notebooks?.addError || "Add Error"}
                            </Button>
                            <Button 
                                size="icon" 
                                className={cn(
                                    "sm:hidden shadow-md hover:shadow-lg transition-all",
                                    notebookColors.bg,
                                    notebookColors.text
                                )}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <House className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <ErrorList subjectId={notebook.id} subjectName={notebook.name} />

                {/* 语法点总结对话框 */}
                {(notebook.name.includes("英语") || notebook.name.toLowerCase().includes("english")) && (
                    <GrammarSummaryDialog
                        open={grammarDialogOpen}
                        onOpenChange={setGrammarDialogOpen}
                        notebookId={notebook.id}
                        notebookName={notebook.name}
                    />
                )}
            </div>
        </main>
    );
}
