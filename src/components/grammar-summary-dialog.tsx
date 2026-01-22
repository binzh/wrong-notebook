"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useLanguage } from "@/contexts/LanguageContext";

interface GrammarPoint {
    name: string;
    description: string;
    frequency: number;
    examples: string[];
    suggestions: string;
}

interface CommonMistake {
    mistake: string;
    correct: string;
    frequency: number;
    explanation: string;
}

interface GrammarSummaryData {
    summary: string;
    grammarPoints: GrammarPoint[];
    commonMistakes: CommonMistake[];
}

interface GrammarSummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    notebookId: string;
    notebookName: string;
}

export function GrammarSummaryDialog({
    open,
    onOpenChange,
    notebookId,
    notebookName,
}: GrammarSummaryDialogProps) {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [summaryData, setSummaryData] = useState<GrammarSummaryData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setSummaryData(null);

        try {
            const response = await fetch(`/api/notebooks/${notebookId}/grammar-summary`, {
                method: "POST",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to generate summary");
            }

            const data = await response.json();
            setSummaryData(data.summary);
        } catch (err: any) {
            setError(err.message || "生成总结时出错");
            console.error("Failed to generate grammar summary:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        {t.notebooks?.grammarSummary?.title || `语法点总结 - ${notebookName}`}
                    </DialogTitle>
                    <DialogDescription>
                        {t.notebooks?.grammarSummary?.description || 
                         "分析错题本中的所有错题，总结相似相近的语法点和错误点"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!summaryData && !loading && !error && (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground mb-4">
                                {t.notebooks?.grammarSummary?.prompt || 
                                 "点击下方按钮开始生成语法点总结"}
                            </p>
                            <Button onClick={handleGenerate} disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t.common.loading || "生成中..."}
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="mr-2 h-4 w-4" />
                                        {t.notebooks?.grammarSummary?.generateButton || "生成总结"}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                            <p className="text-muted-foreground">
                                {t.notebooks?.grammarSummary?.generating || "正在分析错题，请稍候..."}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-red-800 font-medium mb-1">
                                    {t.common.error || "错误"}
                                </p>
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {summaryData && (
                        <div className="space-y-6">
                            {/* 总体总结 */}
                            {summaryData.summary && (
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <h3 className="font-semibold mb-2">
                                        {t.notebooks?.grammarSummary?.overallSummary || "总体总结"}
                                    </h3>
                                    <MarkdownRenderer content={summaryData.summary} />
                                </div>
                            )}

                            {/* 语法点 */}
                            {summaryData.grammarPoints && summaryData.grammarPoints.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-lg">
                                        {t.notebooks?.grammarSummary?.grammarPoints || "语法点分析"}
                                    </h3>
                                    <div className="space-y-4">
                                        {summaryData.grammarPoints.map((point, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <h4 className="font-semibold text-base">
                                                        {point.name}
                                                    </h4>
                                                    <span className="text-sm text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                                                        {t.notebooks?.grammarSummary?.frequency || "出现"} {point.frequency} {t.notebooks?.grammarSummary?.times || "次"}
                                                    </span>
                                                </div>
                                                {point.description && (
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        {point.description}
                                                    </p>
                                                )}
                                                {point.examples && point.examples.length > 0 && (
                                                    <div className="mb-2">
                                                        <p className="text-sm font-medium mb-1">
                                                            {t.notebooks?.grammarSummary?.examples || "示例"}:
                                                        </p>
                                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                                            {point.examples.map((example, eIdx) => (
                                                                <li key={eIdx}>{example}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {point.suggestions && (
                                                    <div className="mt-2 pt-2 border-t">
                                                        <p className="text-sm">
                                                            <span className="font-medium">
                                                                {t.notebooks?.grammarSummary?.suggestions || "学习建议"}:
                                                            </span>{" "}
                                                            {point.suggestions}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 常见错误 */}
                            {summaryData.commonMistakes && summaryData.commonMistakes.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3 text-lg">
                                        {t.notebooks?.grammarSummary?.commonMistakes || "常见错误"}
                                    </h3>
                                    <div className="space-y-3">
                                        {summaryData.commonMistakes.map((mistake, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm text-red-600 line-through">
                                                                {mistake.mistake}
                                                            </span>
                                                            <span className="text-muted-foreground">→</span>
                                                            <span className="text-sm text-green-600 font-medium">
                                                                {mistake.correct}
                                                            </span>
                                                        </div>
                                                        {mistake.explanation && (
                                                            <p className="text-sm text-muted-foreground">
                                                                {mistake.explanation}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground bg-primary/10 px-2 py-1 rounded shrink-0 ml-2">
                                                        {mistake.frequency} {t.notebooks?.grammarSummary?.times || "次"}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 重新生成按钮 */}
                            <div className="flex justify-end pt-4 border-t">
                                <Button onClick={handleGenerate} variant="outline" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {t.common.loading || "生成中..."}
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            {t.notebooks?.grammarSummary?.regenerate || "重新生成"}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
