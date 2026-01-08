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
import { randomUUID } from 'crypto';

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
    const dbUsers = await prisma.users.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // 🔥 性能优化：删除高频查询的日志
    // console.log(`[DBService.getAllUsers] Prisma returned ${dbUsers.length} users`);
    
    return dbUsers.map((dbUser) => ({
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash || '',
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
    const dbUser = await prisma.users.findUnique({
      where: { email },
    });
    
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash || '',
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
    const dbUser = await prisma.users.findUnique({
      where: { id: userId },
    });
    
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash || '',
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
      const dbUser = await prisma.users.create({
        data: {
          id: randomUUID(),
          updatedAt: new Date(),
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
        passwordHash: dbUser.passwordHash || '',
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

      const dbUser = await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        id: dbUser.id,
        email: dbUser.email,
        passwordHash: dbUser.passwordHash || '',
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
   * @param categorySlug 分类 slug（可选）
   * @param includePending 是否包含待审核的市场（默认 false，只返回已发布的）
   * @returns Promise<Market[]> 市场数组
   */
  async getAllMarkets(categorySlug?: string, includePending: boolean = false): Promise<Market[]> {
    // 构建查询条件
    const where: any = {
      isActive: true, // 🔥 只返回未删除的市场
    };

    // 🔥 默认只返回已发布的市场（除非 explicitly 指定 includePending）
    if (!includePending) {
      where.reviewStatus = 'PUBLISHED';
    }
    
    // 🔥 支持通过多对多关系筛选分类（使用 ID 集合进行物理隔离查询）
    if (categorySlug) {
      // 1. 先获取当前分类及其直属子分类 ID
      const category = await prisma.categories.findUnique({
        where: { slug: categorySlug },
        include: { other_categories: { select: { id: true } } }
      });
      
      // 2. 严禁"裸奔"：如果 Slug 没对上，直接返回空数组，不准返回全量市场
      if (!category) {
        console.warn(`⚠️ [DBService] 分类 ${categorySlug} 不存在，返回空数组`);
        return [];
      }
      
      // 3. 🔥 修复 ID 匹配：确保即使没有子分类，categoryIds 也能正确包含当前分类 ID
      // 即使 children 为空或 undefined，至少也会包含 category.id
      const childrenIds = category.other_categories?.map(c => c.id) || [];
      const categoryIds = [category.id, ...childrenIds];
      
      // 4. 使用这个 ID 集合进行查询
      where.categories = {
        some: {
          categoryId: { in: categoryIds }
        }
      };
      
      const childCount = categoryIds.length - 1; // 减去父类本身
      if (childCount > 0) {

      } else {

      }
    }

    let dbMarkets;
    try {
      dbMarkets = await prisma.markets.findMany({
        where,
        include: {
          market_categories: {
            include: {
              categories: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        // 🔥 添加交易量排序逻辑：按 totalVolume 降序排列，交易量最大的市场排在最前面
        orderBy: { totalVolume: 'desc' },
      });

    } catch (dbError) {
      console.error('❌ [DBService] getAllMarkets 数据库查询失败:');
      console.error('查询条件:', JSON.stringify(where, null, 2));
      console.error('错误类型:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('错误消息:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('错误堆栈:', dbError instanceof Error ? dbError.stack : 'N/A');
      throw dbError;
    }

    // 🔥 安全映射：处理每个市场对象，确保新字段有默认值
    return dbMarkets.map((dbMarket) => {
      try {
        // 🔥 安全处理新字段：确保 source、externalVolume 等字段有默认值（旧数据可能是 null）
        const source = dbMarket.source || 'INTERNAL';
        const externalVolume = dbMarket.externalVolume ?? 0;
        const internalVolume = dbMarket.internalVolume ?? 0;
        const manualOffset = dbMarket.manualOffset ?? 0;
        const isActive = dbMarket.isActive ?? true; // 默认 true（向后兼容）
        
        // 🔥 处理 BigInt 类型：确保所有数值字段都是 Number 类型（不是 BigInt 或 null）
        const convertToNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          // 处理 BigInt 类型
          if (typeof value === 'bigint') {
            try {
              return Number(value);
            } catch {
              return 0;
            }
          }
          // 处理字符串
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
          }
          // 处理数字
          const num = Number(value);
          return isNaN(num) || !isFinite(num) ? 0 : num;
        };

        const safeTotalVolume = convertToNumber(dbMarket.totalVolume);
        const safeTotalYes = convertToNumber(dbMarket.totalYes);
        const safeTotalNo = convertToNumber(dbMarket.totalNo);
        const safeFeeRate = convertToNumber(dbMarket.feeRate) || 0.05; // 如果为 0，使用默认值 0.05
        const safeExternalVolume = convertToNumber(externalVolume);
        const safeInternalVolume = convertToNumber(internalVolume);
        const safeManualOffset = convertToNumber(manualOffset);

        // 🔥 计算 yesPercent 和 noPercent（安全处理）
        let safeYesPercent = 50;
        let safeNoPercent = 50;
        if (safeTotalYes > 0 || safeTotalNo > 0) {
          const totalAmount = safeTotalYes + safeTotalNo;
          const calculatedYes = Math.round((safeTotalYes / totalAmount) * 100);
          const calculatedNo = Math.round((safeTotalNo / totalAmount) * 100);
          safeYesPercent = isNaN(calculatedYes) || !isFinite(calculatedYes) ? 50 : calculatedYes;
          safeNoPercent = isNaN(calculatedNo) || !isFinite(calculatedNo) ? 50 : calculatedNo;
        }

        return {
          id: dbMarket.id,
          title: dbMarket.title,
          description: dbMarket.description,
          closingDate: dbMarket.closingDate.toISOString(),
          resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
          status: dbMarket.status as MarketStatus,
          totalVolume: safeTotalVolume, // 🔥 确保是 Number 类型
          totalYes: safeTotalYes, // 🔥 确保是 Number 类型
          totalNo: safeTotalNo, // 🔥 确保是 Number 类型
          feeRate: safeFeeRate, // 🔥 确保是 Number 类型
          category: dbMarket.market_categories[0]?.categories?.name || dbMarket.category || undefined,
          categorySlug: dbMarket.market_categories[0]?.categories?.slug || dbMarket.categorySlug || undefined,
          createdAt: dbMarket.createdAt.toISOString(),
          // 添加 isHot 字段（用于前端筛选）
          ...(dbMarket.isHot !== undefined && { isHot: dbMarket.isHot } as any),
          // 添加 volume 字段（用于排序，兼容性字段）
          volume: safeTotalVolume, // 🔥 确保是 Number 类型
          // totalVolume: safeTotalVolume, // 🔥 移除重复属性，使用 volume
          // 🔥 添加 yesPercent 和 noPercent 字段（用于显示）
          yesPercent: safeYesPercent, // 🔥 确保是有效的数字
          noPercent: safeNoPercent, // 🔥 确保是有效的数字
          // 🔥 添加原始数据字段（从数据库直接读取）
          outcomePrices: dbMarket.outcomePrices || null,
          image: dbMarket.image || null,
          iconUrl: dbMarket.iconUrl || null,
          initialPrice: dbMarket.initialPrice ? Number(dbMarket.initialPrice) : null,
          volume24h: dbMarket.volume24h ? Number(dbMarket.volume24h) : null,
          // 🔥 添加新字段（安全处理 null 值，确保是 Number 类型）
          source: source as 'POLYMARKET' | 'INTERNAL',
          externalVolume: safeExternalVolume, // 🔥 确保是 Number 类型
          internalVolume: safeInternalVolume, // 🔥 确保是 Number 类型
          manualOffset: safeManualOffset, // 🔥 确保是 Number 类型
          isActive,
          // 🔥 工厂市场关键字段：确保包含 templateId、isFactory 和 period，用于聚合去重
          templateId: (dbMarket as any).templateId || null,
          isFactory: (dbMarket as any).isFactory || false,
          period: (dbMarket as any).period || null,
        } as any; // 使用 as any 避免类型检查错误（因为 Market 接口可能还没有这些字段）
      } catch (mapError) {
        console.error('❌ [DBService] getAllMarkets 映射单个市场失败 (ID:', dbMarket.id, '):');
        console.error('错误类型:', mapError instanceof Error ? mapError.constructor.name : typeof mapError);
        console.error('错误消息:', mapError instanceof Error ? mapError.message : String(mapError));
        console.error('错误堆栈:', mapError instanceof Error ? mapError.stack : 'N/A');
        // 返回一个安全的默认对象，避免整个查询失败
        return {
          id: dbMarket.id,
          title: dbMarket.title || '未知市场',
          description: dbMarket.description || '',
          closingDate: dbMarket.closingDate.toISOString(),
          status: dbMarket.status as MarketStatus,
          totalVolume: dbMarket.totalVolume || 0,
          totalYes: dbMarket.totalYes || 0,
          totalNo: dbMarket.totalNo || 0,
          feeRate: dbMarket.feeRate || 0.05,
          category: undefined,
          categorySlug: undefined,
          createdAt: dbMarket.createdAt.toISOString(),
          source: 'INTERNAL' as 'POLYMARKET' | 'INTERNAL',
          externalVolume: 0,
          internalVolume: 0,
          manualOffset: 0,
          isActive: true,
          // 🔥 工厂市场关键字段：错误情况下也提供默认值
          templateId: null,
          isFactory: false,
          period: null,
        } as any;
      }
    });
  },

  /**
   * 根据市场ID查找市场
   * @param marketId 市场ID
   * @returns Promise<Market | null> 市场对象
   */
  async findMarketById(marketId: string): Promise<Market | null> {
    try {
      // 🔥 统一"身份证"校验逻辑：支持双重查找（slug 或 id）
      // 由于目前 Market 表没有 slug 字段，先用 ID 查找，如果将来添加了 slug 字段，可以同时支持
      const dbMarket = await prisma.markets.findFirst({
        where: {
          OR: [
            { id: marketId }, // 🔥 先尝试按 ID 匹配（兼容没有 slug 的手动市场）
            // 如果将来添加了 slug 字段，取消注释下面这行：
            // { slug: marketId }, // 🔥 支持按 slug 匹配
          ],
          reviewStatus: 'PUBLISHED', // 🔥 确保只展示已发布的
          isActive: true, // 🔥 只返回未删除的市场
        },
      });

      if (!dbMarket) {
        // 🔥 性能优化：删除高频查询失败的日志（仅在开发环境输出）
        // console.log('⚠️ [DBService] findMarketById: 市场未找到或已删除, ID:', marketId);
        return null;
      }

      // 🔥 安全处理新字段：确保 source、externalVolume 等字段有默认值（旧数据可能是 null）
      const source = dbMarket.source || 'INTERNAL';
      const externalVolume = dbMarket.externalVolume ?? 0;
      const internalVolume = dbMarket.internalVolume ?? 0;
      const manualOffset = dbMarket.manualOffset ?? 0;

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
        // 🔥 添加新字段（安全处理 null 值）
        source: source as 'POLYMARKET' | 'INTERNAL',
        externalVolume,
        internalVolume,
        manualOffset,
        isActive: dbMarket.isActive ?? true, // 默认 true（向后兼容）
      } as any; // 使用 as any 避免类型检查错误（因为 Market 接口可能还没有这些字段）
    } catch (error) {
      console.error('❌ [DBService] findMarketById 查询失败, ID:', marketId);
      console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('错误消息:', error instanceof Error ? error.message : String(error));
      console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  },

  /**
   * 添加新市场
   * @param market 市场对象
   * @param options 可选参数（category, categorySlug, categoryId, reviewStatus, isHot）
   * @returns Promise<Market> 创建的市场对象
   */
  async addMarket(
    market: Market,
    options?: { 
      category?: string; 
      categorySlug?: string; 
      categoryId?: string; // 🔥 分类 ID（用于创建 MarketCategory 关联）
      reviewStatus?: 'PENDING' | 'PUBLISHED' | 'REJECTED';
      isHot?: boolean; // 🔥 热门标记
    }
  ): Promise<Market> {
    try {
      // 🔥 重构数据构造逻辑：确保包含所有必填字段，防止 Prisma 报错
      const marketCreateData: any = {
        // 基本字段
        title: market.title,
        description: market.description || '',
        closingDate: new Date(market.closingDate),
        status: market.status || 'OPEN',
        // 🔥 修复 undefined 报错：必须传 null，不能传 undefined（Prisma 不接受 undefined）
        resolvedOutcome: market.resolvedOutcome ?? null,
        // 🔥 补全缺失的必填字段（根据 schema.prisma 要求）
        source: 'INTERNAL' as const, // 自主上架默认为 INTERNAL
        isActive: true, // 默认为启用
        externalVolume: 0, // 初始外部交易量
        internalVolume: market.totalVolume || 0, // 初始内部交易量
        manualOffset: 0, // 初始偏移量
        // 其他字段
        isHot: Boolean(options?.isHot || false), // 热门标记
        totalVolume: market.totalVolume || 0, // 向后兼容字段
        totalYes: market.totalYes || 0,
        totalNo: market.totalNo || 0,
        feeRate: market.feeRate || 0.05,
        category: options?.category || market.category || null, // 兼容字段
        categorySlug: options?.categorySlug || market.categorySlug || null, // 兼容字段
        // 如果未指定 reviewStatus，默认为 PUBLISHED（管理员手动创建）
        reviewStatus: (options?.reviewStatus || 'PUBLISHED') as 'PENDING' | 'PUBLISHED' | 'REJECTED',
      };

      // 🔥 处理分类关联（如果提供了 categoryId）
      // 使用嵌套 create 创建 MarketCategory 中间表记录
      if (options?.categoryId) {
        marketCreateData.categories = {
          create: {
            categoryId: options.categoryId,
          },
        };
      }

      // 🔥 管理员权限：允许通过 DBService 创建市场（用于后台管理）
      // 为新市场生成 templateId（使用 manual- 前缀标识手动创建）
      const crypto = await import('crypto');
      const templateId = `manual-${crypto.randomUUID()}`;
      marketCreateData.templateId = templateId;
      
      const dbMarket = await prisma.markets.create({
        data: marketCreateData,
      });

      return {
        id: dbMarket.id,
        title: dbMarket.title,
        description: dbMarket.description,
        closingDate: dbMarket.closingDate.toISOString(),
        resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
        status: dbMarket.status as MarketStatus,
        totalVolume: Number(dbMarket.totalVolume), // 🔥 确保是 Number 类型（不是 BigInt）
        totalYes: Number(dbMarket.totalYes), // 🔥 确保是 Number 类型
        totalNo: Number(dbMarket.totalNo), // 🔥 确保是 Number 类型
        feeRate: Number(dbMarket.feeRate), // 🔥 确保是 Number 类型
        category: dbMarket.category || undefined,
        categorySlug: dbMarket.categorySlug || undefined,
        createdAt: dbMarket.createdAt.toISOString(),
      };
    } catch (dbError) {
      console.error('❌ [DBService] addMarket 创建市场失败:');
      console.error('错误类型:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('错误消息:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('错误堆栈:', dbError instanceof Error ? dbError.stack : 'N/A');
      console.dir(dbError, { depth: null, colors: true });
      throw dbError; // 重新抛出，让调用方处理
    }
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
      // 🔥 支持 image 字段更新
      if ((data as any).image !== undefined) updateData.image = (data as any).image;
      // 🔥 支持 externalId 字段更新
      if ((data as any).externalId !== undefined) updateData.externalId = (data as any).externalId;

      const dbMarket = await prisma.markets.update({
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
    
    const dbOrder = await prisma.orders.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
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
    const dbOrders = await prisma.orders.findMany({
      where: { userId }, // 强制数据隔离：只返回当前用户的订单，WHERE user_id = current_user_id
      orderBy: { createdAt: 'desc' },
    });

    // 🔥 修复：返回所有订单字段，包括 filledAmount、orderType、status 等
    return dbOrders.map((dbOrder) => ({
      id: dbOrder.id,
      userId: dbOrder.userId,
      marketId: dbOrder.marketId,
      outcomeSelection: dbOrder.outcomeSelection as Outcome,
      amount: dbOrder.amount,
      payout: dbOrder.payout ?? undefined,
      feeDeducted: dbOrder.feeDeducted,
      createdAt: dbOrder.createdAt.toISOString(),
      // 🔥 新增：返回订单的完整字段，用于交易历史显示
      filledAmount: dbOrder.filledAmount || 0, // 实际成交的份额数
      orderType: dbOrder.orderType || 'MARKET', // 订单类型（MARKET/LIMIT）
      status: dbOrder.status || 'PENDING', // 订单状态（FILLED/PENDING/CANCELLED）
      limitPrice: dbOrder.limitPrice || undefined, // 限价订单的价格
      type: dbOrder.type || 'BUY', // 订单方向（BUY/SELL）
    } as any)); // 使用 as any 因为 Order 接口可能还没有这些字段
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
    const dbOrders = await prisma.orders.findMany({
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
      const dbOrder = await prisma.orders.update({
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
    
    const dbDeposit = await prisma.deposits.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
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
    
    const dbWithdrawal = await prisma.withdrawals.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
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
      prisma.deposits.findMany({
        where: { userId }, // 强制数据隔离：只返回当前用户的充值记录，WHERE user_id = current_user_id
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawals.findMany({
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
    const dbWithdrawals = await prisma.withdrawals.findMany({
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
    const dbWithdrawal = await prisma.withdrawals.findUnique({
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
      const dbWithdrawal = await prisma.withdrawals.update({
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

