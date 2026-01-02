import { PrismaClient } from '@prisma/client';
import { comparePassword } from '../services/authService';
import { signIn } from 'next-auth/react';

const prisma = new PrismaClient();

async function diagnose() {
  const email = 'guanliyuan@yesno.com';
  const password = 'yesnoex.com2026';
  
  console.log('=== 登录诊断 ===\n');
  
  // 1. 检查用户
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
    console.log('❌ 用户不存在');
    return;
  }
  
  console.log('✅ 用户存在');
  console.log('   注册方式:', user.provider);
  console.log('   是否管理员:', user.isAdmin);
  console.log('');
  
  // 2. 验证密码
  if (!user.passwordHash) {
    console.log('❌ 用户没有密码');
    return;
  }
  
  const isValid = await comparePassword(password, user.passwordHash);
  console.log('🔐 密码验证:', isValid ? '✅ 通过' : '❌ 失败');
  console.log('');
  
  if (!isValid) {
    console.log('❌ 密码不匹配，无法继续');
    return;
  }
  
  // 3. 检查 NextAuth 配置
  console.log('📋 NextAuth 配置检查:');
  console.log('   NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '未设置');
  console.log('   NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '已设置' : '未设置');
  console.log('   NODE_ENV:', process.env.NODE_ENV || '未设置');
  console.log('');
  
  // 4. 模拟 authorize 函数返回
  console.log('📤 authorize 函数应该返回:');
  console.log('   {');
  console.log('     id:', user.id);
  console.log('     email:', user.email);
  console.log('     isAdmin:', user.isAdmin);
  console.log('     balance: 0');
  console.log('   }');
  console.log('');
  
  console.log('✅ 所有检查通过，登录应该成功');
  console.log('');
  console.log('🔍 如果仍然失败，可能的原因:');
  console.log('   1. NextAuth signIn callback 返回 false');
  console.log('   2. NextAuth jwt callback 出错');
  console.log('   3. 数据库连接在生产模式下失败');
  console.log('   4. Cookie 设置失败');
  
  await prisma.$disconnect();
}

diagnose();
