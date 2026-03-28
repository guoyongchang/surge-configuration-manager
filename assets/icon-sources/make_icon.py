import math
from PIL import Image, ImageDraw

def draw_gear(size=300):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    outer_r = size * 0.46
    inner_r = size * 0.32
    hole_r  = size * 0.18
    teeth   = 8
    outline = max(2, int(size * 0.048))

    fill_color    = (45, 62, 80, 255)
    outline_color = (10, 10, 10, 255)

    def gear_points(cx, cy, outer_r, inner_r, teeth):
        points = []
        for i in range(teeth * 2):
            angle = math.radians(i * 360 / (teeth * 2) - 90)
            r = outer_r if i % 2 == 0 else inner_r
            points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
        return points

    pts = gear_points(cx, cy, outer_r, inner_r, teeth)
    outline_pts = gear_points(cx, cy, outer_r + outline, inner_r - outline * 0.3, teeth)

    draw.polygon(outline_pts, fill=outline_color)
    draw.polygon(pts, fill=fill_color)

    draw.ellipse([cx - hole_r - outline, cy - hole_r - outline,
                  cx + hole_r + outline, cy + hole_r + outline], fill=outline_color)
    draw.ellipse([cx - hole_r, cy - hole_r,
                  cx + hole_r, cy + hole_r], fill=(0, 0, 0, 0))

    return img


BASE = "/Users/guo/Work/workspaces/surge-workspace/worktrees/surge-init/projects/surge-configuration-manager"

base = Image.open(f"{BASE}/surge-app-icon.png").convert("RGBA")
W, H = base.size

gear_size = int(W * 0.38)
gear = draw_gear(gear_size)

margin = int(W * 0.04)
x = W - gear_size - margin
y = H - gear_size - margin

result = base.copy()
result.paste(gear, (x, y), gear)
result.save(f"{BASE}/scm-icon.png")
print(f"Saved scm-icon.png ({W}x{H})")
