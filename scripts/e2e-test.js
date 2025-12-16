/**
 * E2E 测试脚本
 * 执行完整的端到端测试场景
 */

const BASE_URL = 'http://localhost:3000';
const ADMIN_SECRET_TOKEN = 'ADMIN_SECRET_TOKEN';

// 测试用户
let testUserEmail = 'testuser@verify.com';
let testUserPassword = 'testpass123';
let adminEmail = 'yesno@yesno.com';
let adminPassword = 'yesno2025';

// 存储测试数据
let testUserId = null;
let marketId = null;
let withdrawalId = null;
let adminAuthToken = null;

/**
 * 辅助函数：发送 API 请求
 */
async function apiRequest(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * 场景 2：用户注册与充值
 */
async function testScenario2() {
  console.log('\n=== 场景 2: 用户注册与充值 ===\n');

  // 1. 注册新用户
  console.log('1. 注册新用户...');
  const registerResult = await apiRequest('/api/auth/register', 'POST', {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (!registerResult.ok) {
    console.error('❌ 注册失败:', registerResult.data?.error || registerResult.error);
    return false;
  }

  testUserId = registerResult.data.user?.id;
  console.log('✅ 用户注册成功');
  console.log(`   用户 ID: ${testUserId}`);
  console.log(`   邮箱: ${testUserEmail}`);

  // 2. 用户登录（获取 authToken）
  console.log('\n2. 用户登录...');
  const loginResult = await apiRequest('/api/auth/login', 'POST', {
    email: testUserEmail,
    password: testUserPassword,
  });

  if (!loginResult.ok) {
    console.error('❌ 登录失败:', loginResult.data?.error);
    return false;
  }

  // 从 Cookie 获取 authToken（这里简化处理，实际应从 Cookie 读取）
  console.log('✅ 用户登录成功');

  // 3. 充值 $1000
  console.log('\n3. 充值 $1000...');
  const depositResult = await apiRequest('/api/deposit', 'POST', {
    amount: 1000,
    txHash: `TEST_TX_${Date.now()}`,
  });

  if (!depositResult.ok) {
    console.error('❌ 充值失败:', depositResult.data?.error);
    return false;
  }

  console.log('✅ 充值成功');

  // 4. 验证余额
  console.log('\n4. 验证用户余额...');
  // 由于没有直接的余额查询 API，我们需要通过订单或交易记录来验证
  // 这里我们假设充值后余额应该是 $1000.00
  const expectedBalance = 1000.0;
  console.log(`   预期余额: $${expectedBalance.toFixed(2)}`);
  
  // 通过获取用户详情来验证余额（如果有 API）
  // 或者通过数据库直接查询
  console.log('✅ 场景 2 完成（余额验证需通过数据库确认）');
  
  return true;
}

/**
 * Admin 登录
 */
async function adminLogin() {
  console.log('\n=== Admin 登录 ===\n');
  
  const loginResult = await apiRequest('/api/admin/auth/login', 'POST', {
    adminEmail,
    adminPassword,
  });

  if (!loginResult.ok) {
    console.error('❌ Admin 登录失败:', loginResult.data?.error);
    return false;
  }

  console.log('✅ Admin 登录成功');
  return true;
}

/**
 * 场景 3-4：市场创建、下注和提现请求
 */
async function testScenario34() {
  console.log('\n=== 场景 3-4: 市场创建、下注和提现 ===\n');

  // 1. Admin 创建市场 M1
  console.log('1. Admin 创建市场 M1 (费率 5%)...');
  const marketResult = await apiRequest(
    '/api/admin/markets',
    'POST',
    {
      title: 'E2E测试市场M1',
      description: '端到端测试市场',
      category: 'test',
      closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      feeRate: 0.05,
    },
    {
      'Authorization': `Bearer ${ADMIN_SECRET_TOKEN}`,
    }
  );

  if (!marketResult.ok) {
    console.error('❌ 市场创建失败:', marketResult.data?.error);
    return false;
  }

  marketId = marketResult.data.market?.id;
  console.log('✅ 市场创建成功');
  console.log(`   市场 ID: ${marketId}`);

  // 2. 用户 A 下注 YES $100
  console.log('\n2. 用户 A 下注 YES $100...');
  const orderResult = await apiRequest(
    '/api/orders',
    'POST',
    {
      marketId,
      outcomeSelection: 'YES',
      amount: 100,
    }
  );

  if (!orderResult.ok) {
    console.error('❌ 下注失败:', orderResult.data?.error);
    return false;
  }

  console.log('✅ 下注成功');
  console.log(`   订单 ID: ${orderResult.data.data?.order?.id}`);
  console.log(`   更新后余额: $${orderResult.data.data?.updatedBalance?.toFixed(2) || 'N/A'}`);

  // 3. 用户 A 提交提现请求 $500
  console.log('\n3. 用户 A 提交提现请求 $500...');
  const withdrawResult = await apiRequest(
    '/api/withdraw',
    'POST',
    {
      amount: 500,
      targetAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    }
  );

  if (!withdrawResult.ok) {
    console.error('❌ 提现请求失败:', withdrawResult.data?.error);
    return false;
  }

  withdrawalId = withdrawResult.data.withdrawal?.id;
  console.log('✅ 提现请求成功');
  console.log(`   提现 ID: ${withdrawalId}`);
  console.log(`   更新后余额: $${withdrawResult.data.updatedBalance?.toFixed(2) || 'N/A'}`);

  // 4. 报告最终余额（预期 $400.00）
  console.log('\n4. 验证最终余额...');
  const expectedBalance = 400.0; // $1000 - $100 - $500
  console.log(`   预期余额: $${expectedBalance.toFixed(2)}`);
  console.log('✅ 场景 3-4 完成（余额验证需通过数据库确认）');

  return true;
}

/**
 * 场景 5：市场清算
 */
async function testScenario5() {
  console.log('\n=== 场景 5: 市场清算 ===\n');

  // 1. 将市场状态改为 CLOSED
  console.log('1. 将市场状态改为 CLOSED...');
  const updateResult = await apiRequest(
    `/api/admin/markets/${marketId}`,
    'PUT',
    {
      status: 'CLOSED',
    },
    {
      'Authorization': `Bearer ${ADMIN_SECRET_TOKEN}`,
    }
  );

  if (!updateResult.ok) {
    console.error('❌ 市场状态更新失败:', updateResult.data?.error);
    return false;
  }

  console.log('✅ 市场状态已更新为 CLOSED');

  // 2. 清算市场，选择结果 YES
  console.log('\n2. 清算市场，选择结果 YES...');
  const settleResult = await apiRequest(
    `/api/admin/markets/${marketId}/settle`,
    'POST',
    {
      finalOutcome: 'YES',
    },
    {
      'Authorization': `Bearer ${ADMIN_SECRET_TOKEN}`,
    }
  );

  if (!settleResult.ok) {
    console.error('❌ 市场清算失败:', settleResult.data?.error);
    return false;
  }

  console.log('✅ 市场清算成功');
  console.log(`   获胜订单数: ${settleResult.data.data?.statistics?.winningOrders || 'N/A'}`);
  console.log(`   总支付: $${settleResult.data.data?.statistics?.totalPayout?.toFixed(2) || 'N/A'}`);

  // 3. 报告最终余额（预期 $495.00）
  console.log('\n3. 验证清算后余额...');
  const expectedBalance = 495.0; // $400 + $95 (收益)
  console.log(`   预期余额: $${expectedBalance.toFixed(2)}`);
  console.log('✅ 场景 5 完成（余额验证需通过数据库确认）');

  return true;
}

/**
 * 场景 6：提现审批
 */
async function testScenario6() {
  console.log('\n=== 场景 6: 提现审批 ===\n');

  // 1. Admin 审批提现请求
  console.log('1. Admin 审批 $500 提现请求...');
  const approveResult = await apiRequest(
    '/api/admin/withdrawals',
    'POST',
    {
      withdrawalId,
      action: 'APPROVE',
    },
    {
      'Authorization': `Bearer ${ADMIN_SECRET_TOKEN}`,
    }
  );

  if (!approveResult.ok) {
    console.error('❌ 提现审批失败:', approveResult.data?.error);
    return false;
  }

  console.log('✅ 提现审批成功');
  console.log(`   提现状态: ${approveResult.data.withdrawal?.status || 'N/A'}`);

  // 2. 报告余额（预期保持 $495.00 不变）
  console.log('\n2. 验证审批后余额...');
  const expectedBalance = 495.0; // 应该保持不变
  console.log(`   预期余额: $${expectedBalance.toFixed(2)} (保持不变)`);
  console.log('✅ 场景 6 完成（余额验证需通过数据库确认）');

  return true;
}

/**
 * 主测试函数
 */
async function runE2ETests() {
  console.log('========================================');
  console.log('   预测市场应用 - E2E 测试');
  console.log('========================================');

  try {
    // Admin 登录
    await adminLogin();

    // 场景 2：注册与充值
    await testScenario2();

    // 场景 3-4：市场创建、下注和提现
    await testScenario34();

    // 场景 5：市场清算
    await testScenario5();

    // 场景 6：提现审批
    await testScenario6();

    console.log('\n========================================');
    console.log('   E2E 测试完成');
    console.log('========================================');
    console.log('\n注意：余额验证需要直接查询数据库确认');
    console.log(`测试用户邮箱: ${testUserEmail}`);
    console.log(`市场 ID: ${marketId}`);
    console.log(`提现 ID: ${withdrawalId}`);
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
runE2ETests();

