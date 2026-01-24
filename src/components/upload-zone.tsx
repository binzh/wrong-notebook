"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, Monitor } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// 添加 CaptureController 类型声明
declare global {
    interface Window {
        CaptureController: {
            new(): {
                setFocusBehavior(behavior: 'no-focus-change' | 'focus-capturing-application'): void;
            };
        };
    }
}

interface UploadZoneProps {
    onImageSelect: (file: File) => void;  // 改为传递 File 对象
    isAnalyzing: boolean;
}

export function UploadZone({ onImageSelect, isAnalyzing }: UploadZoneProps) {
    const { t } = useLanguage();
    const [isScreenshotting, setIsScreenshotting] = useState(false);
    const [isClient, setIsClient] = useState(false);
    // 确保只在客户端渲染屏幕截图功能
    useEffect(() => {
        setIsClient(true);

        // 请求通知权限
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (file) {
                // 直接传递 File 对象，让父组件处理压缩
                onImageSelect(file);
            }
        },
        [onImageSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
        },
        maxFiles: 1,
        disabled: isAnalyzing,
    });
    // 检查是否支持屏幕截图
    const isScreenshotSupported = () => {
        return isClient &&
            typeof navigator !== 'undefined' &&
            'mediaDevices' in navigator &&
            'getDisplayMedia' in navigator.mediaDevices;
    };
    // 屏幕截图功能
    const handleScreenshot = async () => {
        if (!isScreenshotSupported()) {
            alert(t.upload.screenshotNotSupported);
            return;
        }

        setIsScreenshotting(true);

        try {
            // 创建 CaptureController 来控制焦点行为
            let controller;
            if ('CaptureController' in window) {
                controller = new window.CaptureController();
            }

            // 请求屏幕共享权限，优先当前标签页
            const displayMediaOptions: DisplayMediaStreamOptions & {
                preferCurrentTab?: boolean;
                controller?: any;
            } = {
                video: true,
                audio: false,
                preferCurrentTab: false,  // 优先显示"此标签页"选项
            };

            if (controller) {
                (displayMediaOptions as any).controller = controller;
            }

            const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

            // 获取视频轨道并检查捕获类型
            const [videoTrack] = stream.getVideoTracks();
            const settings = videoTrack.getSettings();
            const displaySurface = (settings as any).displaySurface;  // 'browser' 表示标签页

            // 如果是标签页或窗口，设置不切换焦点
            if (controller && (displaySurface === 'browser' || displaySurface === 'window')) {
                try {
                    controller.setFocusBehavior('no-focus-change');  // 关键：不切换焦点到选中标签页
                    console.log('✅ 已设置不切换焦点行为');
                } catch (e) {
                    console.warn('⚠️ 无法设置焦点行为:', e);
                }
            }

            // 创建视频元素
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;

            // 等待视频准备并播放
            await new Promise<void>((resolve, reject) => {
                video.onloadedmetadata = () => {
                    video.play().then(() => {
                        resolve();
                    }).catch(reject);
                };
                video.onerror = reject;
            });

            // 等待一帧渲染（确保稳定）
            await new Promise(resolve => setTimeout(resolve, 500));

            // 检查视频尺寸
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                throw new Error('视频没有有效尺寸');
            }

            // 创建canvas并捕获
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('无法获取canvas上下文');
            }

            // 绘制视频帧
            ctx.drawImage(video, 0, 0);

            // 停止屏幕共享
            stream.getTracks().forEach(track => track.stop());

            // 转换为blob并创建文件
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `screenshot-${Date.now()}.png`, {
                        type: 'image/png'
                    });
                    onImageSelect(file);
                    console.log('✅ 截图完成，当前页面未跳转');
                } else {
                    alert('截图转换失败');
                }
            }, 'image/png', 1.0);

        } catch (error) {
            console.error('Screenshot failed:', error);
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    alert(t.upload.screenshotPermissionDenied);
                } else {
                    alert(`${t.upload.screenshotFailed}: ${error.message}`);
                }
            }
        } finally {
            setIsScreenshotting(false);
        }
    };
    return (
        <div className="space-y-4">
            <Card
                {...getRootProps()}
                className={`border-2 border-dashed cursor-pointer transition-all duration-300 transform hover:scale-[1.01] ${
                    isDragActive 
                        ? "border-primary bg-primary/10 shadow-lg scale-[1.02]" 
                        : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 shadow-md hover:shadow-lg"
                }`}
            >
                <CardContent className="flex flex-col items-center justify-center py-16 md:py-20 space-y-6 text-center min-h-[320px] md:min-h-[360px]">
                    <input {...getInputProps()} />
                    <div className={`p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl transition-all duration-300 ${
                        isDragActive ? "scale-110" : ""
                    }`}>
                        {isAnalyzing ? (
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        ) : (
                            <UploadCloud className={`h-12 w-12 text-primary transition-transform duration-300 ${
                                isDragActive ? "scale-110" : ""
                            }`} />
                        )}
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h3 className="font-bold text-xl md:text-2xl">
                            {isAnalyzing ? t.app.analyzing : t.upload.analyze}
                        </h3>
                        <p className="text-sm md:text-base text-muted-foreground">
                            {isAnalyzing ? t.app.analyzing : t.app.dragDrop}
                        </p>
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                            {t.upload.support}
                        </p>
                    </div>
                </CardContent>
            </Card>
            {/* 屏幕截图按钮 - 只在客户端渲染 */}
            {isScreenshotSupported() && (
                <div className="flex flex-col items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleScreenshot}
                        disabled={isAnalyzing || isScreenshotting}
                        className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-300 border-2 hover:border-primary/60 hover:bg-primary/5 transform hover:scale-105 active:scale-95"
                    >
                        {isScreenshotting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Monitor className="h-4 w-4" />
                        )}
                        {isScreenshotting ? t.common.pleaseWait : t.upload.screenshot}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                        {t.upload.screenshotDesc}
                    </p>
                </div>
            )}
        </div>
    );
}
