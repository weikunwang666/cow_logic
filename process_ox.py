#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键处理牛马职场素材：
1. 自动扣除 JPG 白底并标准化为 512x512 透明 PNG
2. 自动生成贴合人体曲线的多圆碰撞体 parts.js（彻底消除空位）
"""
import os
import math
import json
import numpy as np
from PIL import Image

SRC_DIR = "images"
OUT_IMG_DIR = os.path.join("images", "processed")
CANVAS = 512
FILL = 0.92
SCALE = CANVAS * FILL / 2.0

def process_image(idx):
    src_path = os.path.join(SRC_DIR, f"level{idx}.jpg")
    if not os.path.exists(src_path):
        src_path = f"level{idx}.jpg"
    
    im = Image.open(src_path).convert("RGB")
    arr = np.asarray(im)
    
    # 抠白底：RGB 均大于 225 的判定为背景
    is_bg = (arr[:, :, 0] > 225) & (arr[:, :, 1] > 225) & (arr[:, :, 2] > 225)
    
    # 四周边界噪点裁切保护 (2% 内缩)
    h, w, _ = arr.shape
    is_bg[:int(h * 0.02), :] = True
    is_bg[-int(h * 0.02):, :] = True
    is_bg[:, :int(w * 0.02)] = True
    is_bg[:, -int(w * 0.02):] = True
    
    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr, alpha])
    im_rgba = Image.fromarray(rgba, "RGBA")
    
    # 获取紧凑包围盒并居中缩放
    bbox = im_rgba.split()[3].getbbox()
    if bbox is None:
        bbox = (0, 0, w, h)
    
    subject = im_rgba.crop(bbox)
    sw, sh = subject.size
    target = int(round(CANVAS * FILL))
    k = target / max(sw, sh)
    nw, nh = max(1, int(round(sw * k))), max(1, int(round(sh * k)))
    
    subject = subject.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(subject, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    
    os.makedirs(OUT_IMG_DIR, exist_ok=True)
    out_png = os.path.join(OUT_IMG_DIR, f"level{idx}.png")
    canvas.save(out_png, "PNG")
    return canvas

def euclid_dt(mask):
    INF = 1e9
    S2 = 1.41421356
    d = np.where(mask, INF, 0.0).astype(np.float32)
    h, w = mask.shape
    idx = np.arange(w, dtype=np.float32)

    def scan_fwd(row):
        tmp = np.minimum.accumulate(row - idx)
        return np.minimum(row, tmp + idx)

    def scan_bwd(row):
        tmp = np.minimum.accumulate((row + idx)[::-1])[::-1]
        return np.minimum(row, tmp - idx)

    for y in range(h):
        row = d[y]
        if y > 0:
            prev = d[y - 1]
            np.minimum(row, prev + 1.0, out=row)
            np.minimum(row[1:], prev[:-1] + S2, out=row[1:])
            np.minimum(row[:-1], prev[1:] + S2, out=row[:-1])
        d[y] = scan_fwd(row)
    for y in range(h - 1, -1, -1):
        row = d[y]
        if y < h - 1:
            nxt = d[y + 1]
            np.minimum(row, nxt + 1.0, out=row)
            np.minimum(row[1:], nxt[:-1] + S2, out=row[1:])
            np.minimum(row[:-1], nxt[1:] + S2, out=row[:-1])
        d[y] = scan_bwd(row)
    return d

def fit_circles(mask, max_parts=6):
    dt = euclid_dt(mask)
    circles = []
    covered = np.zeros(mask.shape, bool)
    total = int(mask.sum())
    placed = 0

    while len(circles) < max_parts and placed < 0.95 * total:
        gap = mask & ~covered
        if not gap.any():
            break
        gap_dt = np.where(gap, dt, 0)
        iy, ix = np.unravel_index(np.argmax(gap_dt), gap_dt.shape)
        r = float(dt[iy, ix])
        if r < 0.04 * SCALE:
            break
        circles.append([float(ix), float(iy), r])
        
        y0, y1 = max(0, int(iy - r)), min(mask.shape[0], int(iy + r) + 2)
        x0, x1 = max(0, int(ix - r)), min(mask.shape[1], int(ix + r) + 2)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        disk = ((xx - ix)**2 + (yy - iy)**2) <= r * r
        sub = covered[y0:y1, x0:x1]
        placed += int((disk & ~sub).sum())
        sub |= disk

    parts = []
    rb = 0.0
    for cx, cy, r in circles:
        ox = (cx - CANVAS / 2) / SCALE
        oy = (cy - CANVAS / 2) / SCALE
        s = r / SCALE
        parts.append([round(ox, 3), round(oy, 3), round(s, 3)])
        rb = max(rb, math.hypot(ox, oy) + s)

    return {"parts": parts, "rb": round(rb, 3)}

def main():
    print("🚀 开始处理 10 级牛马角色...")
    shapes_data = []
    for i in range(10):
        print(f"正在处理第 {i} 级小人...")
        im = process_image(i)
        alpha = np.asarray(im)[:, :, 3]
        mask = alpha > 128
        shape = fit_circles(mask)
        shapes_data.append(shape)

    js_content = "/* 自动生成：10 级小人多圆贴身碰撞轮廓 */\n"
    js_content += "window.SUIKA_PARTS = " + json.dumps(shapes_data, separators=(",", ":")) + ";\n"

    with open("parts.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    print("\n✅ 处理完成！已生成 parts.js 以及 images/processed/*.png 透明图！")

if __name__ == "__main__":
    main()