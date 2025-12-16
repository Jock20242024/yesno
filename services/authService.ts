/**
 * 密码哈希服务
 * 
 * 提供密码哈希和验证功能
 * 使用 bcryptjs 进行密码哈希和验证
 * 
 * 重要：saltRounds 必须保持一致，确保注册和登录使用相同的配置
 */

// 固定 saltRounds 常量，确保注册和登录使用相同的配置
const SALT_ROUNDS = 10;

/**
 * 哈希密码
 * @param password 明文密码
 * @returns Promise<string> 哈希后的密码字符串
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  try {
    // 使用 bcryptjs 进行密码哈希
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // 验证哈希是否生成成功
    if (!hash || hash.length === 0) {
      throw new Error('Failed to generate password hash');
    }
    
    console.log(`🔐 [hashPassword] 密码哈希生成成功，长度: ${hash.length}, saltRounds: ${SALT_ROUNDS}`);
    return hash;
  } catch (error) {
    console.error('❌ [hashPassword] 密码哈希失败:', error);
    throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 比较密码
 * @param password 明文密码
 * @param hash 存储的哈希值
 * @returns Promise<boolean> 密码是否匹配
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // 验证输入参数
  if (!password || typeof password !== 'string' || password.length === 0) {
    console.error('❌ [comparePassword] 密码为空或无效');
    return false;
  }

  if (!hash || typeof hash !== 'string' || hash.length === 0) {
    console.error('❌ [comparePassword] 哈希值为空或无效');
    return false;
  }

  try {
    // 使用 bcryptjs 进行密码比较
    const bcrypt = await import('bcryptjs');
    
    // 验证哈希格式（bcrypt 哈希通常以 $2a$, $2b$, $2y$ 开头）
    if (!hash.startsWith('$2')) {
      console.warn(`⚠️ [comparePassword] 哈希格式可能不正确，前缀: ${hash.substring(0, 10)}`);
    }
    
    console.log(`🔍 [comparePassword] 开始密码比较`);
    console.log(`   密码长度: ${password.length}`);
    console.log(`   哈希长度: ${hash.length}`);
    console.log(`   哈希前缀: ${hash.substring(0, 30)}...`);
    
    const result = await bcrypt.compare(password, hash);
    
    console.log(`🔍 [comparePassword] 比较结果: ${result}`);
    return result;
  } catch (error) {
    console.error('❌ [comparePassword] 密码比较失败:', error);
    // 如果 bcrypt 比较失败，返回 false（安全默认值）
    return false;
  }
}

