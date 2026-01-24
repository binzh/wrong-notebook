"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trash2, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotebookColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface NotebookCardProps {
    id: string;
    name: string;
    errorCount: number;
    onClick: () => void;
    onDelete?: (id: string) => void;
    itemLabel?: string;
}

export function NotebookCard({ id, name, errorCount, onClick, onDelete, itemLabel = "items" }: NotebookCardProps) {
    const colors = getNotebookColor(id);
    
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-300 relative group overflow-hidden",
                "border-2 shadow-lg hover:shadow-2xl transform hover:scale-[1.03] active:scale-[0.97]",
                "bg-card/80 backdrop-blur-sm",
                colors.border
            )}
            onClick={onClick}
        >
            {/* 装饰性渐变背景 */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-30",
                colors.bg.replace("bg-", "bg-").replace("-50", "-200")
            )} />
            
            {/* 左侧颜色条 */}
            <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300",
                colors.border.split(" ")[0].replace("border-", "bg-")
            )} />
            
            <CardHeader className={cn("pb-4 pt-6 relative z-10", colors.bg, "bg-opacity-40")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* 图标容器 */}
                        <div className={cn(
                            "p-3 rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                            "bg-gradient-to-br from-background to-background/80",
                            colors.bg,
                            "border-2",
                            colors.border.split(" ")[0]
                        )}>
                            <BookOpen className={cn("h-6 w-6", colors.icon)} />
                        </div>
                        
                        {/* 标题和内容 */}
                        <div className="flex-1 min-w-0 space-y-2">
                            <CardTitle className={cn(
                                "text-xl font-bold truncate leading-tight",
                                colors.text
                            )}>
                                {name}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <FileText className={cn("h-4 w-4", colors.icon, "opacity-60")} />
                                <span className={cn("text-sm font-medium", colors.text, "opacity-70")}>
                                    {errorCount} {itemLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* 删除按钮 */}
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0",
                                "hover:bg-destructive/10 hover:text-destructive"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(id);
                            }}
                        >
                            <Trash2 className={`h-4 w-4 ${errorCount > 0 ? "text-muted-foreground" : "text-destructive"}`} />
                        </Button>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="relative z-10 pt-4 pb-6">
                <div className="flex items-center justify-between">
                    <Badge 
                        variant="secondary" 
                        className={cn(
                            "font-semibold px-4 py-1.5 text-sm",
                            colors.bg,
                            colors.text,
                            "border-2",
                            colors.border.split(" ")[0],
                            "shadow-sm"
                        )}
                    >
                        {errorCount === 0 ? (
                            <span className="opacity-60">空错题本</span>
                        ) : (
                            <span>{errorCount} 道错题</span>
                        )}
                    </Badge>
                    
                    {/* 进入箭头 */}
                    <div className={cn(
                        "flex items-center gap-1 text-sm font-medium transition-transform duration-300 group-hover:translate-x-1",
                        colors.text,
                        "opacity-60 group-hover:opacity-100"
                    )}>
                        <span className="hidden sm:inline">查看</span>
                        <ArrowRight className="h-4 w-4" />
                    </div>
                </div>
            </CardContent>
            
            {/* Hover时的光效 */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                "bg-gradient-to-br from-transparent via-transparent to-white/5"
            )} />
        </Card>
    );
}
