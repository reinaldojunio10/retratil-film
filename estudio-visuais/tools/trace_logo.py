"""Vetoriza a logo (PNG/WebP com alfa) em contornos para extrusão 3D.

Uso: PYTHONPATH=<pasta com contourpy> python3 -I trace_logo.py <logo> <saida.json>

Separa o branco (letras) do laranja (&) pela cor, extrai contornos com
subpixel (nível 0,5 do campo de cobertura) e simplifica com Douglas-Peucker.
Saída: polígonos com furos, em pixels da imagem original (y para baixo).
"""
import json
import sys

import contourpy
import numpy as np
from PIL import Image, ImageFilter

TOL = 0.30  # tolerância da simplificação, em pixels


def dp(points, tol):
    """Douglas-Peucker iterativo em um anel fechado."""
    pts = np.asarray(points, float)
    if len(pts) < 4:
        return pts
    keep = np.zeros(len(pts), bool)
    # âncoras: ponto 0 e o mais distante dele
    far = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    keep[0] = keep[far] = True
    stack = [(0, far), (far, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = pts[i], pts[j]
        seg = b - a
        n = np.hypot(*seg)
        mid = pts[i + 1:j]
        d = np.hypot(*(mid - a).T) if n == 0 else np.abs(seg[0] * (mid[:, 1] - a[1]) - seg[1] * (mid[:, 0] - a[0])) / n
        k = int(np.argmax(d))
        if d[k] > tol:
            m = i + 1 + k
            keep[m] = True
            stack += [(i, m), (m, j)]
    return pts[keep]


def trace(field, pad):
    gen = contourpy.contour_generator(
        z=field, fill_type=contourpy.FillType.OuterOffset, line_type=contourpy.LineType.Separate
    )
    points, offsets = gen.filled(0.5, 1.5)
    polys = []
    for pp, oo in zip(points, offsets):
        rings = []
        for a, b in zip(oo[:-1], oo[1:]):
            r = pp[a:b]
            if np.allclose(r[0], r[-1]):
                r = r[:-1]
            r = dp(r - pad, TOL)
            if len(r) >= 3:
                rings.append(np.round(r, 2).tolist())
        if rings:
            polys.append({"outer": rings[0], "holes": rings[1:]})
    return polys


def main(src, dst):
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(float)
    alpha = a[..., 3] / 255.0
    orange_w = np.clip((a[..., 0] - a[..., 2]) / 220.0, 0, 1)
    fields = {"white": alpha * (1 - orange_w), "orange": alpha * orange_w}
    pad = 3
    out = {"width": im.width, "height": im.height, "groups": {}}
    for name, f in fields.items():
        f = np.pad(f, pad)
        f = np.asarray(Image.fromarray((f * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
        polys = trace(f, pad)
        polys = [p for p in polys if abs(_area(p["outer"])) > 40]  # descarta ruído
        out["groups"][name] = polys
        print(name, "polígonos:", len(polys), "pontos:", sum(len(p["outer"]) + sum(map(len, p["holes"])) for p in polys))
    json.dump(out, open(dst, "w"))


def _area(r):
    r = np.asarray(r)
    return 0.5 * np.sum(r[:, 0] * np.roll(r[:, 1], -1) - np.roll(r[:, 0], -1) * r[:, 1])


if __name__ == "__main__":
    main(*sys.argv[1:3])
