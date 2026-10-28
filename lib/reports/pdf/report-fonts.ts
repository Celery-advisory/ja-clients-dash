import path from "node:path";

import { Font } from "@react-pdf/renderer";

let registered = false;

const playfairDir = path.join(process.cwd(), "public/fonts/playfair-display");
const carlitoDir = path.join(process.cwd(), "public/fonts/carlito");

/**
 * The report template uses Playfair Display (Regular and Black) and Calibri.
 * Calibri cannot be bundled, so Carlito stands in: it is metric compatible, so
 * line breaks and widths match. Files are TTF because the PDF renderer cannot use WOFF2.
 */
export function registerReportFonts() {
  if (registered) return;

  Font.register({
    family: "Playfair Display",
    fonts: [
      { src: path.join(playfairDir, "PlayfairDisplay-Regular.ttf"), fontWeight: 400 },
      {
        src: path.join(playfairDir, "PlayfairDisplay-Italic.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      { src: path.join(playfairDir, "PlayfairDisplay-Bold.ttf"), fontWeight: 700 },
      { src: path.join(playfairDir, "PlayfairDisplay-Black.ttf"), fontWeight: 900 },
    ],
  });

  Font.register({
    family: "Carlito",
    fonts: [
      { src: path.join(carlitoDir, "Carlito-Regular.ttf"), fontWeight: 400 },
      { src: path.join(carlitoDir, "Carlito-Bold.ttf"), fontWeight: 700 },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
