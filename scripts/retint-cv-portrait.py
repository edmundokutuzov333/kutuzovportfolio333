#!/usr/bin/env python3
"""Lossless-subject CV backdrop retint, sourced only from the About portrait.

The face, clothing, hair, and all non-green pixels are carried forward without
any photographic reinterpretation. This is a colour-key operation on the teal
backdrop, not AI face synthesis or a change in identity.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"public"/"edmundo-kutuzov-foto.jpg"
TARGET=ROOT/"public"/"edmundo-kutuzov-cv-mineral.png"

def main():
    with Image.open(SOURCE) as im:
        original=np.asarray(im.convert("RGB"),dtype=np.uint8)
    p=original.astype(np.float32)
    red,green,blue=p[:,:,0],p[:,:,1],p[:,:,2]
    # Neutralise the original green/teal background without modifying skin or
    # neutral black/white clothing. Every unkeyed pixel remains byte-identical.
    green_delta=np.maximum(0,green-red-7)
    teal_delta=np.maximum(0,green-blue-1)
    mask=np.clip(green_delta/18,0,1)*np.clip(teal_delta/9,0,1)
    # Face-safety: additionally ensure no colour change in natural warm skin.
    skin=(red>green+9) & (red>blue+5)
    mask[skin]=0
    lum=(red*.26+green*.57+blue*.17)
    h,w=mask.shape
    vertical=np.linspace(0,1,h,dtype=np.float32)[:,None]
    background=np.zeros_like(p)
    background[:,:,0]=np.clip(lum*.32+8+vertical*5,0,255)
    background[:,:,1]=np.clip(lum*.38+13+vertical*9,0,255)
    background[:,:,2]=np.clip(lum*.49+23+vertical*14,0,255)
    output=np.clip(p*(1-mask[:,:,None])+background*mask[:,:,None],0,255).astype(np.uint8)
    assert np.all(output[mask<.0001]==original[mask<.0001]),"Non-background pixels changed"
    changed=(output!=original).any(axis=2)
    assert changed.sum()>h*w*.04,"No significant backdrop colour was transformed"
    assert changed.sum()<h*w*.88,"Retint would affect too much of the portrait"
    Image.fromarray(output,"RGB").save(TARGET,format="PNG",optimize=True)
    print(f"CV-only mineral portrait {w}x{h}, changed backdrop {100*changed.mean():.2f}%, "
          f"non-background subject pixels preserved, output {TARGET.stat().st_size} bytes")

if __name__=="__main__":main()
