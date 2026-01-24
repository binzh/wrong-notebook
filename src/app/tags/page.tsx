"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { TrendingUp, Plus, Trash2, ChevronDown, ChevronRight, House, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { TagStats, TagStatsResponse, Notebook } from "@/types/api";
import { getNotebookColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

// 标签树节点类型
interface TagTreeNode {
    id: string;
    name: string;
    code: string | null;
    isSystem: boolean;
    children: TagTreeNode[];
}

// 学科配置
const SUBJECTS = [
    { key: 'math', name: '数学' },
    { key: 'english', name: '英语' },
    { key: 'physics', name: '物理' },
    { key: 'chemistry', name: '化学' },
    { key: 'biology', name: '生物' },
    { key: 'chinese', name: '语文' },
    { key: 'history', name: '历史' },
    { key: 'geography', name: '地理' },
    { key: 'politics', name: '政治' },
] as const;

type SubjectKey = typeof SUBJECTS[number]['key'];

export default function TagsPage() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<TagStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);

    // 标签数据 (按学科) - null 表示未加载，[] 表示已加载但无数据
    const [tagsBySubject, setTagsBySubject] = useState<Record<SubjectKey, TagTreeNode[] | null>>({
        math: null,
        english: null,
        physics: null,
        chemistry: null,
        biology: null,
        chinese: null,
        history: null,
        geography: null,
        politics: null,
    });

    // 自定义标签 (扁平列表，仅用于显示)
    const [customTags, setCustomTags] = useState<Array<{ id: string; name: string; subject: string; parentName?: string }>>([]);

    // 新建标签表单
    const [newTagSubject, setNewTagSubject] = useState<SubjectKey>("math");
    const [newTagGrade, setNewTagGrade] = useState<string>(""); // 年级ID
    const [gradeOptions, setGradeOptions] = useState<Array<{ id: string; name: string }>>([]);
    const [newTagName, setNewTagName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // 展开状态
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    // 获取标签树
    const fetchTags = useCallback(async (subject: SubjectKey) => {
        try {
            const data = await apiClient.get<{ tags: TagTreeNode[] }>(`/api/tags?subject=${subject}`);
            setTagsBySubject(prev => ({ ...prev, [subject]: data.tags }));
        } catch (error) {
            console.error(`Failed to fetch ${subject} tags:`, error);
        }
    }, []);

    // 获取自定义标签
    const fetchCustomTags = useCallback(async () => {
        try {
            // 获取所有学科的扁平标签，过滤非系统标签
            const allCustom: Array<{ id: string; name: string; subject: string; parentName?: string }> = [];
            for (const { key } of SUBJECTS) {
                const data = await apiClient.get<{ tags: Array<{ id: string; name: string; isSystem: boolean; parentName?: string }> }>(
                    `/api/tags?subject=${key}&flat=true`
                );
                const custom = data.tags.filter(t => !t.isSystem).map(t => ({ ...t, subject: key }));
                allCustom.push(...custom);
            }
            setCustomTags(allCustom);
        } catch (error) {
            console.error("Failed to fetch custom tags:", error);
        }
    }, []);

    // 获取统计
    const fetchStats = async () => {
        try {
            const data = await apiClient.get<TagStatsResponse>("/api/tags/stats");
            setStats(data.stats);
        } catch (error) {
            console.error("Failed to fetch tag stats:", error);
        } finally {
            setLoading(false);
        }
    };

    // 获取错题本列表
    const fetchNotebooks = useCallback(async () => {
        try {
            const data = await apiClient.get<Notebook[]>("/api/notebooks");
            setNotebooks(data);
        } catch (error) {
            console.error("Failed to fetch notebooks:", error);
        }
    }, []);

    // 根据学科名称找到对应的错题本ID
    const getNotebookIdBySubject = (subjectKey: SubjectKey, subjectName: string): string | null => {
        // 先尝试精确匹配名称
        const exactMatch = notebooks.find(n => n.name === subjectName);
        if (exactMatch) return exactMatch.id;

        // 尝试模糊匹配（包含关系）
        const fuzzyMatch = notebooks.find(n => 
            n.name.includes(subjectName) || subjectName.includes(n.name)
        );
        if (fuzzyMatch) return fuzzyMatch.id;

        // 尝试根据学科key匹配（如"数学"匹配"math"）
        const subjectKeyMap: Record<SubjectKey, string[]> = {
            math: ['数学', 'math'],
            english: ['英语', 'english', 'English'],
            physics: ['物理', 'physics'],
            chemistry: ['化学', 'chemistry'],
            biology: ['生物', 'biology'],
            chinese: ['语文', 'chinese'],
            history: ['历史', 'history'],
            geography: ['地理', 'geography'],
            politics: ['政治', 'politics'],
        };
        
        const keywords = subjectKeyMap[subjectKey] || [];
        const keywordMatch = notebooks.find(n => 
            keywords.some(keyword => n.name.includes(keyword) || keyword.includes(n.name))
        );
        if (keywordMatch) return keywordMatch.id;

        return null;
    };

    useEffect(() => {
        // 初始加载
        fetchStats();
        fetchCustomTags();
        fetchNotebooks();
        // 默认加载数学标签
        fetchTags('math');
    }, [fetchTags, fetchCustomTags, fetchNotebooks]);

    // 当学科变化时，获取对应的年级列表
    useEffect(() => {
        const fetchGrades = async () => {
            try {
                const data = await apiClient.get<{ tags: TagTreeNode[] }>(`/api/tags?subject=${newTagSubject}`);
                // 顶级节点就是年级，只取系统标签
                const grades = data.tags
                    .filter(t => t.isSystem)
                    .map(t => ({ id: t.id, name: t.name }));
                setGradeOptions(grades);
                setNewTagGrade(""); // 重置选择
            } catch (error) {
                console.error("Failed to fetch grades:", error);
                setGradeOptions([]);
            }
        };
        fetchGrades();
    }, [newTagSubject]);

    // 添加自定义标签
    const handleAddCustomTag = async () => {
        if (!newTagName.trim()) {
            alert(t.tags?.custom?.enterName || "Please enter tag name");
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post('/api/tags', {
                name: newTagName.trim(),
                subject: newTagSubject,
                parentId: (newTagGrade && newTagGrade !== 'none') ? newTagGrade : undefined,
            });
            setNewTagName("");
            // 刷新
            await fetchCustomTags();
            await fetchTags(newTagSubject);
            alert(t.tags?.custom?.success || "Tag added successfully!");
        } catch (error: any) {
            if (error?.message?.includes('409')) {
                alert(t.tags?.custom?.exists || "Tag already exists");
            } else {
                alert("Failed to add tag");
            }
        } finally {
            setSubmitting(false);
        }
    };

    // 删除自定义标签
    const handleRemoveCustomTag = async (tagId: string, tagName: string, subject: SubjectKey) => {
        if (!confirm((t.tags?.custom?.deleteConfirm || "Are you sure you want to delete tag \"{tag}\"?").replace("{tag}", tagName))) {
            return;
        }

        try {
            await apiClient.delete(`/api/tags?id=${tagId}`);
            await fetchCustomTags();
            await fetchTags(subject);
        } catch (error) {
            console.error("Failed to delete tag:", error);
            alert("Failed to delete tag");
        }
    };

    // 切换节点展开
    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    // 渲染标签树节点
    const renderTreeNode = (node: TagTreeNode, depth: number = 0, isLeafContext: boolean = false): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedNodes[node.id];
        const paddingLeft = depth * 12; // 减小缩进

        if (!hasChildren) {
            // 叶子节点 - 显示为 Badge
            return (
                <Badge 
                    key={node.id} 
                    variant="outline" 
                    className="cursor-default hover:bg-accent text-xs px-2 py-0.5 h-6" 
                    style={{ marginLeft: isLeafContext ? 0 : paddingLeft }}
                >
                    {node.name}
                    {(() => {
                        const stat = stats.find(s => s.tag === node.name);
                        return stat ? <span className="ml-1 text-[10px] text-muted-foreground">({stat.count})</span> : null;
                    })()}
                </Badge>
            );
        }

        // 过滤出系统标签子节点
        const visibleChildren = node.children.filter(child => child.isSystem);

        if (visibleChildren.length === 0) {
            return (
                <div key={node.id} className="space-y-1" style={{ paddingLeft }}>
                    <div
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5"
                        onClick={() => toggleNode(node.id)}
                    >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span className="font-medium text-xs">{node.name}</span>
                        <span className="text-[10px] text-muted-foreground">({visibleChildren.length})</span>
                    </div>
                </div>
            );
        }

        // 判断可见子节点是否都是叶子节点
        const allChildrenAreLeaves = visibleChildren.every(child => child.children.filter(c => c.isSystem).length === 0);

        // 有子节点 - 可展开
        return (
            <div key={node.id} className="space-y-1" style={{ paddingLeft }}>
                <div
                    className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5"
                    onClick={() => toggleNode(node.id)}
                >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-medium text-xs">{node.name}</span>
                    <span className="text-[10px] text-muted-foreground">({visibleChildren.length})</span>
                </div>
                {isExpanded && (
                    allChildrenAreLeaves ? (
                        // 如果所有子节点都是叶子，使用 flex-wrap 布局
                        <div className="flex flex-wrap gap-1.5 pl-4">
                            {visibleChildren.map(child => renderTreeNode(child, 0, true))}
                        </div>
                    ) : (
                        // 如果有非叶子子节点，使用垂直堆叠布局
                        <div className="space-y-1 pl-4">
                            {visibleChildren.map(child => renderTreeNode(child, 0, false))}
                        </div>
                    )
                )}
            </div>
        );
    };

    // 渲染标准标签库
    const renderStandardTags = () => {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {SUBJECTS.map(({ key, name }) => {
                    const subjectName = (t.tags?.subjects as any)?.[key] || name;
                    const isExpanded = expandedNodes[`subject-${key}`];
                    const tags = tagsBySubject[key];

                    // 根据学科找到对应的错题本ID，使用错题本ID来获取颜色方案
                    const notebookId = getNotebookIdBySubject(key, subjectName);
                    const subjectColors = notebookId 
                        ? getNotebookColor(notebookId)
                        : getNotebookColor(`subject-${key}`); // fallback
                    
                    return (
                        <Card 
                            key={key} 
                            className={cn(
                                "h-fit border-2 transition-all duration-300",
                                subjectColors.border
                            )}
                        >
                            <CardHeader
                                className="cursor-pointer hover:bg-muted/50 transition-colors flex flex-row items-center justify-between py-2 px-4"
                                onClick={() => {
                                    toggleNode(`subject-${key}`);
                                    if (tags === null) fetchTags(key);
                                }}
                            >
                                <CardTitle className={cn("text-sm font-semibold flex items-center gap-1.5", subjectColors.text)}>
                                    {isExpanded ? <ChevronDown className={cn("h-3.5 w-3.5", subjectColors.icon)} /> : <ChevronRight className={cn("h-3.5 w-3.5", subjectColors.icon)} />}
                                    {subjectName}
                                </CardTitle>
                            </CardHeader>
                            {isExpanded && (
                                <CardContent className="space-y-1.5 pt-2 pb-3 max-h-[500px] overflow-y-auto">
                                    {tags === null ? (
                                        <div className="text-center py-3 text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin mx-auto mb-1" />
                                            <span className="text-xs">Loading...</span>
                                        </div>
                                    ) : tags.filter(t => t.isSystem).length === 0 ? (
                                        <div className="text-center py-3 text-xs text-muted-foreground">
                                            {t.tags?.stats?.empty || "暂无系统标签"}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {tags.filter(t => t.isSystem).map(node => renderTreeNode(node))}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        );
    };

    // 渲染自定义标签
    const renderCustomTags = () => {
        const groupedBySubject = customTags.reduce((acc, tag) => {
            if (!acc[tag.subject]) acc[tag.subject] = [];
            acc[tag.subject].push(tag);
            return acc;
        }, {} as Record<string, typeof customTags>);

        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t.tags?.custom?.addTitle || "Add Custom Tag"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex gap-3 flex-wrap">
                            <Select value={newTagSubject} onValueChange={(v) => setNewTagSubject(v as SubjectKey)}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {SUBJECTS.map(({ key, name }) => (
                                        <SelectItem key={key} value={key}>{(t.tags?.subjects as any)?.[key] || name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={newTagGrade} onValueChange={setNewTagGrade}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder={t.tags?.custom?.selectGrade || "选择年级"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t.tags?.custom?.noGrade || "不选择年级"}</SelectItem>
                                    {gradeOptions.map((grade) => (
                                        <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                placeholder={t.tags?.custom?.placeholder || "Enter tag name..."}
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                                className="flex-1 min-w-[200px]"
                            />
                            <Button onClick={handleAddCustomTag} disabled={submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                {t.tags?.custom?.add || "Add"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t.tags?.custom?.hint || "💡 Custom tags will automatically appear in tag suggestions"}
                        </p>
                    </CardContent>
                </Card>

                {customTags.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {t.tags?.custom?.empty || "No custom tags yet, click above to add!"}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {SUBJECTS.map(({ key, name }) => {
                            const tags = groupedBySubject[key];
                            if (!tags?.length) return null;

                            const subjectName = (t.tags?.subjects as any)?.[key] || name;

                            // Group by parentName (or "General")
                            const groupedByParent = tags.reduce((acc, tag) => {
                                const groupName = tag.parentName || "通用";
                                if (!acc[groupName]) acc[groupName] = [];
                                acc[groupName].push(tag);
                                return acc;
                            }, {} as Record<string, typeof customTags>);

                            // Sort groups keys to put "General" last or first? Let's put regular names first.
                            const groupKeys = Object.keys(groupedByParent).sort((a, b) => {
                                if (a === "通用") return 1;
                                if (b === "通用") return -1;
                                return a.localeCompare(b, "zh");
                            });

                            // 根据学科找到对应的错题本ID，使用错题本ID来获取颜色方案
                            const notebookId = getNotebookIdBySubject(key, subjectName);
                            const subjectColors = notebookId 
                                ? getNotebookColor(notebookId)
                                : getNotebookColor(`subject-${key}`); // fallback
                            
                            return (
                        <Card 
                            key={key} 
                            className={cn(
                                "h-fit border-2 transition-all duration-300",
                                subjectColors.border
                            )}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className={cn("text-sm font-semibold", subjectColors.text)}>
                                    {(t.tags?.subjects as any)?.[key] || name} ({tags.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pt-2 pb-3">
                                {groupKeys.map(groupName => (
                                    <div key={groupName} className="space-y-1.5">
                                        {groupName !== "通用" && (
                                            <h4 className={cn("text-[10px] font-semibold border-b pb-0.5 uppercase", subjectColors.text, "opacity-70")}>{groupName}</h4>
                                        )}
                                        {groupName === "通用" && groupKeys.length > 1 && (
                                            <h4 className={cn("text-[10px] font-semibold border-b pb-0.5 uppercase", subjectColors.text, "opacity-70")}>其他</h4>
                                        )}
                                        <div className="flex flex-wrap gap-1.5">
                                            {groupedByParent[groupName].map((tag) => (
                                                <Badge 
                                                    key={tag.id} 
                                                    variant="secondary" 
                                                    className={cn(
                                                        "px-2 py-0.5 text-xs h-5 border",
                                                        subjectColors.bg,
                                                        subjectColors.text,
                                                        subjectColors.border.split(" ")[0]
                                                    )}
                                                >
                                                    {tag.name}
                                                    <button
                                                        onClick={() => handleRemoveCustomTag(tag.id, tag.name, key)}
                                                        className="ml-1 hover:text-destructive transition-colors"
                                                        title={t.common?.delete || "Delete"}
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // 渲染统计
    const renderStats = () => {
        if (loading) return <div className="text-center py-8">{t.tags?.stats?.loading || "Loading..."}</div>;
        if (stats.length === 0) return <div className="text-center py-8 text-muted-foreground">{t.tags?.stats?.empty || "No tag usage records yet"}</div>;
        const maxCount = stats[0]?.count || 1;
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4" />
                        {t.tags?.stats?.frequency || "Tag Usage Frequency (Top 20)"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-[500px] overflow-y-auto pt-2 pb-3">
                    {stats.slice(0, 20).map((stat) => {
                        const percentage = (stat.count / maxCount) * 100;
                        return (
                            <div key={stat.tag} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium truncate pr-2">{stat.tag}</span>
                                    <span className="text-muted-foreground text-[10px] shrink-0">{stat.count} {t.tags?.stats?.count || "times"}</span>
                                </div>
                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        );
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
                <div className="flex items-center gap-4 mb-6">
                    <BackButton fallbackUrl="/" />
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-bold">{t.tags?.title || "Tag Management"}</h1>
                        <p className="text-muted-foreground text-sm md:text-base mt-1">
                            {t.tags?.subtitle || "View and manage knowledge point tags"}
                        </p>
                    </div>
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <House className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>

                <Tabs defaultValue="standard" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="standard">{t.tags?.tabs?.standard || "Standard Tags"}</TabsTrigger>
                        <TabsTrigger value="custom">{t.tags?.tabs?.custom || "Custom Tags"}</TabsTrigger>
                        <TabsTrigger value="stats">{t.tags?.tabs?.stats || "Usage Statistics"}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="standard" className="mt-4">{renderStandardTags()}</TabsContent>
                    <TabsContent value="custom" className="mt-4">{renderCustomTags()}</TabsContent>
                    <TabsContent value="stats" className="mt-4">{renderStats()}</TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
