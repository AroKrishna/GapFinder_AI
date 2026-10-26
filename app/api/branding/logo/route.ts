import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sanitizeSvg, validateLogoFile } from "@/lib/branding";
import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";

export async function POST(req: Request) {
  return handle(async () => {
    await requireApiUser();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return { ok: false, error: "No file was provided." };
    }

    const validation = validateLogoFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension
    let ext = file.name.split(".").pop()?.toLowerCase() || "png";
    if (ext === "jpeg") ext = "jpg";

    const uniqueId = crypto.randomUUID();
    const filename = `brand-logo-${uniqueId}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });
    const targetPath = join(uploadDir, filename);

    if (ext === "svg" || file.type.includes("svg")) {
      const svgText = buffer.toString("utf8");
      const cleaned = sanitizeSvg(svgText);
      await writeFile(targetPath, cleaned, "utf8");
    } else {
      await writeFile(targetPath, buffer);
    }

    const publicUrl = `/uploads/${filename}`;
    return {
      ok: true,
      url: publicUrl,
    };
  });
}
