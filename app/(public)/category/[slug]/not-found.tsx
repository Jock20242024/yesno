"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { useEffect, useState } from "react";

export default function NotFound() {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState({ message: "Category does not exist", button: "Back to Home" });
  
  // 🔥 修复：在客户端挂载后立即读取语言并更新文本
  useEffect(() => {
    setMounted(true);
    
    // 直接从 localStorage 读取语言（确保获取最新值）
    const currentLang = typeof window !== "undefined" ? localStorage.getItem("language") || "en" : "en";
    
    // 立即更新文本
    if (currentLang === "zh") {
      setText({ message: "分类不存在", button: "返回首页" });
    } else {
      setText({ message: "Category does not exist", button: "Back to Home" });
    }
    
    // 然后使用翻译函数更新（确保使用最新的翻译）
    const categoryNotFound = t("common.not_found.category_not_found");
    const backToHome = t("common.not_found.back_to_home");
    
    // 只有当翻译函数返回的值不是 key 本身时才使用（说明翻译成功）
    if (categoryNotFound !== "common.not_found.category_not_found") {
      setText({ message: categoryNotFound, button: backToHome });
    }
  }, [t]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-pm-text-dim">{text.message}</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-[#18181b] font-bold transition-colors"
      >
        {text.button}
      </Link>
    </div>
  );
}

