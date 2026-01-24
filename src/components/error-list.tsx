"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, CheckCircle, Clock, ChevronDown, Printer, ListChecks, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown, FileQuestion } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { KnowledgeFilter } from "@/components/knowledge-filter";
import { ErrorItem, PaginatedResponse } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { cleanMarkdown } from "@/lib/markdown-utils";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ErrorListProps {
    subjectId?: string;
    subjectName?: string;
}

export function ErrorList({ subjectId, subjectName }: ErrorListProps = {}) {
    const [items, setItems] = useState<ErrorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [masteryFilter, setMasteryFilter] = useState<"all" | "mastered" | "unmastered">("all");
    const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
    const [gradeFilter, setGradeFilter] = useState("");
    const [chapterFilter, setChapterFilter] = useState("");
    const [paperLevelFilter, setPaperLevelFilter] = useState<"all" | "a" | "b" | "other">("all");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
    // 排序状态
    const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "masteryLevel">("createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    // 分页状态
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    // 多选模式状态
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();

    const handleExportPrint = () => {
        const params = new URLSearchParams();
        if (subjectId) params.append("subjectId", subjectId);
        if (search) params.append("query", search);
        if (masteryFilter !== "all") {
            params.append("mastery", masteryFilter === "mastered" ? "1" : "0");
        }
        if (timeFilter !== "all") {
            params.append("timeRange", timeFilter);
        }
        if (selectedTag) {
            params.append("tag", selectedTag);
        }
        if (gradeFilter) params.append("gradeSemester", gradeFilter);
        if (chapterFilter) params.append("chapter", chapterFilter); // 章节筛选
        if (paperLevelFilter !== "all") params.append("paperLevel", paperLevelFilter);

        router.push(`/print-preview?${params.toString()}`);
    };

    const handleTagClick = (tag: string) => {
        setSelectedTag(selectedTag === tag ? null : tag);
    };

    const handleFilterChange = ({ gradeSemester, chapter, tag }: any) => {
        if (gradeSemester !== undefined) setGradeFilter(gradeSemester);
        if (chapter !== undefined) setChapterFilter(chapter);
        // 注意：tag 可能是 undefined（表示清除），需要用 'tag' in obj 来判断是否传入了该参数
        // 但由于我们的结构是直接解构，这里改用 null 作为清除标识
        // 实际上 KnowledgeFilter 传入的是 { tag: undefined }，所以 tag 参数确实会被设置
        // 问题在于 !== undefined 不能区分"未传入"和"传入undefined"
        // 正确的做法是检查参数对象中是否有该 key
        setSelectedTag(tag === undefined ? null : tag);

        // Clear dependent filters and reset page
        if (!gradeSemester) {
            setGradeFilter("");
            setChapterFilter("");
            setSelectedTag(null);
        } else if (!chapter) {
            setChapterFilter("");
        }
        setPage(1); // 筛选变化时重置页码
    };

    // 使用服务端 items 直接渲染，章节过滤已在 KnowledgeFilter 中通过 tag 实现
    const filteredItems = items;

    const toggleTagsExpanded = (itemId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // 多选模式相关函数
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedIds(new Set());
    };

    const toggleSelectItem = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmMsg = (t.notebook?.confirmBatchDelete || "Delete {count} items?")
            .replace("{count}", selectedIds.size.toString());
        if (!confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            await apiClient.post("/api/error-items/batch-delete", {
                ids: Array.from(selectedIds),
            });
            alert(t.notebook?.batchDeleteSuccess || "Deleted successfully");
            setIsSelectMode(false);
            setSelectedIds(new Set());
            fetchItems();
        } catch (error) {
            console.error(error);
            alert(t.common?.messages?.deleteFailed || "Delete failed");
        } finally {
            setIsDeleting(false);
        }
    };

    // 快速筛选预设
    const quickFilters = [
        { 
            label: t.notebook?.quickFilters?.unmastered || "未掌握", 
            mastery: "unmastered" as const, 
            time: "all" as const 
        },
        { 
            label: t.notebook?.quickFilters?.recentWeek || "最近一周", 
            mastery: "all" as const, 
            time: "week" as const 
        },
        { 
            label: t.notebook?.quickFilters?.recentMonth || "最近一月", 
            mastery: "all" as const, 
            time: "month" as const 
        },
        { 
            label: t.notebook?.quickFilters?.mastered || "已掌握", 
            mastery: "mastered" as const, 
            time: "all" as const 
        },
    ];

    const applyQuickFilter = (mastery: "all" | "mastered" | "unmastered", time: "all" | "week" | "month") => {
        setMasteryFilter(mastery);
        setTimeFilter(time);
        setPage(1);
    };

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (subjectId) params.append("subjectId", subjectId);
            if (search) params.append("query", search);
            if (masteryFilter !== "all") {
                params.append("mastery", masteryFilter === "mastered" ? "1" : "0");
            }
            if (timeFilter !== "all") {
                params.append("timeRange", timeFilter);
            }
            if (selectedTag) {
                params.append("tag", selectedTag);
            }
            if (gradeFilter) params.append("gradeSemester", gradeFilter);
            if (chapterFilter) params.append("chapter", chapterFilter); // 章节筛选
            if (paperLevelFilter !== "all") params.append("paperLevel", paperLevelFilter);
            // 排序参数
            params.append("sortBy", sortBy);
            params.append("sortOrder", sortOrder);
            // 分页参数
            params.append("page", page.toString());
            params.append("pageSize", pageSize.toString());

            const response = await apiClient.get<PaginatedResponse<ErrorItem>>(`/api/error-items/list?${params.toString()}`);
            setItems(response.items);
            setTotal(response.total);
            setTotalPages(response.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [subjectId, search, masteryFilter, timeFilter, selectedTag, gradeFilter, chapterFilter, paperLevelFilter, sortBy, sortOrder, page, pageSize]);

    // 追踪筛选条件是否变化（用于判断是否需要重置页码）
    const prevFiltersRef = useRef({ search, masteryFilter, timeFilter, selectedTag, subjectId, gradeFilter, chapterFilter, paperLevelFilter, sortBy, sortOrder, pageSize });

    useEffect(() => {
        const prevFilters = prevFiltersRef.current;
        const filtersChanged =
            prevFilters.search !== search ||
            prevFilters.masteryFilter !== masteryFilter ||
            prevFilters.timeFilter !== timeFilter ||
            prevFilters.selectedTag !== selectedTag ||
            prevFilters.subjectId !== subjectId ||
            prevFilters.gradeFilter !== gradeFilter ||
            prevFilters.chapterFilter !== chapterFilter ||
            prevFilters.paperLevelFilter !== paperLevelFilter ||
            prevFilters.sortBy !== sortBy ||
            prevFilters.sortOrder !== sortOrder ||
            prevFilters.pageSize !== pageSize;

        // 更新 ref
        prevFiltersRef.current = { search, masteryFilter, timeFilter, selectedTag, subjectId, gradeFilter, chapterFilter, paperLevelFilter, sortBy, sortOrder, pageSize };

        if (filtersChanged && page !== 1 && prevFilters.pageSize === pageSize) {
            // 筛选条件变化且不在第一页，重置到第一页（会再次触发此 effect）
            // 但如果是pageSize变化，不需要重置页码
            setPage(1);
            return;
        }

        // 正常请求数据
        fetchItems();
    }, [page, search, masteryFilter, timeFilter, selectedTag, subjectId, gradeFilter, chapterFilter, paperLevelFilter, sortBy, sortOrder, pageSize, fetchItems]);

    const getSortLabel = () => {
        const fieldLabels: Record<string, string> = {
            createdAt: t.notebook?.sort?.createdAt || "创建时间",
            updatedAt: t.notebook?.sort?.updatedAt || "更新时间",
            masteryLevel: t.notebook?.sort?.masteryLevel || "掌握状态",
        };
        const orderIcon = sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
        return (
            <span className="flex items-center gap-1">
                {fieldLabels[sortBy]} {orderIcon}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* 快速筛选按钮 */}
            <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter, index) => {
                    const isActive = masteryFilter === filter.mastery && timeFilter === filter.time;
                    return (
                        <Button
                            key={index}
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => applyQuickFilter(filter.mastery, filter.time)}
                            className="text-xs"
                        >
                            {filter.label}
                        </Button>
                    );
                })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t.notebook.search}
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {/* 排序选择器 */}
                    <Select
                        value={`${sortBy}-${sortOrder}`}
                        onValueChange={(value) => {
                            const [field, order] = value.split("-") as [typeof sortBy, typeof sortOrder];
                            setSortBy(field);
                            setSortOrder(order);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[140px]">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4" />
                                {getSortLabel()}
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt-desc">{t.notebook?.sort?.newest || "最新创建"} ↓</SelectItem>
                            <SelectItem value="createdAt-asc">{t.notebook?.sort?.oldest || "最早创建"} ↑</SelectItem>
                            <SelectItem value="updatedAt-desc">{t.notebook?.sort?.recentlyUpdated || "最近更新"} ↓</SelectItem>
                            <SelectItem value="updatedAt-asc">{t.notebook?.sort?.oldestUpdated || "最早更新"} ↑</SelectItem>
                            <SelectItem value="masteryLevel-desc">{t.notebook?.sort?.masteredFirst || "已掌握优先"} ↓</SelectItem>
                            <SelectItem value="masteryLevel-asc">{t.notebook?.sort?.unmasteredFirst || "未掌握优先"} ↑</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* 每页条数选择器 */}
                    <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => {
                            setPageSize(parseInt(value, 10));
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="12">12 {t.notebook?.itemsPerPage || "条/页"}</SelectItem>
                            <SelectItem value="18">18 {t.notebook?.itemsPerPage || "条/页"}</SelectItem>
                            <SelectItem value="24">24 {t.notebook?.itemsPerPage || "条/页"}</SelectItem>
                            <SelectItem value="36">36 {t.notebook?.itemsPerPage || "条/页"}</SelectItem>
                            <SelectItem value="48">48 {t.notebook?.itemsPerPage || "条/页"}</SelectItem>
                        </SelectContent>
                    </Select>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Filter className="mr-2 h-4 w-4" />
                                {t.notebook.filter}
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>{t.filter.masteryStatus || "Mastery Status"}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setMasteryFilter("all")}>
                                {masteryFilter === "all" && "✓ "}{t.filter.all || "All"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMasteryFilter("unmastered")}>
                                {masteryFilter === "unmastered" && "✓ "}{t.filter.review || "To Review"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMasteryFilter("mastered")}>
                                {masteryFilter === "mastered" && "✓ "}{t.filter.mastered || "Mastered"}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuLabel>{t.filter.timeRange || "Time Range"}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setTimeFilter("all")}>
                                {timeFilter === "all" && "✓ "}{t.filter.allTime || "All Time"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTimeFilter("week")}>
                                {timeFilter === "week" && "✓ "}{t.filter.lastWeek || "Last Week"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTimeFilter("month")}>
                                {timeFilter === "month" && "✓ "}{t.filter.lastMonth || "Last Month"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={handleExportPrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        {t.notebook?.exportPrint || "导出打印"}
                    </Button>
                    <Button
                        variant={isSelectMode ? "secondary" : "outline"}
                        onClick={toggleSelectMode}
                    >
                        <ListChecks className="mr-2 h-4 w-4" />
                        {isSelectMode ? (t.notebook?.cancelSelect || "取消") : (t.notebook?.selectMode || "多选")}
                    </Button>
                </div>
            </div>

            {/* Advanced Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <div className="w-full sm:w-auto">
                    <KnowledgeFilter
                        gradeSemester={gradeFilter}
                        tag={selectedTag}
                        onFilterChange={handleFilterChange}
                        subjectName={subjectName}
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={paperLevelFilter === "all" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPaperLevelFilter("all")}
                    >
                        {t.filter.all || "All"}
                    </Button>
                    <Button
                        variant={paperLevelFilter === "a" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPaperLevelFilter("a")}
                    >
                        {t.editor.paperLevels?.a || "Paper A"}
                    </Button>
                    <Button
                        variant={paperLevelFilter === "b" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPaperLevelFilter("b")}
                    >
                        {t.editor.paperLevels?.b || "Paper B"}
                    </Button>
                    <Button
                        variant={paperLevelFilter === "other" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPaperLevelFilter("other")}
                    >
                        {t.editor.paperLevels?.other || "Other"}
                    </Button>
                </div>
            </div>

            {selectedTag && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">
                        {t.filter.filteringByTag || "Filtering by tag"}:
                    </span>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedTag(null)}>
                        {selectedTag}
                        <span className="ml-1 text-xs">×</span>
                    </Badge>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground">{t.common.loading || "Loading..."}</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6 bg-card/50 rounded-xl border-2 border-dashed">
                    <div className="p-4 bg-muted rounded-full">
                        <FileQuestion className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">
                            {search || masteryFilter !== "all" || timeFilter !== "all" || selectedTag || gradeFilter || chapterFilter || paperLevelFilter !== "all"
                                ? (t.notebook?.noResults || "没有找到匹配的错题")
                                : (t.notebook?.empty || "还没有错题")}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            {search || masteryFilter !== "all" || timeFilter !== "all" || selectedTag || gradeFilter || chapterFilter || paperLevelFilter !== "all"
                                ? (t.notebook?.noResultsHint || "尝试调整筛选条件或搜索关键词")
                                : (t.notebook?.emptyHint || "点击上方「添加错题」按钮开始记录你的错题吧！")}
                        </p>
                    </div>
                    {(search || masteryFilter !== "all" || timeFilter !== "all" || selectedTag || gradeFilter || chapterFilter || paperLevelFilter !== "all") && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearch("");
                                setMasteryFilter("all");
                                setTimeFilter("all");
                                setSelectedTag(null);
                                setGradeFilter("");
                                setChapterFilter("");
                                setPaperLevelFilter("all");
                                setPage(1);
                            }}
                        >
                            <X className="mr-2 h-4 w-4" />
                            {t.notebook?.clearFilters || "清除所有筛选"}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => {
                    // 优先使用 tags 关联，回退到 knowledgePoints
                    let tags: string[] = [];
                    if ((item as any).tags && (item as any).tags.length > 0) {
                        tags = (item as any).tags.map((t: any) => t.name);
                    } else {
                        try {
                            tags = JSON.parse(item.knowledgePoints || "[]");
                        } catch (e) {
                            tags = [];
                        }
                    }
                    return (
                        <div key={item.id} className="relative">
                            {/* 选择模式下的复选框 */}
                            {isSelectMode && (
                                <div
                                    className="absolute top-2 left-2 z-10"
                                    onClick={(e) => toggleSelectItem(item.id, e)}
                                >
                                    <Checkbox
                                        checked={selectedIds.has(item.id)}
                                        className="h-5 w-5 border-2 bg-background shadow-sm"
                                    />
                                </div>
                            )}
                            <Link href={isSelectMode ? "#" : `/error-items/${item.id}`} onClick={(e) => isSelectMode && e.preventDefault()}>
                                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer gap-2 pt-4">
                                    <CardHeader className="pb-0">
                                        <div className="flex justify-between items-start">
                                            <Badge
                                                variant={item.masteryLevel > 0 ? "default" : "secondary"}
                                                className={item.masteryLevel > 0 ? "bg-green-600 hover:bg-green-700" : ""}
                                            >
                                                {item.masteryLevel > 0 ? (
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" /> {t.notebook.mastered}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {t.notebook.review}
                                                    </span>
                                                )}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(item.createdAt), "MM/dd")}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm line-clamp-3">
                                            {(() => {
                                                // 提取文本并清理 LaTeX/Markdown 格式
                                                const rawText = (item.questionText || "").split('\n\n')[0]; // 取第一段
                                                const cleanText = cleanMarkdown(rawText);

                                                return cleanText.length > 80
                                                    ? cleanText.substring(0, 80) + "..."
                                                    : cleanText;
                                            })()}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {(expandedTags.has(item.id) ? tags : tags.slice(0, 3)).map((tag: string) => (
                                                <Badge
                                                    key={tag}
                                                    variant={selectedTag === tag ? "default" : "outline"}
                                                    className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleTagClick(tag);
                                                    }}
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {tags.length > 3 && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                                                    title={expandedTags.has(item.id)
                                                        ? (t.notebooks?.collapseTagsTooltip || "Click to collapse")
                                                        : (t.notebooks?.expandTagsTooltip || "Click to expand {count} tags").replace("{count}", (tags.length - 3).toString())}
                                                    onClick={(e) => toggleTagsExpanded(item.id, e)}
                                                >
                                                    {expandedTags.has(item.id) ? (
                                                        <>{t.notebooks?.collapseTags || "Collapse"}</>
                                                    ) : (
                                                        <>{(t.notebooks?.expandTags || "+{count} more").replace("{count}", (tags.length - 3).toString())}</>
                                                    )}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    );
                })}
                </div>
            )}

            {/* 分页器 */}
            <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
            />

            {/* 多选模式底部操作栏 */}
            {isSelectMode && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
                    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                            {(t.notebook?.selectedCount || "{count} selected").replace("{count}", selectedIds.size.toString())}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={toggleSelectMode}
                            >
                                <X className="mr-2 h-4 w-4" />
                                {t.notebook?.cancelSelect || "取消"}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBatchDelete}
                                disabled={selectedIds.size === 0 || isDeleting}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t.notebook?.deleteSelected || "删除选中"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
