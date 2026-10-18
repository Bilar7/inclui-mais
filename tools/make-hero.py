# Gera as imagens de abertura com os avatares da Inclui+ (pessoas surdas, cegas e que não falam), alternando branco e negro:
#   assets/brand/hero.jpg   — horizontal (computador)
#   assets/brand/hero-m.jpg — vertical (telemóvel), com as quatro pessoas visíveis
# Uso: python3 -m http.server 8772 (na raiz) e depois  python3 tools/make-hero.py
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageFilter, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEOPLE = [  # da esquerda para a direita: branco, negra, branca, negro
  ({"name":"Tomás","gender":"m","model":"real-m","age":"adulto","body":"media","outfit":"atendimento"}, {"sign":"ajuda","wait":900,"noAcc":True}),
  ({"name":"Amina","gender":"f","model":"std-f","skin":"escuro","age":"jovem","body":"media","outfit":"casual","hair":"preto","hairStyle":"trancas"}, {"sign":"olá","wait":1100}),
  ({"name":"Sara","gender":"f","model":"real-f","age":"adulto","body":"media","outfit":"casual"}, {"sign":"obrigado","wait":900,"mood":"happy"}),
  ({"name":"Bilar","gender":"m","model":"std-m","skin":"muito-escuro","age":"adulto","body":"media","outfit":"executivo","hair":"preto","hairStyle":"curto","beard":True}, {"glasses":True,"cane":"R","wait":500,"noAcc":True}),
]
# (x do centro, topo da pessoa, altura) em fração da imagem
WIDE = [(0.20, 0.45, 0.944), (0.40, 0.45, 0.944), (0.60, 0.45, 0.944), (0.80, 0.45, 0.98)]
TALL = [(0.19, 0.445, 0.52), (0.40, 0.40, 0.5), (0.61, 0.40, 0.5), (0.81, 0.445, 0.53)]
ORDER_TALL = [1, 2, 0, 3]  # pessoas de trás primeiro

def backdrop(W, H):
  bg = Image.new("RGB", (W, H)); d = ImageDraw.Draw(bg)
  for y in range(H):
    t = y / H; d.line([(0, y), (W, y)], fill=(int(214 - 60 * t), int(200 - 50 * t), int(184 - 40 * t)))
  for cx, cy, r, c in [(0.16, 0.2, 0.15, (255, 226, 180)), (0.85, 0.18, 0.17, (255, 240, 214)), (0.5, 0.1, 0.12, (250, 214, 160)), (0.69, 0.42, 0.1, (120, 170, 168)), (0.19, 0.51, 0.12, (160, 120, 96))]:
    R = r * max(W, H); d.ellipse([cx * W - R, cy * H - R, cx * W + R, cy * H + R], fill=c)
  d.rectangle([0, int(H * 0.82), W, H], fill=(120, 96, 80))
  return bg.filter(ImageFilter.GaussianBlur(max(W, H) // 28))

def compose(cut, W, H, layout, order, name):
  bg = backdrop(W, H)
  for i in order:
    im = cut[i]; x, top, hf = layout[i]
    h = int(H * hf); w = int(im.width * h / im.height); im = im.resize((w, h), Image.LANCZOS)
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.split()[3].point(lambda a: int(a * 0.35)))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); bg.paste((20, 20, 20), (int(x * W - w / 2) + 18, int(H * top) + 10), sh)
    bg.paste(im, (int(x * W - w / 2), int(H * top)), im)
  out = os.path.join(ROOT, "assets/brand", name)
  bg.save(out, quality=80, optimize=True, progressive=True); print("ok", out, os.path.getsize(out))

async def main(debug):
  async with async_playwright() as p:
    b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    pg = await b.new_page(viewport={"width":600,"height":900}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto("http://localhost:8772/tools/hero-lab.html"); await pg.wait_for_function("window.ready===true", timeout=60000)
    cut = []
    for look, opt in PEOPLE:
      await pg.evaluate("([l,o])=>go(l,o)", [look, opt]); await pg.wait_for_timeout(opt.get("wait", 600))
      await pg.locator("#c").screenshot(path="/tmp/hero_p.png", omit_background=True)
      cut.append(Image.open("/tmp/hero_p.png").convert("RGBA"))
    if errs: print(errs[:4])
    await b.close()
  compose(cut, 2000, 1250, WIDE, [0, 1, 2, 3], "hero.jpg")
  compose(cut, 900, 1950, TALL, ORDER_TALL, "hero-m.jpg")
asyncio.run(main("-d" in sys.argv))
