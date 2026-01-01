#!/usr/bin/env node

/**
 * 批量移除 console.log 调试日志
 * 保留 console.error 和 console.warn（用于错误追踪和警告）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 需要处理的目录
const directories = ['app', 'components', 'lib'];

// 统计信息
let totalRemoved = 0;
let filesProcessed = 0;
let filesModified = 0;

/**
 * 递归查找所有 .ts 和 .tsx 文件
 */
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 .next
      if (file !== 'node_modules' && file !== '.next') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 移除文件中的 console.log
 */
function removeConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let removedCount = 0;
  
  // 匹配 console.log 的各种情况
  // 1. 单独一行的 console.log(...);
  // 2. 在代码中间的 console.log(...);
  // 3. console.log 前后可能有注释
  
  // 使用正则表达式匹配并移除 console.log 语句
  // 匹配模式：console.log(...); 包括多行的情况
  const consoleLogPattern = /^\s*console\.log\([^;]*\);\s*$/gm;
  const multiLinePattern = /console\.log\([^;)]*\);?/g;
  
  // 先处理单独一行的 console.log
  content = content.replace(consoleLogPattern, '');
  
  // 处理在代码中间的 console.log（但保留在同一行的情况）
  // 需要小心处理，避免破坏代码结构
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否包含 console.log（但不在注释中）
    if (line.includes('console.log') && !line.trim().startsWith('//')) {
      // 检查是否是完整的 console.log 语句
      if (line.trim().endsWith(';') && line.includes('console.log(')) {
        // 尝试移除 console.log，但要小心处理
        // 如果整行都是 console.log，则移除整行
        const trimmed = line.trim();
        if (trimmed.startsWith('console.log(') && trimmed.endsWith(';')) {
          removedCount++;
          continue; // 跳过这一行
        }
        
        // 如果 console.log 在行的中间或末尾
        // 使用更保守的方法：只移除完整的 console.log(...); 语句
        const beforeLog = line.substring(0, line.indexOf('console.log'));
        const afterLog = line.substring(line.indexOf('console.log'));
        
        // 尝试找到 console.log(...); 的结束位置
        let logStart = afterLog.indexOf('console.log(');
        if (logStart !== -1) {
          let depth = 0;
          let logEnd = logStart + 'console.log('.length;
          let inString = false;
          let stringChar = '';
          
          for (let j = logEnd; j < afterLog.length; j++) {
            const char = afterLog[j];
            
            if (!inString && (char === '"' || char === "'" || char === '`')) {
              inString = true;
              stringChar = char;
            } else if (inString && char === stringChar && afterLog[j - 1] !== '\\') {
              inString = false;
            } else if (!inString) {
              if (char === '(') depth++;
              if (char === ')') {
                if (depth === 0) {
                  logEnd = j + 1;
                  break;
                }
                depth--;
              }
            }
          }
          
          // 检查后面是否有分号
          if (afterLog[logEnd] === ';') {
            const newLine = beforeLog + afterLog.substring(logEnd + 1);
            removedCount++;
            newLines.push(newLine.trim() ? newLine : '');
            continue;
          }
        }
      }
    }
    
    newLines.push(line);
  }
  
  content = newLines.join('\n');
  
  // 清理多余的空行（连续 3 个或更多空行变为 2 个）
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    totalRemoved += removedCount || 1;
  }
  
  filesProcessed++;
}

// 主函数
function main() {
  console.log('🚀 开始批量移除 console.log...\n');
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  目录不存在: ${dir}`);
      return;
    }
    
    console.log(`📁 处理目录: ${dir}`);
    const files = findFiles(dir);
    console.log(`   找到 ${files.length} 个文件\n`);
    
    files.forEach(file => {
      removeConsoleLogs(file);
    });
  });
  
  console.log('\n✅ 处理完成！');
  console.log(`   处理文件数: ${filesProcessed}`);
  console.log(`   修改文件数: ${filesModified}`);
  console.log(`   移除的 console.log 数量: ${totalRemoved}`);
}

main();

