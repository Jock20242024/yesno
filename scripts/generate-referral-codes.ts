/**
 * 为现有用户生成邀请码脚本
 * 运行: npx tsx scripts/generate-referral-codes.ts
 */

import { prisma } from '../lib/prisma';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

async function generateCodesForExistingUsers() {
  try {
    console.log('开始为现有用户生成邀请码...');
    
    const users = await prisma.user.findMany({
      where: { referralCode: null },
      select: { id: true, email: true },
    });

    console.log(`找到 ${users.length} 个需要生成邀请码的用户`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      let code = generateReferralCode();
      let attempts = 0;
      let codeExists = true;
      
      // 确保代码唯一，最多尝试 10 次
      while (codeExists && attempts < 10) {
        const existing = await prisma.user.findUnique({
          where: { referralCode: code },
          select: { id: true },
        });
        if (!existing) {
          codeExists = false;
        } else {
          code = generateReferralCode();
          attempts++;
        }
      }

      if (codeExists) {
        console.error(`❌ 无法为用户 ${user.email} 生成唯一邀请码（尝试了 10 次）`);
        errorCount++;
        continue;
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        });
        console.log(`✅ ${user.email}: ${code}`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ 更新用户 ${user.email} 失败:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n完成！成功: ${successCount}, 失败: ${errorCount}`);
  } catch (error) {
    console.error('脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateCodesForExistingUsers();

