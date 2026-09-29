import subprocess

print("[*] Testing FFmpeg on your system...")

try:
    # Ask FFmpeg for its version through Python
    result = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    first_line = result.stdout.split("\n")[0]
    print(f"[SUCCESS] FFmpeg is working!\nVersion info: {first_line}")
except FileNotFoundError:
    print("[ERROR] FFmpeg is not found in your system PATH yet.")