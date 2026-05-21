# ollama-image-mcp

MCP server for local image generation via [Ollama](https://ollama.com). Uses models like `x/flux2-klein` and `x/z-image-turbo` running on your own hardware — no API keys needed.

## Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate an image from a text prompt, save as PNG |
| `list_image_models` | List locally available image generation models |

## Prerequisites

- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`)
- An image generation model pulled:
  ```bash
  ollama pull x/flux2-klein
  # or
  ollama pull x/z-image-turbo
  ```

## Install

### Use with OpenCode

Add to your `opencode.json` or `.opencode/opencode.jsonc`:

```jsonc
{
  "mcp": [
    {
      "command": "npx",
      "args": ["-y", "ollama-image-mcp@latest"]
    }
  ]
}
```

Or use the built version locally:

```jsonc
{
  "mcp": [
    {
      "command": "node",
      "args": ["/path/to/ollama-image-mcp/dist/index.js"]
    }
  ]
}
```

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ollama-image": {
      "command": "npx",
      "args": ["-y", "ollama-image-mcp@latest"]
    }
  }
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_IMAGE_MODEL` | `x/flux2-klein` | Default model for generation |

## `generate_image` Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | — | The image generation prompt |
| `model` | string | No | `x/flux2-klein` | Ollama model name |
| `width` | number | No | `1024` | Image width in pixels |
| `height` | number | No | `1024` | Image height in pixels |
| `steps` | number | No | `0` | Diffusion steps (0 = model default) |
| `seed` | number | No | random | Seed for reproducibility |
| `output_dir` | string | No | `~/.ollama-image-mcp/` | Save directory |
| `file_name` | string | No | auto-generated | File name (without `.png`) |

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
