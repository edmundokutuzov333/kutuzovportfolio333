#!/usr/bin/env python3
"""Release gate: render first PDF page and reject the dark Intro overlay.

Text extraction alone does not detect a full-screen canvas/overlay above the CV.
The editorial PDF has an ivory body after a dark hero; an Intro-only print does not.
"""
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
PDF_DIR=ROOT/"public"/"cv"

def check(code,heading):
    doc=PDF_DIR/f"Edmundo-Kutuzov-CV-{code}.pdf"
    with tempfile.TemporaryDirectory(prefix="cv-pdf-qa-") as temp:
        out=Path(temp)/"page1"
        proc=subprocess.run(["pdftoppm","-f","1","-l","1","-scale-to","900",
                            "-singlefile","-png",str(doc),str(out)],
                            capture_output=True,text=True,timeout=60,check=True)
        p=np.asarray(Image.open(str(out)+".png").convert("RGB"))
        # Neutral ivory body occupies a substantial area on the first page.
        ivory=(p[:,:,0]>185)&(p[:,:,1]>180)&(p[:,:,2]>170)
        fraction=float(ivory.mean())
        if fraction<0.22:
            raise AssertionError(
                f"{code} export is visually obscured by a dark screen/Intro. "
                f"Light editorial body fraction: {fraction:.3f}")
        first=subprocess.run(["pdftotext","-f","1","-l","1",str(doc),"-"],
                             capture_output=True,text=True,check=True).stdout
        assert heading in first,(code,"heading absent from first page")
        for invalid in ["CLICK · SCROLL", "Click · Scroll", "TO BREACH", "SKIP"]:
            assert invalid not in first,(code,"intro text reached the PDF")
        print(f"{code}: first-page ivory {fraction:.2%}, {heading} visible, no intro")

if __name__=="__main__":
    check("EN","About Me")
    check("PT","Sobre Mim")
