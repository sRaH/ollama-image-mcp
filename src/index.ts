#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_IMAGE_MODEL ?? "x/flux2-klein";
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;
const DEFAULT_STEPS = 0; // 0 = model default

const IMAGE_MODEL_PREFIXES = [
  "x/flux",
  "x/z-image",
  "x/stable-diffusion",
];

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  image?: string; // base64 PNG in final response for image models
  total_duration?: number;
  load_duration?: number;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

async function ollamaGenerate(params: {
  model: string;
  prompt: string;
  width: number;
  height: number;
  steps: number;
  seed?: number;
}): Promise<OllamaGenerateResponse> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    stream: false,
  };

  if (params.steps > 0) {
    body.steps = params.steps;
  }

  if (params.seed !== undefined && params.seed !== 0) {
    body.options = { seed: params.seed };
  }

  const url = `${OLLAMA_BASE_URL}/api/generate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${text}`);
  }

  return (await res.json()) as OllamaGenerateResponse;
}

async function ollamaListModels(): Promise<OllamaListResponse> {
  const url = `${OLLAMA_BASE_URL}/api/tags`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${text}`);
  }

  return (await res.json()) as OllamaListResponse;
}

function isImageModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return IMAGE_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function getDefaultOutputDir(): string {
  return join(homedir(), ".ollama-image-mcp");
}

async function saveBase64Image(
  base64Data: string,
  outputDir: string,
  fileName: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const filePath = join(outputDir, fileName);

  // data URI prefix is not standard but some models include it
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  await writeFile(filePath, buffer);

  return filePath;
}

const GenerateImageSchema = z.object({
  prompt: z.string().describe("The image generation prompt"),
  model: z
    .string()
    .optional()
    .describe(
      `Ollama model to use (default: ${DEFAULT_MODEL}). Examples: x/flux2-klein, x/z-image-turbo`,
    ),
  width: z
    .number()
    .optional()
    .describe(`Image width in pixels (default: ${DEFAULT_WIDTH})`),
  height: z
    .number()
    .optional()
    .describe(`Image height in pixels (default: ${DEFAULT_HEIGHT})`),
  steps: z
    .number()
    .optional()
    .describe(
      "Number of diffusion steps. 0 = model default (default: 0)",
    ),
  seed: z
    .number()
    .optional()
    .describe("Random seed for reproducibility (default: random)"),
  output_dir: z
    .string()
    .optional()
    .describe(
      "Directory to save the generated image. Defaults to ~/.ollama-image-mcp/",
    ),
  file_name: z
    .string()
    .optional()
    .describe(
      "Custom file name (without extension). Defaults to auto-generated name.",
    ),
});

const ListModelsSchema = z.object({
  all: z
    .boolean()
    .optional()
    .describe(
      "If true, list all local models. If false (default), only list image generation models.",
    ),
});

const server = new Server(
  {
    name: "ollama-image-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_image",
      description: [
        "Generate an image using a local Ollama image generation model (e.g. x/flux2-klein, x/z-image-turbo).",
        "The image is saved to disk as a PNG file and the file path is returned.",
        "Requires Ollama to be running locally with an image generation model pulled.",
      ].join(" "),
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt: {
            type: "string",
            description: "The image generation prompt",
          },
          model: {
            type: "string",
            description: `Ollama model to use (default: ${DEFAULT_MODEL})`,
          },
          width: {
            type: "number",
            description: `Image width in pixels (default: ${DEFAULT_WIDTH})`,
          },
          height: {
            type: "number",
            description: `Image height in pixels (default: ${DEFAULT_HEIGHT})`,
          },
          steps: {
            type: "number",
            description: "Number of diffusion steps (0 = model default)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducibility",
          },
          output_dir: {
            type: "string",
            description: "Directory to save the image (default: ~/.ollama-image-mcp/)",
          },
          file_name: {
            type: "string",
            description: "Custom file name without extension (default: auto-generated)",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "list_image_models",
      description: [
        "List locally available Ollama image generation models.",
        "Returns model names, sizes, and quantization levels.",
        "Only shows image-generation models by default (use all=true to see everything).",
      ].join(" "),
      inputSchema: {
        type: "object" as const,
        properties: {
          all: {
            type: "boolean",
            description: "If true, list all local models instead of just image models",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "generate_image": {
      const parsed = GenerateImageSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid arguments: ${parsed.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const {
        prompt,
        model = DEFAULT_MODEL,
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
        steps = DEFAULT_STEPS,
        seed,
        output_dir,
        file_name,
      } = parsed.data;

      const outputDir = output_dir
        ? resolve(output_dir)
        : getDefaultOutputDir();
      const fileName = file_name
        ? `${file_name}.png`
        : `image-${Date.now()}-${randomUUID().slice(0, 8)}.png`;

      try {
        const response = await ollamaGenerate({
          model,
          prompt,
          width,
          height,
          steps,
          seed,
        });

        if (!response.image) {
          return {
            content: [
              {
                type: "text" as const,
                text: [
                  `Model "${model}" did not return image data.`,
                  `This usually means the model is not an image generation model.`,
                  `Try one of: x/flux2-klein, x/z-image-turbo`,
                  "",
                  `Model response: ${response.response?.slice(0, 200) || "(empty)"}`,
                ].join("\n"),
              },
            ],
            isError: true,
          };
        }

        const filePath = await saveBase64Image(
          response.image,
          outputDir,
          fileName,
        );

        const sizeBytes = Buffer.from(
          response.image.replace(/^data:image\/\w+;base64,/, ""),
          "base64",
        ).length;

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Image generated successfully!`,
                ``,
                `  Model:   ${model}`,
                `  Prompt:  ${prompt}`,
                `  Size:    ${width}x${height}`,
                `  Steps:   ${steps || "default"}`,
                `  File:    ${filePath}`,
                `  Bytes:   ${sizeBytes.toLocaleString()}`,
                `  Time:    ${response.total_duration ? `${Math.round(response.total_duration / 1e9)}s` : "unknown"}`,
              ].join("\n"),
            },
            {
              type: "image" as const,
              data: response.image.replace(/^data:image\/\w+;base64,/, ""),
              mimeType: "image/png",
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to generate image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "list_image_models": {
      const parsed = ListModelsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid arguments: ${parsed.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const { all = false } = parsed.data;

      try {
        const response = await ollamaListModels();
        const models = all
          ? response.models
          : response.models.filter((m) => isImageModel(m.name));

        if (models.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: all
                  ? "No Ollama models found locally. Pull one with: ollama pull x/flux2-klein"
                  : [
                      "No image generation models found locally.",
                      "",
                      "Pull one with:",
                      "  ollama pull x/flux2-klein",
                      "  ollama pull x/z-image-turbo",
                      "",
                      "Use all=true to see all local models.",
                    ].join("\n"),
              },
            ],
          };
        }

        const lines = models.map((m) => {
          const sizeGB = (m.size / 1e9).toFixed(1);
          return `  ${m.name}  (${sizeGB} GB, ${m.details.quantization_level})`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: [
                all
                  ? `All local Ollama models (${models.length}):`
                  : `Local image generation models (${models.length}):`,
                "",
                ...lines,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list models: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP protocol uses stdout — all diagnostic output must go to stderr
  process.stderr.write(
    `ollama-image-mcp server running (Ollama at ${OLLAMA_BASE_URL}, model: ${DEFAULT_MODEL})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
