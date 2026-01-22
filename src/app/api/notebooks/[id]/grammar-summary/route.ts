import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";
import { unauthorized, notFound, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:notebooks:grammar-summary');

/**
 * POST /api/notebooks/[id]/grammar-summary
 * 分析错题本中的语法点错误并生成总结
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        // 获取用户
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            user = await prisma.user.findFirst();
        }

        if (!user) {
            return unauthorized();
        }

        // 获取错题本
        const notebook = await prisma.subject.findUnique({
            where: { id },
            include: {
                errorItems: {
                    include: {
                        tags: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });

        if (!notebook) {
            return notFound("Notebook not found");
        }

        if (notebook.userId !== user.id) {
            return unauthorized("Not authorized to access this notebook");
        }

        // 检查是否是英语错题本
        const isEnglish = notebook.name.includes("英语") || 
                         notebook.name.toLowerCase().includes("english");

        if (!isEnglish) {
            return NextResponse.json(
                { error: "Grammar summary is currently only available for English notebooks" },
                { status: 400 }
            );
        }

        // 检查是否有错题
        if (notebook.errorItems.length === 0) {
            return NextResponse.json(
                { error: "No error items found in this notebook" },
                { status: 400 }
            );
        }

        // 准备错题数据用于AI分析
        const errorItemsData = notebook.errorItems.map((item) => {
            const tags = item.tags.map(t => t.name);
            return {
                questionText: item.questionText || "",
                answerText: item.answerText || "",
                analysis: item.analysis || "",
                tags: tags,
                errorType: item.errorType || "",
                userNotes: item.userNotes || "",
            };
        });

        // 调用AI服务生成语法点总结
        // 使用 reanswerQuestion 方法，但传入总结提示词
        const aiService = getAIService();
        
        // 构建提示词 - 将所有错题信息整合成一个"问题"
        const combinedQuestion = `请分析以下英语错题本中的所有错题，总结出相似相近的语法点或错误点。

错题数据：
${errorItemsData.map((item, idx) => `
错题 ${idx + 1}:
题目: ${item.questionText || "无"}
答案: ${item.answerText || "无"}
解析: ${item.analysis || "无"}
标签: ${item.tags.join(", ") || "无"}
错误类型: ${item.errorType || "无"}
笔记: ${item.userNotes || "无"}
`).join("\n")}

请以JSON格式返回结果，格式如下：
{
  "summary": "总体总结（200字以内）",
  "grammarPoints": [
    {
      "name": "语法点名称",
      "description": "语法点描述",
      "frequency": 出现次数,
      "examples": ["错题示例1", "错题示例2"],
      "suggestions": "学习建议"
    }
  ],
  "commonMistakes": [
    {
      "mistake": "常见错误",
      "correct": "正确形式",
      "frequency": 出现次数,
      "explanation": "错误原因说明"
    }
  ]
}`;

        // 使用 reanswerQuestion 方法，传入总结提示作为"问题"
        const aiResponse = await aiService.reanswerQuestion(
            combinedQuestion,
            'zh',
            '英语',
            undefined
        );
        
        // 解析AI返回的JSON（从analysis字段中提取）
        let summaryData;
        try {
            // 尝试从analysis中提取JSON
            const analysisText = aiResponse.analysis || "";
            const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || 
                            analysisText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
            summaryData = JSON.parse(jsonStr);
        } catch (e) {
            // 如果解析失败，返回原始文本
            logger.warn({ error: e }, 'Failed to parse AI response as JSON');
            summaryData = {
                summary: aiResponse.analysis || "分析完成，但无法解析为结构化数据",
                grammarPoints: [],
                commonMistakes: [],
            };
        }

        return NextResponse.json({
            notebookName: notebook.name,
            totalErrors: notebook.errorItems.length,
            summary: summaryData,
        });
    } catch (error: any) {
        logger.error({ error }, 'Error generating grammar summary');
        return internalError("Failed to generate grammar summary: " + (error.message || "Unknown error"));
    }
}
