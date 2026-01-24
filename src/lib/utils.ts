import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 根据字符串生成一个稳定的颜色索引
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 预定义的错题本颜色方案（使用Tailwind CSS颜色类）
 */
const NOTEBOOK_COLORS = [
  { border: "border-blue-500 hover:border-blue-600", bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-600" },
  { border: "border-green-500 hover:border-green-600", bg: "bg-green-50", text: "text-green-700", icon: "text-green-600" },
  { border: "border-purple-500 hover:border-purple-600", bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-600" },
  { border: "border-orange-500 hover:border-orange-600", bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-600" },
  { border: "border-pink-500 hover:border-pink-600", bg: "bg-pink-50", text: "text-pink-700", icon: "text-pink-600" },
  { border: "border-indigo-500 hover:border-indigo-600", bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-600" },
  { border: "border-teal-500 hover:border-teal-600", bg: "bg-teal-50", text: "text-teal-700", icon: "text-teal-600" },
  { border: "border-rose-500 hover:border-rose-600", bg: "bg-rose-50", text: "text-rose-700", icon: "text-rose-600" },
  { border: "border-amber-500 hover:border-amber-600", bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-600" },
  { border: "border-cyan-500 hover:border-cyan-600", bg: "bg-cyan-50", text: "text-cyan-700", icon: "text-cyan-600" },
] as const;

/**
 * 根据notebook id获取对应的颜色方案
 */
export function getNotebookColor(id: string) {
  const index = hashString(id) % NOTEBOOK_COLORS.length;
  return NOTEBOOK_COLORS[index];
}