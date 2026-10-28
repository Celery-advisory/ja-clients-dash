import path from "node:path";

export const JA_REPORT_LOGO = path.join(
  process.cwd(),
  "public/logos/JA_Wealth_wht_print.png",
);

export const JA_REPORT_LOGO_DARK = path.join(
  process.cwd(),
  "public/logos/JA_Wealth_blk.png",
);

/** Default cover photo when the image library is unavailable. */
export const COVER_SKYLINE = path.join(
  process.cwd(),
  "public/report-assets/cover-skyline.jpg",
);

export const ALLOCATION_DESK = path.join(
  process.cwd(),
  "public/report-assets/allocation-desk.jpg",
);
