import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * 登出 API
 * POST /api/auth/logout
 * 
 * 清除认证相关的 HttpOnly Cookie
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // 清除认证 Token Cookie
    cookieStore.delete('authToken');
    cookieStore.delete('adminToken');
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

