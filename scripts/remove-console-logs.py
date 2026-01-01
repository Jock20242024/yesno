#!/usr/bin/env python3
"""
批量移除 console.log 调试日志
保留 console.error 和 console.warn
"""

import os
import re
import sys
from pathlib import Path

# 需要处理的目录
DIRECTORIES = ['app', 'components', 'lib']

# 统计信息
total_removed = 0
files_processed = 0
files_modified = 0

def find_files(directories):
    """递归查找所有 .ts 和 .tsx 文件"""
    files = []
    for directory in directories:
        if not os.path.exists(directory):
            print(f"⚠️  目录不存在: {directory}")
            continue
        
        for root, dirs, filenames in os.walk(directory):
            # 跳过 node_modules 和 .next
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.next']]
            
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    files.append(os.path.join(root, filename))
    
    return files

def remove_console_logs(file_path):
    """移除文件中的 console.log"""
    global total_removed, files_processed, files_modified
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        removed_count = 0
        
        # 按行处理
        lines = content.split('\n')
        new_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            original_line = line
            
            # 跳过注释行（但保留）
            if line.strip().startswith('//'):
                new_lines.append(line)
                i += 1
                continue
            
            # 检查是否包含 console.log
            if 'console.log(' in line:
                # 检查是否是独立的 console.log 语句
                # 匹配：前面只有空白，后面是 console.log(...);
                stripped = line.strip()
                
                # 情况1：整行就是 console.log(...);
                if re.match(r'^\s*console\.log\([^;]*\);\s*$', line):
                    removed_count += 1
                    i += 1
                    continue  # 跳过这一行
                
                # 情况2：console.log(...); 在行尾，前面有其他代码（通常是调试用的）
                # 例如：someCode; console.log(...);
                # 这种情况我们也要移除 console.log 部分
                if re.search(r'console\.log\([^;)]*\);\s*$', line):
                    # 移除 console.log 部分
                    line = re.sub(r'[;\s]*console\.log\([^;)]*\);\s*$', '', line)
                    removed_count += 1
                    if line.strip():  # 如果还有内容，保留
                        new_lines.append(line.rstrip())
                    i += 1
                    continue
                
                # 情况3：console.log 在多行中（复杂情况，暂时保留原样）
                # 这种情况比较复杂，需要处理括号匹配
                # 为了安全，暂时跳过
                new_lines.append(line)
                i += 1
                continue
            
            new_lines.append(line)
            i += 1
        
        # 重新组合内容
        new_content = '\n'.join(new_lines)
        
        # 清理多余的空行（连续3个或更多空行变为2个）
        new_content = re.sub(r'\n{3,}', '\n\n', new_content)
        
        # 如果内容有变化，写回文件
        if new_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            files_modified += 1
            total_removed += removed_count
        
        files_processed += 1
        
    except Exception as e:
        print(f"❌ 处理 {file_path} 时出错: {e}", file=sys.stderr)

def main():
    """主函数"""
    print('🚀 开始批量移除 console.log...\n')
    
    files = find_files(DIRECTORIES)
    print(f'📁 找到 {len(files)} 个文件\n')
    
    for file_path in files:
        remove_console_logs(file_path)
    
    print('\n✅ 处理完成！')
    print(f'   处理文件数: {files_processed}')
    print(f'   修改文件数: {files_modified}')
    print(f'   移除的 console.log 数量: {total_removed}')

if __name__ == '__main__':
    main()

