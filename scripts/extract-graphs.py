#!/usr/bin/env python3
"""
提取 Markdown 文档中的 Graphviz 图表并转换为 PNG
"""

import re
import subprocess
import sys
from pathlib import Path

def extract_graphs(input_file, output_dir):
    """提取所有 digraph 并保存为 PNG"""

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 匹配所有 digraph 块
    pattern = r'```dot\n(digraph\s+\w+\s*\{.*?\n\})\n```'
    matches = re.findall(pattern, content, re.DOTALL)

    if not matches:
        # 尝试不带 ```dot 标记的格式
        pattern = r'(digraph\s+(\w+)\s*\{[^}]*\})'
        matches = re.findall(pattern, content, re.DOTALL)
        matches = [(m[0], m[1]) for m in matches]
    else:
        # 提取图表名称
        matches_with_names = []
        for match in matches:
            name_match = re.search(r'digraph\s+(\w+)', match)
            if name_match:
                matches_with_names.append((match, name_match.group(1)))
        matches = matches_with_names

    print(f"找到 {len(matches)} 个图表")

    generated = []
    for i, match in enumerate(matches):
        if isinstance(match, tuple):
            dot_code, graph_name = match
        else:
            dot_code = match
            graph_name = f"graph_{i+1}"

        # 保存 .dot 文件
        dot_file = output_dir / f"{graph_name}.dot"
        png_file = output_dir / f"{graph_name}.png"

        with open(dot_file, 'w', encoding='utf-8') as f:
            f.write(dot_code)

        # 转换为 PNG
        try:
            result = subprocess.run(
                ['dot', '-Tpng', str(dot_file), '-o', str(png_file)],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"✅ {graph_name}.png")
            generated.append(png_file)
            # dot_file.unlink()  # 删除临时 .dot 文件
        except subprocess.CalledProcessError as e:
            print(f"❌ {graph_name}: {e.stderr}")

    return generated

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("用法: python3 extract-graphs.py <input.md> <output_dir>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_dir = sys.argv[2]

    generated = extract_graphs(input_file, output_dir)

    print(f"\n✅ 成功生成 {len(generated)} 个图片")
    print(f"📁 保存位置: {output_dir}")
