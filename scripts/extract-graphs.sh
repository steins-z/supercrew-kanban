#!/bin/bash

# 提取 Markdown 文档中的 Graphviz 图表并转换为 PNG
# 用法: ./extract-graphs.sh <input.md> <output_dir>

INPUT_FILE="$1"
OUTPUT_DIR="$2"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_DIR" ]; then
    echo "用法: $0 <input.md> <output_dir>"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 提取图表的函数
extract_graph() {
    local start_line=$1
    local graph_name=$2
    local output_file="$OUTPUT_DIR/${graph_name}.png"

    # 提取 digraph 代码块 (从 digraph 开始到第一个匹配的 } 结束)
    sed -n "${start_line},/^}$/p" "$INPUT_FILE" > "/tmp/${graph_name}.dot"

    # 转换为 PNG
    if dot -Tpng "/tmp/${graph_name}.dot" -o "$output_file" 2>/dev/null; then
        echo "✅ 生成: $output_file"
        rm "/tmp/${graph_name}.dot"
        return 0
    else
        echo "❌ 失败: $graph_name"
        return 1
    fi
}

# 查找所有 digraph 并提取
echo "开始提取图表..."
grep -n 'digraph ' "$INPUT_FILE" | while IFS=: read -r line_num line_content; do
    # 提取图表名称
    graph_name=$(echo "$line_content" | sed -n 's/digraph \([a-zA-Z_]*\) {/\1/p')

    if [ -n "$graph_name" ]; then
        extract_graph "$line_num" "$graph_name"
    fi
done

echo ""
echo "所有图表已保存到: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l | xargs echo "总计生成图片:"
