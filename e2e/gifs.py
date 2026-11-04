"""Assemble recorded frames (e2e/gifs.mjs) into GIFs in docs/gifs. Needs Pillow. Frame duration (ms) is the number after the dash in each file name."""
import glob, os, re, sys
from PIL import Image

frames = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('FRAMES', '/tmp/sk-frames')
out = os.path.join(os.path.dirname(__file__), '..', 'docs', 'gifs')
os.makedirs(out, exist_ok=True)
for d in sorted(glob.glob(os.path.join(frames, '*/'))):
    name = os.path.basename(os.path.dirname(d))
    files = sorted(glob.glob(os.path.join(d, '*.png')))
    if not files: continue
    ims = [Image.open(f).convert('RGB') for f in files]
    durs = [int(re.search(r'-(\d+)\.png$', f).group(1)) for f in files]
    pal = [im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in ims]
    dest = os.path.join(out, f'{name}.gif')
    pal[0].save(dest, save_all=True, append_images=pal[1:], duration=durs, loop=0, optimize=True, disposal=2)
    print(f'{name}.gif  {len(ims)} frames  {os.path.getsize(dest)//1024} KB')
