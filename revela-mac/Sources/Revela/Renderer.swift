import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import RevelaCore

/**
 * Revela as fotos com o Core Image (na GPU do Mac): RAW pelo próprio macOS, depois claridade,
 * a tabela de cor do preset e a vinheta. A tela usa uma versão menor; a exportação, a foto inteira.
 */
final class Renderer {
    static let shared = Renderer()

    let context = CIContext(options: [.cacheIntermediates: false])
    let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

    /** A foto como veio da câmera, já de pé. [maxPixels] limita o lado maior (0 = inteira). */
    func load(_ url: URL, maxPixels: CGFloat = 0) -> CIImage? {
        var image: CIImage?
        if PhotoFiles.isRaw(url.lastPathComponent), let raw = CIRAWFilter(imageURL: url) {
            let native = max(raw.nativeSize.width, raw.nativeSize.height)
            if maxPixels > 0, native > maxPixels { raw.scaleFactor = Float(maxPixels / native) }
            image = raw.outputImage
        }
        if image == nil { image = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) }
        guard var out = image else { return nil }
        let longest = max(out.extent.width, out.extent.height)
        if maxPixels > 0, longest > maxPixels * 1.05 {
            let s = maxPixels / longest
            out = out.transformed(by: CGAffineTransform(scaleX: s, y: s))
        }
        return out.transformed(by: CGAffineTransform(translationX: -out.extent.minX, y: -out.extent.minY))
    }

    func apply(_ look: PresetLook?, to image: CIImage) -> CIImage {
        guard let look else { return image }
        var out = image
        let longest = max(out.extent.width, out.extent.height)
        let clarity = look.effects.clarity
        if clarity > 0.01 {
            // Claridade: contraste local com raio grande.
            let f = CIFilter.unsharpMask()
            f.inputImage = out
            f.radius = Float(longest * 0.012)
            f.intensity = clarity * 0.8
            out = f.outputImage ?? out
        } else if clarity < -0.01 {
            // Claridade negativa: suaviza misturando com uma versão desfocada.
            let blur = out.clampedToExtent().applyingGaussianBlur(sigma: Double(longest * 0.004)).cropped(to: out.extent)
            let f = CIFilter.dissolveTransition()
            f.inputImage = out
            f.targetImage = blur
            f.time = -clarity * 0.5
            out = f.outputImage ?? out
        }
        let cube = CIFilter.colorCubeWithColorSpace()
        cube.inputImage = out
        cube.cubeDimension = Float(PresetLook.size)
        cube.cubeData = look.cubeData
        cube.colorSpace = sRGB
        out = cube.outputImage ?? out
        if abs(look.effects.vignette) > 0.01 {
            let v = CIFilter.vignetteEffect()
            v.inputImage = out
            v.center = CGPoint(x: out.extent.midX, y: out.extent.midY)
            v.radius = Float(hypot(out.extent.width, out.extent.height) / 2 * CGFloat(0.35 + 0.55 * look.effects.vignetteMidpoint))
            v.intensity = -look.effects.vignette
            v.falloff = 0.6
            out = v.outputImage?.cropped(to: out.extent) ?? out
        }
        return out
    }

    /** Imagem para a tela ou miniatura. */
    func image(_ url: URL, look: PresetLook?, maxPixels: CGFloat) -> NSImage? {
        guard let source = load(url, maxPixels: maxPixels) else { return nil }
        let out = apply(look, to: source)
        guard let cg = context.createCGImage(out, from: out.extent, format: .RGBA8, colorSpace: sRGB) else { return nil }
        return NSImage(cgImage: cg, size: NSSize(width: cg.width, height: cg.height))
    }

    /** JPEG em resolução cheia, como vai para o cliente. */
    func exportJPEG(_ url: URL, look: PresetLook?, to destination: URL) throws {
        guard let source = load(url) else { throw RenderError("Não consegui abrir \(url.lastPathComponent)") }
        let out = apply(look, to: source)
        let options = [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): 0.92]
        try context.writeJPEGRepresentation(of: out, to: destination, colorSpace: sRGB, options: options)
    }
}

struct RenderError: LocalizedError {
    let errorDescription: String?
    init(_ text: String) { errorDescription = text }
}
