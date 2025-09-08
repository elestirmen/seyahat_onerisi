#!/usr/bin/env python3

def count_braces(filename):
    """Count opening and closing braces in JavaScript file"""
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    opening = content.count('{')
    closing = content.count('}')

    print(f"Opening braces: {opening}")
    print(f"Closing braces: {closing}")
    print(f"Difference: {opening - closing}")

    if opening != closing:
        print(f"⚠️  Mismatch detected!")

        # Find potential unmatched braces
        stack = []
        lines = content.split('\n')

        for i, line in enumerate(lines, 1):
            for char in line:
                if char == '{':
                    stack.append((i, line.strip()))
                elif char == '}':
                    if stack:
                        stack.pop()
                    else:
                        print(f"❌ Extra closing brace at line {i}: {line.strip()}")

        if stack:
            print(f"❌ Unmatched opening braces:")
            for line_num, line_content in stack[-5:]:  # Show last 5
                print(f"  Line {line_num}: {line_content}")

    return opening == closing

if __name__ == "__main__":
    filename = "/opt/rehber/seyahat_onerisi/static/js/poi_recommendation_system.js"
    is_valid = count_braces(filename)

    if is_valid:
        print("✅ JavaScript syntax appears valid")
    else:
        print("❌ JavaScript syntax error detected")
