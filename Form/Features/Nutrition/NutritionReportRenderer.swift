import PDFKit
import SwiftUI
import UIKit

/// Renders the report's SwiftUI views to bytes for upload, on-device — mirrors
/// `ActivityShareRenderer.image(...)` (`ActivityDetailView.swift`), extended to a two-page PDF.
///
/// Each page is rendered into its *own* single-page `CGContext` (`renderSinglePagePDF`) and the two
/// are then combined with `PDFDocument`. A single shared `CGContext` reused across `beginPDFPage`
/// calls of *different* sizes was tried first and discarded: SwiftUI's internal flip transform for a
/// PDF context is derived from the context's original media box, not the current page's, so the
/// second page (a different size than the first) rendered shifted off-canvas. Two independent
/// single-page contexts sidesteps that entirely.
enum NutritionReportRenderer {
    @MainActor
    static func pdf(payload: NutritionReportPayload, locale: Locale) -> Data? {
        let cover = NutritionReportCoverPage(payload: payload).environment(\.locale, locale)
        let detail = NutritionReportDetailPage(payload: payload).environment(\.locale, locale)

        guard
            let coverPageData = renderSinglePagePDF(cover, width: reportCoverPageSize.width, height: reportCoverPageSize.height),
            let detailPageData = renderSinglePagePDF(detail, width: reportDetailPageWidth, height: nil),
            let coverDocument = PDFDocument(data: coverPageData),
            let detailDocument = PDFDocument(data: detailPageData),
            let coverPage = coverDocument.page(at: 0),
            let detailPage = detailDocument.page(at: 0)
        else { return nil }

        let combined = PDFDocument()
        combined.insert(coverPage, at: 0)
        combined.insert(detailPage, at: 1)
        return combined.dataRepresentation()
    }

    @MainActor
    static func ogImage(payload: NutritionReportPayload, locale: Locale) -> UIImage? {
        let content = NutritionReportOGCard(payload: payload).environment(\.locale, locale)
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: 1200, height: 630)
        renderer.scale = 2
        renderer.isOpaque = true
        return renderer.uiImage
    }

    @MainActor
    private static func renderSinglePagePDF<Content: View>(_ content: Content, width: CGFloat, height: CGFloat?) -> Data? {
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: width, height: height)
        renderer.isOpaque = true

        var pdfData: Data?
        renderer.render { size, renderContent in
            guard size.width > 0, size.height > 0 else { return }
            let mutableData = NSMutableData()
            var mediaBox = CGRect(origin: .zero, size: size)
            guard let consumer = CGDataConsumer(data: mutableData as CFMutableData),
                  let pdfContext = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else { return }
            pdfContext.beginPDFPage(nil)
            renderContent(pdfContext)
            pdfContext.endPDFPage()
            pdfContext.closePDF()
            pdfData = mutableData as Data
        }
        return pdfData
    }
}
