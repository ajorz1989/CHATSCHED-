// Chatsched logo mark (the yellow "CS" sign icon + wordmark), as a transparent-background
// PNG data URL, embedded so the media kit PDF (mediaKit.ts) can render it with jsPDF's
// addImage() with no network fetch, no CORS considerations, and no risk of the asset being
// unavailable. The source export had a solid cream background and a bottom-right watermark
// from the tool that generated it; both were removed (cream chroma-keyed to transparent,
// watermark corner cropped out) before re-encoding at a print-appropriate size. The tagline
// ("Where Local Brands Get Seen") was cropped off too, since the media kit already carries
// its own subtitle beneath the logo.
export const CHATSCHED_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAArwAAAEDCAYAAADXztd+AAEAAElEQVR42uz9fZxlR3UeCj+rap9ujSQQ7bFBchBCxGKsD+MRw1zBK2QaBjmEyAYHX2zZJBcHh0l0udfkCo2ZieNJJ44GZtB77VzfSYZr/+LfjYks3ugFEl3sWBI0CMXIzUhj0Iw8yC+SkLA+7HFbRppR99lV6/2jalWtqr1Pd89oJPSxl36t6T5nn/1Ru/att959q6dPI+kY1IokJoDvNjPD+cS/2LrN/vZv/94NQOX/8HeD/0f8O1BpDeC5f0X6XVoAOO1e73AV+Ldddaeq7g0BSMBKAAAAAElFTkSuQmCC";

/** Width / height of the source PNG (700x259) — use to size the logo without distorting it. */
export const CHATSCHED_LOGO_ASPECT = 700 / 259;
