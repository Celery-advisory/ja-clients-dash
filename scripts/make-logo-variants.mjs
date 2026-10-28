// Generates the print variants of the JA Wealth wordmark from the white source asset.
// The brand file only ships a 300px white-on-transparent wordmark, so the dark
// variant used on light surfaces and the PDF letterhead, and the white variant
// used on the PDF covers, are derived here.
// Run with: node scripts/make-logo-variants.mjs

import sharp from "sharp";

const SOURCE = "public/logos/JA_Wealth_wht.png";
// The source is 300px wide, too soft for print at the PDF letterhead size.
const PRINT_WIDTH = 900;

const variants = [
  { output: "public/logos/JA_Wealth_blk.png", negate: true },
  { output: "public/logos/JA_Wealth_wht_print.png", negate: false },
];

for (const { output, negate } of variants) {
  let image = sharp(SOURCE);
  if (negate) image = image.negate({ alpha: false });
  const info = await image
    .resize({ width: PRINT_WIDTH, kernel: "lanczos3" })
    .png()
    .toFile(output);
  console.log(`${output} written: ${info.width}x${info.height}, ${info.size} bytes`);
}
