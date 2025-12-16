import { 
  User, 
  Market, 
  Order, 
  Deposit, 
  Withdrawal, 
  AdminLog,
  MarketStatus,
  Outcome,
  TransactionStatus
} from '@/types/data';
import { prisma } from '@/lib/prisma';

/**
 * ============================================
 * DBService - 数据库服务层（面向 Prisma）
 * ============================================
 * 所有数据操作必须通过此服务进行
 * 使用 Prisma 客户端与数据库交互
 * 返回 types/data.ts 中定义的核心业务实体类型
 * 
 * 注意：密码哈希功能已移至 services/authService.ts
 * 请使用 authService.hashPassword() 和 authService.comparePassword()
 */
export const DBService = {
  /**
   * 获取所有用户
   * @returns Promise<User[]> 用户数组
   */
  async getAllUsers(): Promise<User[]> {
    const dbUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return dbUsers.map((dbUser) => ({
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash,
      balance: dbUser.balance,
      isAdmin: dbUser.isAdmin,
      isBanned: dbUser.isBanned,
      createdAt: dbUser.createdAt.toISOString(),
    }));
  },

  /**
   * 根据邮箱查找用户
   * @param email 邮箱地址
   * @returns Promise<User | null> 用户对象
   */
  async findUserByEmail(email: string): Promise<User | null> {
    const dbUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash,
      balance: dbUser.balance,
      isAdmin: dbUser.isAdmin,
      isBanned: dbUser.isBanned,
      createdAt: dbUser.createdAt.toISOString(),
    };
  },

  /**
   * 根据用户ID查找用户
   * @param userId 用户ID
   * @returns Promise<User | null> 用户对象
   */
  async findUserById(userId: string): Promise<User | null> {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash,
      balance: dbUser.balance,
      isAdmin: dbUser.isAdmin,
      isBanned: dbUser.isBanned,
      createdAt: dbUser.createdAt.toISOString(),
    };
  },

  /**
   * 验证用户密码
   * @param email 邮箱地址
   * @param passwordHash 密码哈希值
   * @returns Promise<boolean> 密码是否匹配
   */
  async verifyPassword(email: string, passwordHash: string): Promise<boolean> {
    const user = await this.findUserByEmail(email);
    if (!user) return false;
    return user.passwordHash === passwordHash;
  },

  /**
   * 添加新用户
   * @param email 邮箱地址
   * @param passwordHash 密码哈希值
   * @param initialBalance 初始余额
   * @returns Promise<User | null> 创建的用户对象
   * 
   * 注意：严格只传递必需字段，排除所有可选字段（如 walletAddress）
   * 让数据库自动将可选字段设置为 null，避免唯一性约束冲突
   */
  async addUser(
    email: string,
    passwordHash: string,
    initialBalance: number = 0.0
  ): Promise<User | null> {
    try {
      // 严格只传递必需字段：email, passwordHash, balance, isAdmin, isBanned
      // 显式排除 walletAddress 等可选字段，让数据库自动设置为 null
      const dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          balance: initialBalance,
          isAdmin: false,
          isBanned: false,
          // 注意：不传递 walletAddress，让数据库自动设置为 null
        },
      });
      return {
        id: dbUser.id,
        email: dbUser.email,
        passwordHash: dbUser.passwordHash,
        balance: dbUser.balance,
        isAdmin: dbUser.isAdmin,
        isBanned: dbUser.isBanned,
        createdAt: dbUser.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2002') { // Unique constraint failed
        return null;
      }
      throw error;
    }
  },

  /**
   * 更新用户信息
   * @param userId 用户ID
   * @param data 要更新的数据（部分更新）
   * @returns Promise<User | null> 更新后的用户对象
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User | null> {
    try {
      const updateData: any = {};
      if (data.email !== undefined) updateData.email = data.email;
      if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
      if (data.balance !== undefined) updateData.balance = data.balance;
      if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
      if (data.isBanned !== undefined) updateData.isBanned = data.isBanned;

      const dbUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        id: dbUser.id,
        email: dbUser.email,
        passwordHash: dbUser.passwordHash,
        balance: dbUser.balance,
        isAdmin: dbUser.isAdmin,
        isBanned: dbUser.isBanned,
        createdAt: dbUser.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },

  /**
   * 获取所有市场
   * @returns Promise<Market[]> 市场数组
   */
  async getAllMarkets(categorySlug?: string): Promise<Market[]> {
    // 构建查询条件
    const where: any = {};
    if (categorySlug) {
      where.categorySlug = categorySlug;
    }

    const dbMarkets = await prisma.market.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return dbMarkets.map((dbMarket) => ({
      id: dbMarket.id,
      title: dbMarket.title,
      description: dbMarket.description,
      closingDate: dbMarket.closingDate.toISOString(),
      resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
      status: dbMarket.status as MarketStatus,
      totalVolume: dbMarket.totalVolume,
      totalYes: dbMarket.totalYes,
      totalNo: dbMarket.totalNo,
      feeRate: dbMarket.feeRate,
      category: dbMarket.category || undefined,
      categorySlug: dbMarket.categorySlug || undefined,
      createdAt: dbMarket.createdAt.toISOString(),
    }));
  },

  /**
   * 根据市场ID查找市场
   * @param marketId 市场ID
   * @returns Promise<Market | null> 市场对象
   */
  async findMarketById(marketId: string): Promise<Market | null> {
    const dbMarket = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!dbMarket) return null;

    return {
      id: dbMarket.id,
      title: dbMarket.title,
      description: dbMarket.description,
      closingDate: dbMarket.closingDate.toISOString(),
      resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
      status: dbMarket.status as MarketStatus,
      totalVolume: dbMarket.totalVolume,
      totalYes: dbMarket.totalYes,
      totalNo: dbMarket.totalNo,
      feeRate: dbMarket.feeRate,
      category: dbMarket.category || undefined,
      categorySlug: dbMarket.categorySlug || undefined,
      createdAt: dbMarket.createdAt.toISOString(),
    };
  },

  /**
   * 添加新市场
   * @param market 市场对象
   * @param options 可选参数（category 和 categorySlug）
   * @returns Promise<Market> 创建的市场对象
   */
  async addMarket(market: Market, options?: { category?: string; categorySlug?: string }): Promise<Market> {
    const dbMarket = await prisma.market.create({
      data: {
        title: market.title,
        description: market.description,
        closingDate: new Date(market.closingDate),
        resolvedOutcome: market.resolvedOutcome,
        status: market.status,
        totalVolume: market.totalVolume,
        totalYes: market.totalYes,
        totalNo: market.totalNo,
        feeRate: market.feeRate,
        category: options?.category || market.category || null,
        categorySlug: options?.categorySlug || market.categorySlug || null,
      },
    });

    return {
      id: dbMarket.id,
      title: dbMarket.title,
      description: dbMarket.description,
      closingDate: dbMarket.closingDate.toISOString(),
      resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
      status: dbMarket.status as MarketStatus,
      totalVolume: dbMarket.totalVolume,
      totalYes: dbMarket.totalYes,
      totalNo: dbMarket.totalNo,
      feeRate: dbMarket.feeRate,
      category: dbMarket.category || undefined,
      categorySlug: dbMarket.categorySlug || undefined,
      createdAt: dbMarket.createdAt.toISOString(),
    };
  },

  /**
   * 更新市场信息
   * @param marketId 市场ID
   * @param data 要更新的数据（部分更新）
   * @returns Promise<Market | null> 更新后的市场对象
   */
  async updateMarket(marketId: string, data: Partial<Market>): Promise<Market | null> {
    try {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.closingDate !== undefined) updateData.closingDate = new Date(data.closingDate);
      if (data.resolvedOutcome !== undefined) updateData.resolvedOutcome = data.resolvedOutcome;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.totalVolume !== undefined) updateData.totalVolume = data.totalVolume;
      if (data.totalYes !== undefined) updateData.totalYes = data.totalYes;
      if (data.totalNo !== undefined) updateData.totalNo = data.totalNo;
      if (data.feeRate !== undefined) updateData.feeRate = data.feeRate;

      const dbMarket = await prisma.market.update({
        where: { id: marketId },
        data: updateData,
      });

      return {
        id: dbMarket.id,
        title: dbMarket.title,
        description: dbMarket.description,
        closingDate: dbMarket.closingDate.toISOString(),
        resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
        status: dbMarket.status as MarketStatus,
        totalVolume: dbMarket.totalVolume,
        totalYes: dbMarket.totalYes,
        totalNo: dbMarket.totalNo,
        feeRate: dbMarket.feeRate,
        createdAt: dbMarket.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },

  /**
   * 添加订单
   * 
   * 硬编码检查：确保 order.userId 不是硬编码值，必须从 API 传入的 current_user_id
   * 
   * @param order 订单对象（必须包含从 Auth Token 提取的 userId）
   * @returns Promise<Order> 创建的订单对象
   */
  async addOrder(order: Order): Promise<Order> {
    // 临时防御：如果 current_user_id 为空，立即抛出错误以防止创建无效记录
    // 硬编码检查：验证 userId 不是硬编码值
    if (!order.userId || typeof order.userId !== 'string' || order.userId.trim() === '') {
      console.error('⚠️ [DBService] addOrder: order.userId 为空或无效，拒绝创建订单以防止数据泄漏');
      throw new Error('addOrder: order.userId is required and must be a non-empty string (must be extracted from Auth Token)');
    }
    
    const dbOrder = await prisma.order.create({
      data: {
        userId: order.userId, // 强制数据隔离：使用从 Auth Token 提取的 current_user_id
        marketId: order.marketId,
        outcomeSelection: order.outcomeSelection,
        amount: order.amount,
        payout: order.payout,
        feeDeducted: order.feeDeducted,
      },
    });

    return {
      id: dbOrder.id,
      userId: dbOrder.userId,
      marketId: dbOrder.marketId,
      outcomeSelection: dbOrder.outcomeSelection as Outcome,
      amount: dbOrder.amount,
      payout: dbOrder.payout ?? undefined,
      feeDeducted: dbOrder.feeDeducted,
      createdAt: dbOrder.createdAt.toISOString(),
    };
  },

  /**
   * 根据用户ID查找订单列表
   * 
   * 强制 DB 过滤：此方法必须在数据库查询中包含 WHERE user_id = current_user_id
   * 数据隔离：确保新用户看不到旧用户的订单记录
   * 
   * @param userId 用户ID（必须从 Auth Token 提取的 current_user_id）
   * @returns Promise<Order[]> 订单数组（仅包含指定用户的订单）
   */
  async findOrdersByUserId(userId: string): Promise<Order[]> {
    // 临时防御：如果 current_user_id 为空，立即返回空数组，而不是查询所有数据
    // 硬编码检查：确保 userId 不是硬编码值，必须从参数传入
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('⚠️ [DBService] findOrdersByUserId: userId 为空或无效，返回空数组以防止数据泄漏');
      return []; // 临时防御：返回空数组而不是抛出错误
    }
    
    // 强制检查：防止使用硬编码的默认 ID（如 '1' 或 'default'）
    if (userId === '1' || userId === 'default') {
      console.error('❌ [DBService] findOrdersByUserId: 检测到无效的 userId（可能是硬编码的默认值）:', userId);
      return []; // 强制返回空数组以防止数据泄漏
    }
    
    // 验证 userId 是有效的 UUID 格式
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      console.error('❌ [DBService] findOrdersByUserId: userId 格式无效，不是有效的 UUID:', userId);
      return []; // 强制返回空数组以防止数据泄漏
    }
    
    // 强制 DB 过滤：WHERE userId = current_user_id
    // 查询结构强制修复：明确且强制地包含基于传入 current_user_id 的过滤条件
    const dbOrders = await prisma.order.findMany({
      where: { userId }, // 强制数据隔离：只返回当前用户的订单，WHERE user_id = current_user_id
      orderBy: { createdAt: 'desc' },
    });

    return dbOrders.map((dbOrder) => ({
      id: dbOrder.id,
      userId: dbOrder.userId,
      marketId: dbOrder.marketId,
      outcomeSelection: dbOrder.outcomeSelection as Outcome,
      amount: dbOrder.amount,
      payout: dbOrder.payout ?? undefined,
      feeDeducted: dbOrder.feeDeducted,
      createdAt: dbOrder.createdAt.toISOString(),
    }));
  },

  /**
   * 根据市场ID查找所有订单
   * 
   * ⚠️ 安全警告：此方法不包含用户 ID 过滤，返回指定市场的所有订单
   * 主要用于管理员操作（如市场结算），不应用于用户数据查询
   * 
   * @param marketId 市场ID
   * @returns Promise<Order[]> 订单列表（包含所有用户的订单）
   */
  async findOrdersByMarketId(marketId: string): Promise<Order[]> {
    // ⚠️ 注意：此查询不包含 userId 过滤，返回所有用户的订单
    // 仅用于管理员操作，不应用于用户数据查询
    const dbOrders = await prisma.order.findMany({
      where: { marketId },
      orderBy: { createdAt: 'desc' },
    });

    return dbOrders.map((dbOrder) => ({
      id: dbOrder.id,
      userId: dbOrder.userId,
      marketId: dbOrder.marketId,
      outcomeSelection: dbOrder.outcomeSelection as Outcome,
      amount: dbOrder.amount,
      payout: dbOrder.payout ?? undefined,
      feeDeducted: dbOrder.feeDeducted,
      createdAt: dbOrder.createdAt.toISOString(),
    }));
  },

  /**
   * 更新订单数据
   * 
   * ⚠️ 安全警告：此方法不包含用户 ID 过滤，主要用于管理员操作（如市场结算）
   * 如果用于用户操作，调用方必须验证 order.userId === current_user_id
   * 
   * @param orderId 订单ID
   * @param data 要更新的数据（部分更新）
   * @returns Promise<Order | null> 更新后的订单对象
   */
  async updateOrder(orderId: string, data: Partial<Order>): Promise<Order | null> {
    try {
      const updateData: any = {};
      if (data.payout !== undefined) updateData.payout = data.payout;
      if (data.feeDeducted !== undefined) updateData.feeDeducted = data.feeDeducted;

      // ⚠️ 注意：此更新不包含 userId 过滤，调用方必须验证用户权限
      const dbOrder = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      return {
        id: dbOrder.id,
        userId: dbOrder.userId,
        marketId: dbOrder.marketId,
        outcomeSelection: dbOrder.outcomeSelection as Outcome,
        amount: dbOrder.amount,
        payout: dbOrder.payout ?? undefined,
        feeDeducted: dbOrder.feeDeducted,
        createdAt: dbOrder.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },

  /**
   * 添加充值记录
   * 
   * 硬编码检查：确保 deposit.userId 不是硬编码值，必须从 API 传入的 current_user_id
   * 
   * @param deposit 充值对象（必须包含从 Auth Token 提取的 userId）
   * @returns Promise<Deposit> 添加的充值记录
   */
  async addDeposit(deposit: Deposit): Promise<Deposit> {
    // 临时防御：如果 current_user_id 为空，立即抛出错误以防止创建无效记录
    // 硬编码检查：验证 userId 不是硬编码值
    if (!deposit.userId || typeof deposit.userId !== 'string' || deposit.userId.trim() === '') {
      console.error('⚠️ [DBService] addDeposit: deposit.userId 为空或无效，拒绝创建充值记录以防止数据泄漏');
      throw new Error('addDeposit: deposit.userId is required and must be a non-empty string (must be extracted from Auth Token)');
    }
    
    const dbDeposit = await prisma.deposit.create({
      data: {
        userId: deposit.userId, // 强制数据隔离：使用从 Auth Token 提取的 current_user_id
        amount: deposit.amount,
        txHash: deposit.txHash,
        status: deposit.status,
      },
    });

    return {
      id: dbDeposit.id,
      userId: dbDeposit.userId,
      amount: dbDeposit.amount,
      txHash: dbDeposit.txHash,
      status: dbDeposit.status as TransactionStatus,
      createdAt: dbDeposit.createdAt.toISOString(),
    };
  },

  /**
   * 添加提现记录
   * 
   * 硬编码检查：确保 withdrawal.userId 不是硬编码值，必须从 API 传入的 current_user_id
   * 
   * @param withdrawal 提现对象（必须包含从 Auth Token 提取的 userId）
   * @returns Promise<Withdrawal> 添加的提现记录
   */
  async addWithdrawal(withdrawal: Withdrawal): Promise<Withdrawal> {
    // 临时防御：如果 current_user_id 为空，立即抛出错误以防止创建无效记录
    // 硬编码检查：验证 userId 不是硬编码值
    if (!withdrawal.userId || typeof withdrawal.userId !== 'string' || withdrawal.userId.trim() === '') {
      console.error('⚠️ [DBService] addWithdrawal: withdrawal.userId 为空或无效，拒绝创建提现记录以防止数据泄漏');
      throw new Error('addWithdrawal: withdrawal.userId is required and must be a non-empty string (must be extracted from Auth Token)');
    }
    
    const dbWithdrawal = await prisma.withdrawal.create({
      data: {
        userId: withdrawal.userId, // 强制数据隔离：使用从 Auth Token 提取的 current_user_id
        amount: withdrawal.amount,
        targetAddress: withdrawal.targetAddress,
        status: withdrawal.status,
      },
    });

    return {
      id: dbWithdrawal.id,
      userId: dbWithdrawal.userId,
      amount: dbWithdrawal.amount,
      targetAddress: dbWithdrawal.targetAddress,
      status: dbWithdrawal.status as TransactionStatus,
      createdAt: dbWithdrawal.createdAt.toISOString(),
    };
  },

  /**
   * 查找用户的所有交易记录（充值和提现）
   * 
   * 强制 DB 过滤：此方法必须在数据库查询中包含 WHERE user_id = current_user_id
   * 数据隔离：确保新用户看不到旧用户的交易记录
   * 
   * @param userId 用户ID（必须从 Auth Token 提取的 current_user_id）
   * @returns Promise<{ deposits: Deposit[], withdrawals: Withdrawal[] }> 交易记录（仅包含指定用户的记录）
   */
  async findUserTransactions(userId: string): Promise<{ deposits: Deposit[]; withdrawals: Withdrawal[] }> {
    // 临时防御：如果 current_user_id 为空，立即返回空数组，而不是查询所有数据
    // 硬编码检查：确保 userId 不是硬编码值，必须从参数传入
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('⚠️ [DBService] findUserTransactions: userId 为空或无效，返回空数组以防止数据泄漏');
      return { deposits: [], withdrawals: [] }; // 临时防御：返回空数组而不是抛出错误
    }
    
    // 强制检查：防止使用硬编码的默认 ID（如 '1' 或 'default'）
    if (userId === '1' || userId === 'default') {
      console.error('❌ [DBService] findUserTransactions: 检测到无效的 userId（可能是硬编码的默认值）:', userId);
      return { deposits: [], withdrawals: [] }; // 强制返回空数组以防止数据泄漏
    }
    
    // 验证 userId 是有效的 UUID 格式
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      console.error('❌ [DBService] findUserTransactions: userId 格式无效，不是有效的 UUID:', userId);
      return { deposits: [], withdrawals: [] }; // 强制返回空数组以防止数据泄漏
    }
    
    // 强制 DB 过滤：WHERE userId = current_user_id
    // 查询结构强制修复：明确且强制地包含基于传入 current_user_id 的过滤条件
    const [dbDeposits, dbWithdrawals] = await Promise.all([
      prisma.deposit.findMany({
        where: { userId }, // 强制数据隔离：只返回当前用户的充值记录，WHERE user_id = current_user_id
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawal.findMany({
        where: { userId }, // 强制数据隔离：只返回当前用户的提现记录，WHERE user_id = current_user_id
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      deposits: dbDeposits.map((dbDeposit) => ({
        id: dbDeposit.id,
        userId: dbDeposit.userId,
        amount: dbDeposit.amount,
        txHash: dbDeposit.txHash,
        status: dbDeposit.status as TransactionStatus,
        createdAt: dbDeposit.createdAt.toISOString(),
      })),
      withdrawals: dbWithdrawals.map((dbWithdrawal) => ({
        id: dbWithdrawal.id,
        userId: dbWithdrawal.userId,
        amount: dbWithdrawal.amount,
        targetAddress: dbWithdrawal.targetAddress,
        status: dbWithdrawal.status as TransactionStatus,
        createdAt: dbWithdrawal.createdAt.toISOString(),
      })),
    };
  },

  /**
   * 查找所有待处理的提现请求
   * @returns Promise<Withdrawal[]> 待处理的提现请求列表
   */
  async findPendingWithdrawals(): Promise<Withdrawal[]> {
    const dbWithdrawals = await prisma.withdrawal.findMany({
      where: { status: TransactionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });

    return dbWithdrawals.map((dbWithdrawal) => ({
      id: dbWithdrawal.id,
      userId: dbWithdrawal.userId,
      amount: dbWithdrawal.amount,
      targetAddress: dbWithdrawal.targetAddress,
      status: dbWithdrawal.status as TransactionStatus,
      createdAt: dbWithdrawal.createdAt.toISOString(),
    }));
  },

  /**
   * 根据提现记录ID查找提现记录
   * 
   * ⚠️ 安全警告：此方法不包含用户 ID 过滤，主要用于管理员操作
   * 如果用于用户操作，调用方必须验证 withdrawal.userId === current_user_id
   * 
   * @param withdrawalId 提现记录ID
   * @returns Promise<Withdrawal | null> 提现记录对象
   */
  async findWithdrawalById(withdrawalId: string): Promise<Withdrawal | null> {
    // ⚠️ 注意：此查询不包含 userId 过滤，调用方必须验证用户权限
    const dbWithdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!dbWithdrawal) return null;

    return {
      id: dbWithdrawal.id,
      userId: dbWithdrawal.userId,
      amount: dbWithdrawal.amount,
      targetAddress: dbWithdrawal.targetAddress,
      status: dbWithdrawal.status as TransactionStatus,
      createdAt: dbWithdrawal.createdAt.toISOString(),
    };
  },

  /**
   * 更新提现记录状态
   * @param withdrawalId 提现记录ID
   * @param status 新状态
   * @returns Promise<Withdrawal | null> 更新后的提现记录
   */
  async updateWithdrawalStatus(withdrawalId: string, status: TransactionStatus): Promise<Withdrawal | null> {
    try {
      const dbWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status },
      });

      return {
        id: dbWithdrawal.id,
        userId: dbWithdrawal.userId,
        amount: dbWithdrawal.amount,
        targetAddress: dbWithdrawal.targetAddress,
        status: dbWithdrawal.status as TransactionStatus,
        createdAt: dbWithdrawal.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },
};

// 向后兼容导出
export const MockDBService = DBService;
export const UserService = DBService;

