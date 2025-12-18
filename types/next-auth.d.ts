import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * 扩展 User 接口，添加 isAdmin 字段
   */
  interface User extends DefaultUser {
    isAdmin: boolean;
  }

  /**
   * 扩展 Session 接口，在 user 属性里添加 isAdmin 字段
   */
  interface Session extends DefaultSession {
    user: {
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * 扩展 JWT 接口，添加 isAdmin 字段
   */
  interface JWT extends DefaultJWT {
    isAdmin: boolean;
  }
}
