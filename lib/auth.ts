/**
 * NextAuth 配置
 * 
 * 将 authOptions 抽离到独立的文件，避免循环依赖问题
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/services/authService";
import { randomUUID } from "crypto";

// 🔥 环境变量检查和验证
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
// 🔥 关键修复：优先使用 AUTH_SECRET，确保与 Vercel 环境变量一致
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!googleClientId || !googleClientSecret) {
  console.warn('⚠️ [NextAuth] GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET 未设置，Google OAuth 将不可用');
}
if (!authSecret) {
  console.error('❌ [NextAuth] AUTH_SECRET 或 NEXTAUTH_SECRET 未设置，这可能导致认证失败');
}

// NextAuth 配置
// NextAuth v5 配置对象
export const authOptions: NextAuthConfig = {
  // 🔥 启用极致调试：放在配置第一行
  debug: true,
  // 🔥 修复：信任 localhost 和所有主机（用于开发和生产环境）
  trustHost: true,
  // 🔥 修复：移除全局 signIn 页面配置，让各个页面自己控制跳转
  // 不再强制所有登录都跳转到 /admin/login
  // pages: {
  //   signIn: '/admin/login', // 已移除：这会导致所有 Google 登录都跳转到后台
  // },
  providers: [
    // 🔥 修复：只在环境变量存在时才添加 Google Provider
    ...(googleClientId && googleClientSecret ? [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        authorization: {
          params: {
            prompt: "consent",  // 🔥 关键：每次登录都强制弹窗询问，禁止自动后台登录
            access_type: "offline",
            response_type: "code"
          }
        }
      })
    ] : []),
    // 🔥 添加 Credentials Provider 支持邮箱密码登录
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // 查找用户
          const user = await prisma.users.findUnique({
            where: { email: credentials.email as string },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              provider: true,
              isAdmin: true,
              balance: true,
            },
          });

          if (!user) {
            return null;
          }

          // 检查用户是否是通过 Google 注册的
          if (user.provider === "google") {
            throw new Error("GOOGLE_USER_MUST_USE_OAUTH");
          }

          // 检查用户是否有密码
          if (!user.passwordHash) {
            return null;
          }

          // 验证密码
          const isPasswordValid = await comparePassword(
            credentials.password as string,
            user.passwordHash
          );

          if (!isPasswordValid) {
            return null;
          }

          // 返回用户信息（会被传递给 jwt callback）
          return {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin || false,
            balance: user.balance || 0,
          };
        } catch (error: any) {
          // 如果是 Google 用户的特殊错误，重新抛出以便前端处理
          if (error.message === "GOOGLE_USER_MUST_USE_OAUTH") {
            throw error;
          }
          // 只在开发环境记录错误
          if (process.env.NODE_ENV === 'development') {
            console.error("Credentials Auth Error:", error);
          }
          return null;
        }
      }
    }),
  ],
  // 🔥 强制对齐 Secret：显式设置 secret（优先 AUTH_SECRET，然后 NEXTAUTH_SECRET）
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || (() => {
    console.error('❌ [NextAuth] AUTH_SECRET 和 NEXTAUTH_SECRET 都未设置，认证将失败');
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET environment variable is required');
  })(),
  session: {
    strategy: "jwt" as const, // 🔥 确保使用 JWT 策略
  },
  // 🔥 手动强制 Cookie 策略：生产环境使用安全 Cookie
  useSecureCookies: process.env.NODE_ENV === 'production',
  // 🔥 修复 Cookie 配置：确保 SameSite 设置为 'lax'，防止跨域请求时 Cookie 丢失
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // 🔥 关键修复：使用 'lax' 而不是 'strict'，允许同站请求携带 Cookie
        path: '/',
        secure: process.env.NODE_ENV === 'production', // 生产环境使用 HTTPS，开发环境允许 HTTP
        // 🔥 修复：移除 domain 配置，NextAuth v5 会自动处理 Cookie 作用域
        // 使用 sameSite: 'lax' 已经足够支持带 www 和不带 www 的域名共享
      },
    },
  },
  callbacks: {
    async signIn({ user, account }: any) {
      try {
        if (account?.provider === "google") {
          const email = user.email;
          if (!email) {
            return false;
          }

          try {
            // 查找现有用户
            const existingUser = await prisma.users.findUnique({ 
              where: { email },
              select: { id: true, isAdmin: true }
            });

            if (existingUser) {
              return true;
            } else {
              // 新用户：自动创建基础 User 记录
              // 🔥 安全日期处理：防止 Invalid time value
              const now = new Date();
              if (isNaN(now.getTime())) {
                console.error('❌ [NextAuth SignIn] 系统日期无效，无法创建用户');
                return false;
              }
              
              await prisma.users.create({
                data: {
                  id: randomUUID(),
                  updatedAt: now,
                  email: email,
                  provider: "google",
                  passwordHash: null,
                  balance: 0,
                  isAdmin: false,
                  isBanned: false,
                },
              });
              return true;
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error("SignIn Callback Error:", error);
            }
            return false;
          }
        }
        
        return true;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("SignIn Callback Error:", error);
        }
        return false;
      }
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
        token.email = user.email;
      }
      
      // 从数据库查询最新的 isAdmin 状态
      try {
        // 🔥 修复：确保数据库连接
        try {
          await prisma.$connect();
        } catch (dbError) {
          console.error('❌ [NextAuth JWT] 数据库连接失败:', dbError);
          // 连接失败时使用默认值
          token.isAdmin = false;
          token.role = 'USER';
          return token;
        }

        const dbUser = await prisma.users.findUnique({ 
          where: { email: token.email as string },
          select: { isAdmin: true }
        });
        
        if (dbUser) {
          const isAdmin = dbUser.isAdmin === true;
          token.isAdmin = isAdmin;
          token.role = isAdmin ? 'ADMIN' : 'USER';
        } else {
          token.isAdmin = false;
          token.role = 'USER';
        }
      } catch (error: any) {
        // 如果数据库查询失败，使用 user 对象中的 isAdmin（如果存在）
        if (user && (user as any).isAdmin !== undefined) {
          token.isAdmin = (user as any).isAdmin || false;
          token.role = token.isAdmin ? 'ADMIN' : 'USER';
        } else {
          token.isAdmin = false;
          token.role = 'USER';
        }
        console.error("❌ [NextAuth JWT] Callback Error:", error?.message || error);
      } finally {
        // 🔥 确保断开数据库连接
        try {
          await prisma.$disconnect();
        } catch (e) {
          // 忽略断开连接时的错误
        }
      }

      return token;
    },
    async redirect({ url, baseUrl }: any) {
      try {
        const urlObj = new URL(url, baseUrl);
        const callbackUrl = urlObj.searchParams.get('callbackUrl') || urlObj.pathname;
        
        if (callbackUrl === '/' || callbackUrl === baseUrl || !callbackUrl) {
          return baseUrl;
        }
        
        if (url.startsWith('/')) {
          return new URL(url, baseUrl).toString();
        }
        
        if (url.startsWith(baseUrl)) {
          return url;
        }
        
        return baseUrl;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Auth Redirect Error:', error);
        }
        return baseUrl;
      }
    },
    // 🔥 简化 session 回调：暂时移除复杂逻辑，直接返回原始 session
    async session({ session, token }: any) {
      if (session.user && token) {
        session.user.id = token.sub as string || token.id as string;
        (session.user as any).isAdmin = token.isAdmin || false;
        (session.user as any).role = token.role || 'USER';
      }
      return session;
    }
  },
};
