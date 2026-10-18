# Gera o emblema redondo (assets/brand/badge.png) e os ícones da aplicação a partir do logótipo original (fundo preto).
# Uso: python3 tools/make-badge.py caminho/do/logotipo.png
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import sys
SRC=sys.argv[1] if len(sys.argv) > 1 else "tools/logo-original.jpg"
dark=Image.open(SRC).convert("RGB")
def key_black(im, lo=34):
  a=np.asarray(im).astype(np.float32); m=a.max(axis=2)
  alpha=np.clip((m-lo)/140.0,0,1); rgb=np.clip(a/np.maximum(alpha[...,None],1e-3),0,255); rgb[alpha<0.02]=0
  H,W=alpha.shape; y,x=np.mgrid[0:H,0:W]; edge=np.minimum.reduce([x,y,W-1-x,H-1-y]).astype(np.float32)
  alpha*=np.clip(edge/30.0,0,1)  # bordas suaves: nada de recorte retangular
  return Image.fromarray(np.dstack([rgb,alpha*255]).astype(np.uint8),'RGBA')
emb=key_black(dark.crop((150,90,1105,734)))
bb=emb.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox(); emb=emb.crop((bb[0]-20,bb[1]-20,bb[2]+20,bb[3]+20))
def badge(S, full=False, pad=0.12):
  y,x=np.mgrid[0:S,0:S]; r=np.hypot(x-S*0.43,y-S*0.35)/(S*0.75)
  c0=np.array([38,82,146]); c1=np.array([12,30,70]); t=np.clip(r,0,1)[...,None]
  bg=Image.fromarray((c0*(1-t)+c1*t).astype(np.uint8),'RGB').convert('RGBA')
  if not full:
    m=Image.new('L',(S*4,S*4),0); ImageDraw.Draw(m).ellipse([0,0,S*4-1,S*4-1],fill=255); bg.putalpha(m.resize((S,S),Image.LANCZOS))
  w=int(S*(1-2*pad)); e=emb.copy(); e.thumbnail((w,w),Image.LANCZOS)
  a=bg.getchannel('A'); bg.alpha_composite(e,((S-e.width)//2,(S-e.height)//2)); bg.putalpha(a)
  return bg
badge(256).save("assets/brand/badge.png",optimize=True)
badge(64,pad=0.08).save("assets/icons/favicon.png",optimize=True)
badge(512,True,0.14).convert('RGB').save("assets/icons/icon-512.png",optimize=True)
badge(192,True,0.14).convert('RGB').save("assets/icons/icon-192.png",optimize=True)
badge(512,True,0.22).convert('RGB').save("assets/icons/icon-maskable.png",optimize=True)
badge(180,True,0.14).convert('RGB').save("assets/icons/apple-touch-icon.png",optimize=True)



