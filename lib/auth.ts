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

// NextAuth 配置
// NextAuth v5 配置对象
export const authOptions: NextAuthConfig = {
  debug: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",  // 🔥 关键：每次登录都强制弹窗询问，禁止自动后台登录
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
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
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.passwordHash) {
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
        } catch (error) {
          console.error("Credentials authorize error:", error);
          return null;
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: {
    strategy: "jwt" as const, // 🔥 强制物理重置：策略归位，确保只有一行 strategy: 'jwt'
  },
  // 🔥 修复 Cookie 配置：确保 SameSite 设置为 'lax'，防止跨域请求时 Cookie 丢失
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // 🔥 关键修复：使用 'lax' 而不是 'strict'，允许同站请求携带 Cookie
        path: '/',
        secure: process.env.NODE_ENV === 'production', // 生产环境使用 HTTPS，开发环境允许 HTTP
      },
    },
  },
  callbacks: {
    async signIn({ user, account }: any) {
      try {
        // 🔥 登录/注册全局扩展：允许所有合法的 Google 和账号登录
        // 如果是新用户登录且数据库无记录，确保 Prisma 自动创建基础 User 记录
        if (account?.provider === "google") {
          const email = user.email;
          if (!email) {
            console.error("❌ [SignIn Callback] Google 登录失败：缺少 email");
            return false;
          }

          try {
            // 查找现有用户
            const existingUser = await prisma.user.findUnique({ 
              where: { email },
              select: { id: true, isAdmin: true }
            });

            if (existingUser) {
              // 现有用户：允许登录
              console.log('✅ [SignIn Callback] Google 登录现有用户:', { email, isAdmin: existingUser.isAdmin });
              return true;
            } else {
              // 新用户：自动创建基础 User 记录（isAdmin 默认为 false）
              const newUser = await prisma.user.create({
                data: {
                  email: email,
                  provider: "google",
                  passwordHash: null, // Google 用户没有密码
                  balance: 0,
                  isAdmin: false, // 🔥 新用户默认非管理员
                  isBanned: false,
                },
              });
              console.log('✅ [SignIn Callback] Google 登录新用户已创建:', { email, id: newUser.id, isAdmin: false });
              return true;
            }
          } catch (error) {
            console.error("❌ [SignIn Callback] 数据库查询/创建错误:", error);
            return false;
          }
        }
        
        // 非 Google 登录方式（如 Credentials），允许通过
        return true;
      } catch (error) {
        console.error("❌ [SignIn Callback] 未知错误:", error);
        return false;
      }
    },
    async jwt({ token, user }: any) {
      // 🔥 身份"强绑定"：恢复带日志的版本
      if (user) {
        console.log('🛡️ [Auth-JWT] 初始登录用户:', user.email, 'isAdmin:', (user as any).isAdmin);
        token.sub = user.id;
        token.id = user.id;
        token.email = user.email;
      }
      // 🔥 强制从数据库查询最新的 isAdmin 状态
      const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } });
      const isAdmin = dbUser?.isAdmin === true;
      token.isAdmin = isAdmin;
      // 🔥 添加 role 字段：如果是管理员则为 'ADMIN'，否则为 'USER'
      token.role = isAdmin ? 'ADMIN' : 'USER';
      console.log('🛡️ [Auth-JWT] 最终存入 Token 的 isAdmin:', token.isAdmin, 'role:', token.role);
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub as string;
        // 🔥 只保留最简单的映射
        (session.user as any).isAdmin = token.isAdmin || false;
        // 🔥 添加 role 字段：传递 role 到 session
        (session.user as any).role = token.role || 'USER';
      }
      return session;
    }
  },
};
