import sharp from "sharp";
import { fromPath } from "pdf2pic";

const PREVIEW_WIDTH = 400;
const BLUR_SIGMA = 6;

export async function generateBlurredFirstPageBuffer(pdfPath: string): Promise<Buffer> {
  const convert = fromPath(pdfPath, { density: 150, format: "png" });
  const result = await convert(1, { responseType: "buffer" });
  if (!result.buffer) {
    throw new Error("Failed to render PDF first page");
  }

  return sharp(result.buffer)
    .resize(PREVIEW_WIDTH)
    .blur(BLUR_SIGMA)
    .jpeg({ quality: 80 })
    .toBuffer();
}
