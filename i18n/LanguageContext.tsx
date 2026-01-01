"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

type Language = "zh" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 导入语言文件
import zhTranslations from "./locales/zh.json";
import enTranslations from "./locales/en.json";

const translations = {
  zh: zhTranslations,
  en: enTranslations,
};

// 获取嵌套对象的值的辅助函数
function getNestedValue(obj: any, path: string): string {
  const keys = path.split(".");
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return path; // 如果找不到，返回 key 本身
    }
  }
  
  return typeof value === "string" ? value : path;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // 🔥 修复：在初始化时同步读取 localStorage（只在客户端），SSR 时使用 'en'
  // 这样客户端首次渲染时就会使用正确的语言，避免后续状态更新导致的闪烁
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language");
      if (saved === "zh" || saved === "en") {
        return saved;
      }
    }
    return "en";
  });

  // 设置语言并持久化
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
  }, []);

  // 翻译函数，支持参数插值
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translation = translations[language];
      let text = getNestedValue(translation, key);
      
      // 如果提供了参数，进行字符串插值
      if (params) {
        Object.keys(params).forEach((paramKey) => {
          const value = params[paramKey];
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
        });
      }
      
      return text;
    },
    [language]
  );

  // 使用 useMemo 记忆化 value 对象，确保只在 language, setLanguage, t 变化时更新
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

