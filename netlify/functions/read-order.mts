// HM Distributors — AI order reader (real).
//
// The sales New Order app POSTs a photo of a customer's P.O. / email / WhatsApp
// message here; this reads it with Claude (vision) and returns the structured
// order the form fills in. Runs as a Netlify Function so the Anthropic API key
// stays server-side (set ANTHROPIC_API_KEY in the Netlify site env vars).
//
// Request  JSON: { image: "data:image/jpeg;base64,...", catalog: [{id,name}] }
// Response JSON: { customer, destination, po, lines: [{commodityId,size,qty,unitPrice}] }
//                or { error: "..." } (HTTP 200) so the client can fall back to
//                its demo extraction without surfacing a hard failure.

import Anthropic from "@anthropic-ai/sdk";

// Strict schema the model must return — mirrors the app's ScanResult shape.
const ORDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["customer", "destination", "po", "lines"],
  properties: {
    customer: { type: "string" },
    destination: { type: "string" },
    po: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["commodityId", "size", "qty", "unitPrice"],
        properties: {
          commodityId: { type: "string" },
          size: { type: "string" },
          qty: { type: "integer" },
          unitPrice: { type: "number" },
        },
      },
    },
  },
} as const;

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ok({ error: "no_api_key" });

  try {
    const { image, catalog } = (await req.json()) as {
      image?: string;
      catalog?: { id: string; name: string }[];
    };

    const m = /^data:(image\/[a-zA-Z.+-]+);base64,(.+)$/.exec(image ?? "");
    if (!m) return ok({ error: "bad_image" });
    const mediaType = m[1];
    const data = m[2];

    const catalogList = (catalog ?? [])
      .map((c) => `${c.id} = ${c.name}`)
      .join("\n");

    const prompt = `You are reading a produce purchase order from a photograph — it may be a printed P.O., an email or WhatsApp screenshot, or a handwritten note. Extract the order.

Match every product to this catalog. Use the exact id on the LEFT for commodityId:
${catalogList}

Rules:
- customer: the buyer / company name ("" if not visible).
- destination: the ship-to city and state ("" if not visible).
- po: the customer P.O. or order number ("" if not visible).
- lines: one entry per product actually ordered.
  - commodityId: the closest matching id from the catalog above; if nothing fits, pick the nearest produce category.
  - size: the size / pack exactly as written (e.g. "Super Select", "36", "XL", "6's"); "" if none.
  - qty: cases / cartons as an integer (0 if not given).
  - unitPrice: price per case as a number (0 if no price is written).
Only include real product lines. Read carefully — the handwriting or layout may be messy.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: ORDER_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as `image/${string}`, data } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return ok({ error: "refused" });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return ok({ error: "empty" });

    const parsed = JSON.parse(textBlock.text);
    return ok(parsed);
  } catch (e) {
    return ok({ error: "read_failed", message: e instanceof Error ? e.message : String(e) });
  }
};
