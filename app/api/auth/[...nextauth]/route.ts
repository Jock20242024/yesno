console.log("🔥 NextAuth API 被触发");

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v5 使用 handlers 并直接导出 GET 和 POST
const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;

// Note: auth function is exported from @/lib/authExport to avoid route type validation errors
