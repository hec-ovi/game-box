# Generated surface textures

Textures we generate are ours, so they redistribute with a world file. This is
the route from a prompt to a tile the renderer can put on a wall.

One example ships here, validated end to end:
`example/wall-concrete-dark.png`, 896 x 896, 2 m across, a dark grimy concrete
street wall.

## Getting an image

The Grok CLI (`grok`) exposes an `image_gen` tool inside the agent. There is no
image endpoint to call directly and no API key on this machine; the CLI signs in
with a session, so generation goes through the agent.

```bash
grok --prompt-file <instruction> --model grok-4.6 --effort low --permission-mode bypassPermissions
```

The instruction tells the agent to call `image_gen` once with the prompt read
verbatim from a file under `prompts/`, then copy the result somewhere useful.
Read the prompt from a file rather than pasting it into the instruction, or the
agent rewrites it.

`image_gen` takes `prompt` and `aspect_ratio` (`auto`, `1:1`, `16:9`, `9:16`,
`3:2`, `2:3`). Use `1:1`. It has no resolution, format or tiling parameter. It
returns a 1024 x 1024 JPEG written to
`~/.grok/sessions/<encoded-cwd>/<session-id>/images/<n>.jpg`. The xAI API behind
it does document a 2k resolution, but the CLI tool does not expose it, so 1024
is the ceiling here.

## The prompt

`prompts/wall-concrete-dark.md`. Five sentences, plain prose, subject first.
Each clause is doing a job:

| Clause | Why |
|---|---|
| "flat photographic material scan" | asks for a texture reference, not a photograph of a wall in a place |
| "camera perpendicular ... fills the whole frame edge to edge" | no perspective, no horizon, no background |
| "the frame covers two metres by two metres of real wall" | fixes the scale, so aggregate comes out the size of aggregate |
| the list of wear, "all spread at the same density" | uniform stochastic detail instead of one hero crack |
| "no single crack, stain or patch distinctive enough to be recognised twice" | the repeat killer: anything you can point at twice becomes a grid |
| "completely flat even diffuse light ... no vignette, no brighter side" | the engine lights the surface, so the texture must not arrive pre-lit |
| "neutral desaturated charcoal grey" | neon supplies the colour at night; a pre-tinted texture fights it |
| "seamless tiling texture whose pattern continues off all four edges" | the model has no tiling mode, but this wording still measurably improves the wrap |

The last row is worth knowing: general advice says naming "seamless" makes these
models draw a bordered swatch. On this one it did not. The raw generation came
back at a seam score of 1.13 horizontally and 1.39 vertically, which is most of
the way to seamless before any processing.

### Varying it for another surface

Keep every clause. Swap two things:

- the material sentence (what it is, and the list of wear on it)
- the metre figure, and the matching `--metres` when tiling

Road: wet asphalt, tyre polish, patched trenches, grit, oil bloom, 4 m.
Corpo floor: polished concrete, faint grinder swirl, scuff haze, 3 m.
Home interior: moulded plastic panel, fine matte grain, faint scuffing, 1.5 m.

## Making it tile

```bash
node tools/textures/tile.mjs <image> <outdir> [--metres 2] [--tame 0.3] [--flatten 0.6] [--pot]
```

Four steps, in this order:

1. **Tame the highlights.** Asked for worn concrete the model returns bright
   mineral blooms. On a dark wall those read as white speckle, so the surface
   looks like terrazzo rather than grime. The top 6% of pixels get pulled back
   towards the rest, hue kept.
2. **Flatten the lighting.** Subtract the very low frequencies, put the average
   back. A tone difference between opposite edges survives any seam cut and
   shows up as a checkerboard once the tile repeats.
3. **Cut the wrap.** Min-error boundary cut, the image quilting method: the
   strip that would fall off the right edge is laid back over the left edge and
   the two are cut along the path where they already agree. Nothing is blurred,
   unlike a cross-fade. Same again vertically. 1024 in, 896 out.
4. **Measure.** The seam score compares the wrap join against an ordinary pair
   of neighbouring columns inside the tile. 1.0 means the join is as ordinary as
   anywhere else. The lighting spread is the brightness range over an 8 x 8 grid.

It also writes the sheets to look at: a 4 x 4 repeat before and after, and the
tile on an 8 m wall with a 2.1 m door drawn on it.

The example measured 1.13 / 1.09 seam and 6.0% lighting spread, from 1.13 / 1.39
and 7.6%.

## Standards

- PNG, not JPEG. The generated JPEG is a source; its chroma error would come
  back multiplied if normal and roughness maps are derived from it later.
- 896 x 896 for a 2 m tile, which is 448 px per metre. Non power of two is fine:
  both the WebGPU and the WebGL2 backends mipmap and repeat it. `--pot` trims to
  512 through a wrap-aware resize if something downstream needs it.
- One tile per material, sized in metres. `MetreTiling` in `game/furnish` lays
  it out by world position, so the same tile on a small wall and a large one
  keeps the aggregate the same size.

## Using it in the renderer

Proven on this machine under the WebGL2 fallback, with the real
`WebGPURenderer` and the real `MetreTiling` node:

```js
tex.wrapS = tex.wrapT = THREE.RepeatWrapping
tex.colorSpace = THREE.SRGBColorSpace
tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
material.contextNode = new MetreTiling(2).apply(material)
```

No seam across a 24 m wall, none at a corner where two walls meet, none where
the wall meets the ground, and the door reads at the right height.

## Not done yet

- **Normal and roughness.** The tile is colour only. Both can be derived from
  the flattened albedo (Sobel on luminance for normal, local contrast for
  roughness), which is a fake that holds up under moving light, but neither is
  built here.
- **Breaking the repeat.** One tile at 4 x 4 still shows its motifs. The cheap
  fix costs no images: hash the tile cell in `MetreTiling` and offset or rotate
  per cell. Separate tiles cut independently do not join each other, so if
  variants are wanted as interchangeable tiles they have to share a border ring
  copied from the same base.

## Licence

Generated from our own prompts, so the output is ours to ship inside a world
file. Nothing here depends on a third party asset licence, which is the point:
it removes the redistribution constraint for surfaces.
