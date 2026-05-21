---
name: ollama-image
description: Generate images locally using Ollama image generation models (FLUX.2 Klein). Use when the user asks to generate, create, or design bitmap/PNG/JPG images. Async job-based — returns job ID immediately, use get_image to retrieve.
---

# Ollama Image Generation Skill

Local image generation via Ollama's FLUX.2 Klein model family. No API keys needed — runs on your hardware (macOS only).

## Model Capabilities

FLUX.2 Klein (by Black Forest Labs) comes in 4B and 9B parameter sizes:
- **Readable text rendering** — generates clean, legible typography in layouts, logos, and UI mockups
- **Text-to-image generation** — detailed, specific prompts work best
- **Product photography** — realistic lighting, shadows, reflections
- **UI/Interface mockups** — clean layouts with readable text
- **Photorealistic scenes** — complex compositions with proper perspective
- **Creative/stylized art** — illustrations, posters, botanical art
- **Architecture & interiors** — architectural photography style

## Tools

### `generate_image` (async — returns job ID immediately)

Always provide a meaningful `file_name` — use 2-4 hyphenated words describing the image content (e.g. `opel-logo`, `hero-banner`, `product-shot`).

```
generate_image(
  prompt: string,          // Required. Be specific and detailed.
  model?: string,          // Default: x/flux2-klein. Options: x/flux2-klein, x/z-image-turbo
  width?: number,          // Default: 1024
  height?: number,         // Default: 1024
  steps?: number,          // Default: 0 (model decides)
  seed?: number,           // For reproducibility
  file_name?: string,      // IMPORTANT: always provide a meaningful name
  output_dir?: string,     // Default: .ollama-images/ in project working directory
)
```

Returns a `job_id`. Image generation takes 30-60 seconds.

### `get_image` (poll for result)

```
get_image(job_id: string)  // The job_id from generate_image
```

Returns status (`pending`/`running`/`completed`/`failed`) and when completed: file path + inline image data.

### `list_image_models`

Lists locally available image generation models. Use `all=true` to see everything.

## Workflow

1. Call `generate_image` with a detailed prompt and a meaningful `file_name`
2. Wait a few seconds, then call `get_image` with the returned `job_id`
3. If still running, wait and retry
4. When completed, image is saved to `.ollama-images/{file_name}.png`

## Prompt Best Practices

- **Be specific**: "A minimalist car company logo, bold lightning bolt inside a circle, flat vector style, black and white" — not "a logo"
- **Specify text exactly**: For text in images, quote the exact text: `A neon sign reading "OPEN 24 HOURS"`
- **Include style/mood**: "photorealistic", "flat vector", "watercolor", "isometric", "art deco"
- **Mention colors explicitly**: "gold and black color scheme", "gradient #FF6B35 to #F7C59F"
- **Composition matters**: Describe lighting, perspective, background, depth of field

## File Naming Convention

Always set `file_name` to a short, meaningful, hyphenated name:
- `opel-logo` — not `image-1234`
- `hero-banner-dark` — not `banner`
- `product-skincare-bottle` — not `img1`

Images are saved as `.ollama-images/{file_name}.png` in the project working directory.

## Limitations

- macOS only (Ollama image generation limitation)
- First run may be slow (model loading)
- Larger images and more steps = longer generation time
