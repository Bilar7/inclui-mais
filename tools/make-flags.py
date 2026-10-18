# Gera js/core/flags.js: bandeiras pequenas (PNG 4:3 em base64) a partir do flag-icons (MIT, github.com/lipis/flag-icons).
# Imagens em vez de emoji: no Windows os emoji de bandeira aparecem como letras ("MZ").
# Uso: python3 tools/make-flags.py <pasta flag-icons/flags/4x3>
import sys, base64, asyncio, pathlib
from playwright.async_api import async_playwright
SRC = pathlib.Path(sys.argv[1]); CODES = ['mz', 'br', 'pt', 'us', 'es']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 64, 'height': 48})
        out = {}
        for c in CODES:
            await pg.set_content(f'<body style="margin:0">{(SRC / (c + ".svg")).read_text().replace("<svg", "<svg width=64 height=48", 1)}</body>')
            out[c] = 'data:image/png;base64,' + base64.b64encode(await pg.screenshot(type='png')).decode()
        await b.close()
    js = '// Bandeiras dos países das línguas (flag-icons, MIT). Gerado por tools/make-flags.py.\nexport const FLAGS = {\n'
    js += ''.join(f"  {c}: '{u}',\n" for c, u in out.items()) + '};\n'
    js += "/** Bandeira em imagem (os emoji de bandeira não aparecem no Windows). */\nexport const flag = (c) => (FLAGS[c] ? `<img class=\"flag\" src=\"${FLAGS[c]}\" alt=\"\" width=\"24\" height=\"18\">` : '');\n"
    pathlib.Path(__file__).resolve().parent.parent.joinpath('js/core/flags.js').write_text(js)
    print({c: len(u) for c, u in out.items()})
asyncio.run(main())
