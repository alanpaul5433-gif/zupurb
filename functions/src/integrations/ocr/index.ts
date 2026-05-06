/**
 * index.ts — OCR integration barrel exports (I4).
 *
 * Public API for the OCR integration module.
 * Consumers import from here, not from individual files.
 *
 * Vendor wrapper API summary (for backend-dev / verify-visit flow):
 *
 *   runOCRHarness(input, groundTruth?)  → OCRHarnessResult
 *     Run all 4 vendors in parallel. Admin harness only. Not for production.
 *
 *   extractWithVendor(vendor, input)    → OCRResult
 *     Run a single vendor. Production verify-visit flow uses this.
 *     Vendor is read from Remote Config key: ocr_selected_vendor (default: 'textract').
 *
 *   Types: OCRInput, OCRResult, OCRHarnessResult, OCRVendorAdapter, GroundTruth
 */

export { runOCRHarness, extractWithVendor } from "./harness";
export type { OCRInput, OCRResult, OCRHarnessResult, OCRVendorAdapter } from "./types";
export type { GroundTruth } from "./scoring";
