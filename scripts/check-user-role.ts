/**
 * 检查并修复数据库中的用户角色
 * 
 * 运行方式：npx tsx scripts/check-user-role.ts
 */

import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== 检查数据库用户角色 ===\n');

  try {
    // 查找所有用户
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isBanned: true,
        provider: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`找到 ${users.length} 个用户：\n`);

    // 显示所有用户信息
    for (const user of users) {
      console.log(`邮箱: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  是否管理员: ${user.isAdmin ? '✅ 是' : '❌ 否'}`);
      console.log(`  是否被禁用: ${user.isBanned ? '❌ 是' : '✅ 否'}`);
      console.log(`  注册方式: ${user.provider || 'credentials'}`);
      console.log(`  创建时间: ${user.createdAt.toISOString()}`);
      console.log('');
    }

    // 检查 guanliyuan@yesno.com
    const adminUser = users.find(u => u.email === 'guanliyuan@yesno.com');
    
    if (adminUser) {
      console.log('=== 检查管理员账号 ===');
      console.log(`邮箱: ${adminUser.email}`);
      console.log(`当前 isAdmin: ${adminUser.isAdmin ? '✅ true' : '❌ false'}`);
      
      if (!adminUser.isAdmin) {
        console.log('\n⚠️  检测到管理员账号 isAdmin 为 false，正在修复...');
        
        await prisma.users.update({
          where: { id: adminUser.id },
          data: { isAdmin: true },
        });
        
        console.log('✅ 已成功将 guanliyuan@yesno.com 设置为管理员');
      } else {
        console.log('✅ 管理员账号状态正常');
      }
    } else {
      console.log('⚠️  未找到 guanliyuan@yesno.com 账号');
    }

    // 统计管理员数量
    const adminCount = users.filter(u => u.isAdmin).length;
    console.log(`\n=== 统计信息 ===`);
    console.log(`总用户数: ${users.length}`);
    console.log(`管理员数量: ${adminCount}`);

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

