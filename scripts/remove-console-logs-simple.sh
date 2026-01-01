#!/bin/bash

# 批量移除 console.log，保留 console.error 和 console.warn

echo "🔍 开始移除 console.log..."

# 查找所有包含 console.log 的文件
files=$(find app components lib -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/.next/*")

total_removed=0
files_modified=0

for file in $files; do
  # 检查文件是否包含 console.log（排除注释）
  if grep -q "console\.log" "$file" && ! grep -q "^\s*//.*console\.log" "$file"; then
    # 使用 sed 移除包含 console.log 的行（但保留有 console.error 或 console.warn 的行）
    # 只移除整行都是 console.log 的情况
    before=$(grep -c "console\.log" "$file" 2>/dev/null || echo "0")
    
    # 使用更安全的方法：使用 Perl 或 Python
    python3 << PYEOF
import re
import sys

file_path = "$file"
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    removed = 0
    
    for line in lines:
        # 如果是注释行，保留
        if line.strip().startswith('//'):
            new_lines.append(line)
        # 如果整行只是 console.log(...); 或前面只有空白，移除
        elif re.match(r'^\s*console\.log\(.*?\);\s*$', line):
            removed += 1
            # 不添加这一行
        # 如果行中包含 console.log 但还有其他代码，保留（暂时不处理复杂情况）
        elif 'console.log(' in line and not line.strip().startswith('//'):
            # 尝试移除 console.log 部分（保守处理）
            # 只处理简单的 console.log(...); 情况
            if re.search(r'console\.log\([^)]*\);\s*$', line):
                line = re.sub(r'\s*console\.log\([^)]*\);\s*$', '', line)
                if line.strip():  # 如果移除后还有内容，保留
                    new_lines.append(line)
                removed += 1
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    if removed > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"✅ {file_path}: 移除了 {removed} 个 console.log")
        sys.exit(0)  # 标记为已修改
    else:
        sys.exit(1)  # 未修改
except Exception as e:
    print(f"❌ 处理 {file_path} 时出错: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
    
    if [ $? -eq 0 ]; then
        files_modified=$((files_modified + 1))
        total_removed=$((total_removed + before))
    fi
  fi
done

echo ""
echo "✅ 完成！"
echo "   修改文件数: $files_modified"
echo "   移除的 console.log 数量: $total_removed"
