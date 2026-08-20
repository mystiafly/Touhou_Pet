import json
import os

def convert_file(input_path, output_path):
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    parameters = []

    # 情况1: Expression.json
    if "Parameters" in data:
        for param in data["Parameters"]:
            if "Segments" in param:
                value = param["Segments"][-1] if param["Segments"] else 0
                parameters.append({"Id": param["Id"], "Value": value, "Blend": "Override"})
            else:
                parameters.append({
                    "Id": param["Id"],
                    "Value": param.get("Value", 0),
                    "Blend": "Override"
                })

    # 情况2: Motion3.json
    elif "Curves" in data:
        for curve in data["Curves"]:
            if "Segments" in curve:
                value = curve["Segments"][-1] if curve["Segments"] else 0
                parameters.append({"Id": curve["Id"], "Value": value, "Blend": "Override"})

    # 最终输出格式：Expression
    converted = {
        "Type": "Live2D Expression",
        "Parameters": parameters
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    folder = os.path.dirname(os.path.abspath(__file__))

    for filename in os.listdir(folder):
        if filename.endswith(".motion3.json") and not filename.endswith("e.exp3.json"):
            input_path = os.path.join(folder, filename)
            output_path = os.path.join(folder, filename.replace(".motion3.json", "e.exp3.json"))
            try:
                convert_file(input_path, output_path)

                # ✅ 安全检查：文件存在且大小大于 0
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    os.remove(input_path)
                    print(f"✅ 已转换并删除原文件: {filename} -> {os.path.basename(output_path)}")
                else:
                    print(f"⚠️ 输出文件无效，未删除源文件: {filename}")

            except Exception as e:
                print(f"❌ 转换失败 {filename}: {e}")
