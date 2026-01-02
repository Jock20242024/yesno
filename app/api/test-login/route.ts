import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/services/authService';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    console.log('🔍 [Test Login] 测试登录:', email);
    
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        provider: true,
        isAdmin: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' });
    }
    
    console.log('✅ [Test Login] 用户存在:', user.email);
    console.log('   注册方式:', user.provider);
    console.log('   是否有密码:', !!user.passwordHash);
    
    if (!user.passwordHash) {
      return NextResponse.json({ success: false, error: '用户没有设置密码' });
    }
    
    const isValid = await comparePassword(password, user.passwordHash);
    console.log('🔐 [Test Login] 密码验证结果:', isValid);
    
    return NextResponse.json({
      success: isValid,
      user: {
        email: user.email,
        isAdmin: user.isAdmin,
      },
      passwordMatch: isValid,
    });
  } catch (error: any) {
    console.error('❌ [Test Login] 错误:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}

