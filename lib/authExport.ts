/**
 * Auth function export for API routes
 * This file exports the auth function separately to avoid Next.js route type validation errors
 * when exporting from app/api/auth/[...nextauth]/route.ts
 */

import NextAuth from 'next-auth';
import { authOptions } from './auth';

const { auth } = NextAuth(authOptions);
export { auth };

