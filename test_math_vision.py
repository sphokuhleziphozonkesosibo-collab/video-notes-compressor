import os
from dotenv import load_dotenv
from PIL import Image, ImageDraw
from google import genai

# 1. Load the Gemini API Key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("[ERROR] GEMINI_API_KEY not found in .env file!")
    exit(1)

client = genai.Client(api_key=api_key)

# 2. Create the simulated Whiteboard image
IMAGE_FILE = "whiteboard_sample.png"
print(f"[*] Generating whiteboard image: '{IMAGE_FILE}'...")

img = Image.new("RGB", (800, 300), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

math_problem_text = "Solve for x:\n2x^2 + 5x + 3 = 0"
draw.text((50, 100), math_problem_text, fill=(20, 20, 120))
img.save(IMAGE_FILE)

print("[*] Sending whiteboard image to Gemini 2.5 Flash Vision...")

# 3. Prompt for University Mathematics
prompt = """
You are an expert university mathematics assistant analyzing a lecture whiteboard.

Look at the math problem in this image and produce structured study notes:
1. 🧠 **Method Detected**: What technique should the student use to solve this? (e.g., Factorization, Quadratic Formula, Substitution).
2. 📐 **Problem in LaTeX**: Write the initial equation cleanly in LaTeX format (use $ signs).
3. 🔢 **Step-by-Step Working**: Provide every algebraic step clearly with explanations.
4. ✅ **Final Answer**: The final roots/solution.
"""

response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=[img, prompt]
)

print("\n" + "=" * 50)
print("             MATHS VISION ENGINE OUTPUT")
print("=" * 50 + "\n")
print(response.text)