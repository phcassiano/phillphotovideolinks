import Foundation

/**
 * Aproximação dos ajustes do Lightroom: balanço de branco, exposição, tons (contraste, realces,
 * sombras, brancos, pretos), remover névoa, curvas, HSL, vibração, saturação e color grading.
 * Tudo vira uma tabela 3D (LUT) de 33×33×33 que o Core Image aplica na foto inteira. Mesma conta
 * do app Android (PresetLook.kt); claridade e vinheta ficam em [effects], feitos com filtros.
 */
public struct PresetLook {
    public static let size = 33

    /** RGB de cada ponto da tabela, com o vermelho variando mais rápido (ordem do CIColorCube). */
    public private(set) var table: [Float]
    public let effects: Effects

    /** Ajustes que olham a vizinhança do pixel ou a posição dele: viram filtros do Core Image. */
    public struct Effects: Equatable {
        /** -1 a 1, já com a intensidade. */
        public var clarity: Float
        /** -1 (escurece as bordas) a 1 (clareia), já com a intensidade. */
        public var vignette: Float
        /** 0 a 1: onde a vinheta começa (0 = no centro). */
        public var vignetteMidpoint: Float
    }

    public init(preset: Preset, amount: Float) {
        let p = Params(preset)
        let n = PresetLook.size
        var t = [Float](repeating: 0, count: n * n * n * 3)
        var i = 0
        for b in 0..<n {
            for g in 0..<n {
                for r in 0..<n {
                    let rf = Float(r) / Float(n - 1)
                    let gf = Float(g) / Float(n - 1)
                    let bf = Float(b) / Float(n - 1)
                    let out = PresetLook.map(rf, gf, bf, p)
                    t[i] = rf + (out.0 - rf) * amount
                    t[i + 1] = gf + (out.1 - gf) * amount
                    t[i + 2] = bf + (out.2 - bf) * amount
                    i += 3
                }
            }
        }
        table = t
        let clarity = Float(preset.numbers["Clarity2012"] ?? preset.n("Clarity")) / 100
        effects = Effects(
            clarity: min(max(clarity, -1), 1) * amount,
            vignette: min(max(Float(preset.n("PostCropVignetteAmount")) / 100, -1), 1) * amount,
            vignetteMidpoint: Float(preset.n("PostCropVignetteMidpoint", 50)) / 100
        )
    }

    /** A tabela no formato do CIColorCube: RGBA em Float32. */
    public var cubeData: Data {
        var rgba = [Float](repeating: 1, count: table.count / 3 * 4)
        for k in 0..<(table.count / 3) {
            rgba[k * 4] = table[k * 3]
            rgba[k * 4 + 1] = table[k * 3 + 1]
            rgba[k * 4 + 2] = table[k * 3 + 2]
        }
        return rgba.withUnsafeBufferPointer { Data(buffer: $0) }
    }

    /** Cor de um pixel (0 a 1), já com a intensidade: interpolação na tabela, como o Core Image faz. */
    public func lookup(_ r: Float, _ g: Float, _ b: Float) -> (Float, Float, Float) {
        let n = PresetLook.size
        func split(_ v: Float) -> (Int, Float) {
            let x = min(max(v, 0), 1) * Float(n - 1)
            let i = min(Int(x), n - 2)
            return (i, x - Float(i))
        }
        let (x0, fx) = split(r), (y0, fy) = split(g), (z0, fz) = split(b)
        func at(_ x: Int, _ y: Int, _ z: Int, _ ch: Int) -> Float { table[((z * n + y) * n + x) * 3 + ch] }
        func channel(_ ch: Int) -> Float {
            let c00 = at(x0, y0, z0, ch) + (at(x0 + 1, y0, z0, ch) - at(x0, y0, z0, ch)) * fx
            let c10 = at(x0, y0 + 1, z0, ch) + (at(x0 + 1, y0 + 1, z0, ch) - at(x0, y0 + 1, z0, ch)) * fx
            let c01 = at(x0, y0, z0 + 1, ch) + (at(x0 + 1, y0, z0 + 1, ch) - at(x0, y0, z0 + 1, ch)) * fx
            let c11 = at(x0, y0 + 1, z0 + 1, ch) + (at(x0 + 1, y0 + 1, z0 + 1, ch) - at(x0, y0 + 1, z0 + 1, ch)) * fx
            let c0 = c00 + (c10 - c00) * fy
            let c1 = c01 + (c11 - c01) * fy
            return c0 + (c1 - c0) * fz
        }
        return (channel(0), channel(1), channel(2))
    }

    // MARK: - A conta, para uma cor

    static func map(_ r0: Float, _ g0: Float, _ b0: Float, _ p: Params) -> (Float, Float, Float) {
        // Balanço de branco e exposição em luz linear.
        var r = linear(r0) * p.wbRed * p.exposure
        var g = linear(g0) * p.wbGreen * p.exposure
        var b = linear(b0) * p.wbBlue * p.exposure

        // Tons e curvas em valores de tela.
        r = p.curveRed.at(p.curveMaster.at(tone(dehaze(gamma(r), p), p)))
        g = p.curveGreen.at(p.curveMaster.at(tone(dehaze(gamma(g), p), p)))
        b = p.curveBlue.at(p.curveMaster.at(tone(dehaze(gamma(b), p), p)))

        // HSL, vibração e saturação.
        var (hue, sat, lum) = rgbToHsl(r, g, b)
        if p.hasHsl {
            let (band, next, t) = PresetLook.band(hue)
            let wa = 1 - t
            let dh: Float = p.hue[band] * wa + p.hue[next] * t
            let ds: Float = p.sat[band] * wa + p.sat[next] * t
            let dl: Float = p.lum[band] * wa + p.lum[next] * t
            let mid: Float = 1 - abs(2 * lum - 1)
            hue += dh * hueRange
            sat *= 1 + ds
            lum += dl * 0.3 * sat * mid
        }
        if p.vibrance != 0 { sat *= 1 + p.vibrance * (1 - sat) }
        if p.dehaze != 0 { sat *= 1 + p.dehaze * 0.35 }
        sat = clamp(sat * (1 + p.saturation))
        (r, g, b) = hslToRgb(hue, sat, clamp(lum))

        // Color grading (ou divisão de tons, nos presets antigos).
        if !p.grading.isEmpty {
            let y: Float = 0.2126 * r + 0.7152 * g + 0.0722 * b
            let pivot = min(max(0.5 + p.balance * 0.25, 0.15), 0.85)
            let shadows = clamp(1 - smoothstep(0, pivot * 2, y))
            let highlights = clamp(smoothstep(pivot * 2 - 1, 1, y))
            let mids = clamp(1 - shadows - highlights)
            for zone in p.grading {
                let w: Float
                switch zone.region {
                case .shadows: w = shadows
                case .midtones: w = mids
                case .highlights: w = highlights
                case .global: w = 1
                }
                if w == 0 { continue }
                let dr: Float = zone.tint.0 * zone.strength + zone.light
                let dg: Float = zone.tint.1 * zone.strength + zone.light
                let db: Float = zone.tint.2 * zone.strength + zone.light
                r += w * dr
                g += w * dg
                b += w * db
            }
        }
        return (clamp(r), clamp(g), clamp(b))
    }

    /** Remover névoa: tira (ou, negativo, põe) um véu claro uniforme. */
    static func dehaze(_ x: Float, _ p: Params) -> Float {
        let d = p.dehaze
        if d == 0 { return x }
        if d > 0 {
            let haze = 0.09 * d
            return clamp((x - haze) / (1 - haze))
        }
        let haze = -0.18 * d
        return x * (1 - haze) + haze
    }

    /** Pretos, sombras, realces, brancos, contraste e curva paramétrica, num canal de 0 a 1. */
    static func tone(_ x0: Float, _ p: Params) -> Float {
        var x = x0
        if p.blacks != 0 { x += p.blacks * 0.12 * pow(1 - clamp(x), 3) }
        if p.shadows != 0 { x += p.shadows * 0.22 * bump(clamp(x), shadow: true) }
        if p.highlights != 0 { x += p.highlights * 0.22 * bump(clamp(x), shadow: false) }
        if p.whites != 0 { x += p.whites * 0.12 * pow(clamp(x), 3) }
        x = clamp(x)
        if p.contrast != 0 {
            let s: Float = x * x * (3 - 2 * x)
            x += p.contrast * 0.6 * (s - x)
        }
        for zone in p.parametric where zone.amount != 0 {
            let d = (x - zone.center) / 0.14
            x += zone.amount * 0.12 * exp(-d * d)
        }
        return clamp(x)
    }

    static func bump(_ x: Float, shadow: Bool) -> Float {
        // x(1-x)² tem pico em 1/3 (sombras); x²(1-x) em 2/3 (realces). Os dois normalizados para 1.
        let v = shadow ? x * (1 - x) * (1 - x) : x * x * (1 - x)
        return v / 0.148
    }

    // MARK: - Ajustes do preset, já na escala da conta

    enum Region { case shadows, midtones, highlights, global }

    struct Zone {
        let region: Region
        let tint: (Float, Float, Float)
        let strength: Float
        let light: Float

        init(region: Region, hue: Float, saturation: Float, luminance: Float) {
            self.region = region
            let c = hslToRgb(hue, 1, 0.5)
            tint = (c.0 - 0.5, c.1 - 0.5, c.2 - 0.5)
            strength = saturation * 0.35
            light = luminance * 0.15
        }
    }

    struct ParametricZone {
        let center: Float
        let amount: Float
    }

    struct Params {
        let exposure: Float
        let wbRed: Float, wbGreen: Float, wbBlue: Float
        let contrast: Float, highlights: Float, shadows: Float, whites: Float, blacks: Float
        let vibrance: Float, saturation: Float, dehaze: Float
        let curveMaster: Curve, curveRed: Curve, curveGreen: Curve, curveBlue: Curve
        let hue: [Float], sat: [Float], lum: [Float]
        let hasHsl: Bool
        let parametric: [ParametricZone]
        let grading: [Zone]
        let balance: Float

        init(_ preset: Preset) {
            func f(_ key: String, _ fallback: Double = 0) -> Float { Float(preset.n(key, fallback)) }
            contrast = f("Contrast2012") / 100
            highlights = f("Highlights2012") / 100
            shadows = f("Shadows2012") / 100
            whites = f("Whites2012") / 100
            blacks = f("Blacks2012") / 100
            vibrance = f("Vibrance") / 100
            saturation = f("Saturation") / 100
            dehaze = min(max(f("Dehaze") / 100, -1), 1)
            curveMaster = Curve(preset.curves["ToneCurvePV2012"])
            curveRed = Curve(preset.curves["ToneCurvePV2012Red"])
            curveGreen = Curve(preset.curves["ToneCurvePV2012Green"])
            curveBlue = Curve(preset.curves["ToneCurvePV2012Blue"])
            hue = bands.map { f("HueAdjustment\($0)") / 100 }
            sat = bands.map { f("SaturationAdjustment\($0)") / 100 }
            lum = bands.map { f("LuminanceAdjustment\($0)") / 100 }
            hasHsl = (hue + sat + lum).contains { $0 != 0 }

            exposure = Float(pow(2.0, preset.numbers["Exposure2012"] ?? preset.n("Exposure")))

            // Presets feitos em JPEG trazem o ajuste relativo; os feitos em RAW trazem Kelvin.
            let asShot = preset.texts["WhiteBalance"].map { $0 == "As Shot" || $0 == "Como fotografado" } ?? false
            let temperature: Float
            if preset.numbers["IncrementalTemperature"] != nil {
                temperature = f("IncrementalTemperature") / 100
            } else if !asShot, preset.numbers["Temperature"] != nil {
                temperature = Float(min(max((preset.n("Temperature") - 5500) / 40, -100), 100)) / 100
            } else {
                temperature = 0
            }
            let tint: Float
            if preset.numbers["IncrementalTint"] != nil {
                tint = f("IncrementalTint") / 100
            } else if !asShot, preset.numbers["Tint"] != nil {
                tint = f("Tint") / 1.5 / 100
            } else {
                tint = 0
            }
            wbRed = (1 + 0.22 * temperature) * (1 + 0.05 * tint)
            wbGreen = 1 - 0.18 * tint
            wbBlue = (1 - 0.22 * temperature) * (1 + 0.05 * tint)

            let s1 = f("ParametricShadowSplit", 25) / 100
            let s2 = f("ParametricMidtoneSplit", 50) / 100
            let s3 = f("ParametricHighlightSplit", 75) / 100
            parametric = [
                ParametricZone(center: s1 / 2, amount: f("ParametricShadows") / 100),
                ParametricZone(center: (s1 + s2) / 2, amount: f("ParametricDarks") / 100),
                ParametricZone(center: (s2 + s3) / 2, amount: f("ParametricLights") / 100),
                ParametricZone(center: (s3 + 1) / 2, amount: f("ParametricHighlights") / 100),
            ]

            func zone(_ region: Region, _ hueKey: String, _ satKey: String, _ lumKey: String?, _ oldHue: String? = nil, _ oldSat: String? = nil) -> Zone? {
                let h = preset.numbers[hueKey] ?? oldHue.flatMap { preset.numbers[$0] } ?? 0
                let s = preset.numbers[satKey] ?? oldSat.flatMap { preset.numbers[$0] } ?? 0
                let l = lumKey.map { preset.n($0) } ?? 0
                if s == 0 && l == 0 { return nil }
                return Zone(region: region, hue: Float(h), saturation: Float(s / 100), luminance: Float(l / 100))
            }
            grading = [
                zone(.shadows, "ColorGradeShadowHue", "ColorGradeShadowSat", "ColorGradeShadowLum", "SplitToningShadowHue", "SplitToningShadowSaturation"),
                zone(.midtones, "ColorGradeMidtoneHue", "ColorGradeMidtoneSat", "ColorGradeMidtoneLum"),
                zone(.highlights, "ColorGradeHighlightHue", "ColorGradeHighlightSat", "ColorGradeHighlightLum", "SplitToningHighlightHue", "SplitToningHighlightSaturation"),
                zone(.global, "ColorGradeGlobalHue", "ColorGradeGlobalSat", "ColorGradeGlobalLum"),
            ].compactMap { $0 }
            balance = f("SplitToningBalance") / 100
        }
    }

    /** Curva de tons com interpolação cúbica monótona (não cria ondulações entre os pontos). */
    struct Curve {
        let lut: [Float]?

        init(_ points: [(Double, Double)]?) {
            var seen = Set<Double>()
            let clean = (points ?? [])
                .filter { (0...255).contains($0.0) }
                .sorted { $0.0 < $1.0 }
                .filter { seen.insert($0.0).inserted }
            if clean.count < 2 || clean.allSatisfy({ abs($0.0 - $0.1) < 0.5 }) {
                lut = nil
            } else {
                lut = Curve.build(clean)
            }
        }

        func at(_ x: Float) -> Float {
            guard let table = lut else { return x }
            let pos = clamp(x) * 255
            let i = min(Int(pos), 254)
            let t = pos - Float(i)
            return table[i] + (table[i + 1] - table[i]) * t
        }

        static func build(_ points: [(Double, Double)]) -> [Float] {
            let n = points.count
            let xs: [Double] = points.map { $0.0 }
            let ys: [Double] = points.map { $0.1 }
            var slopes = [Double](repeating: 0, count: n - 1)
            for k in 0..<(n - 1) {
                let dy: Double = ys[k + 1] - ys[k]
                let dx: Double = xs[k + 1] - xs[k]
                slopes[k] = dy / dx
            }
            var m = [Double](repeating: 0, count: n)
            m[0] = slopes[0]
            m[n - 1] = slopes[n - 2]
            if n > 2 {
                for i in 1..<(n - 1) {
                    m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
                }
            }
            for i in 0..<(n - 1) {
                if slopes[i] == 0 {
                    m[i] = 0
                    m[i + 1] = 0
                    continue
                }
                let a: Double = m[i] / slopes[i]
                let b: Double = m[i + 1] / slopes[i]
                let s: Double = a * a + b * b
                if s > 9 {
                    let tau: Double = 3.0 / s.squareRoot()
                    m[i] = tau * a * slopes[i]
                    m[i + 1] = tau * b * slopes[i]
                }
            }
            return (0..<256).map { v in
                let x = Double(v)
                let y: Double
                if x <= xs[0] {
                    y = ys[0]
                } else if x >= xs[n - 1] {
                    y = ys[n - 1]
                } else {
                    var k = 0
                    while x > xs[k + 1] { k += 1 }
                    let h: Double = xs[k + 1] - xs[k]
                    let t: Double = (x - xs[k]) / h
                    let t2: Double = t * t
                    let t3: Double = t2 * t
                    let h00: Double = 2 * t3 - 3 * t2 + 1
                    let h10: Double = t3 - 2 * t2 + t
                    let h01: Double = -2 * t3 + 3 * t2
                    let h11: Double = t3 - t2
                    let left: Double = h00 * ys[k] + h10 * h * m[k]
                    let right: Double = h01 * ys[k + 1] + h11 * h * m[k + 1]
                    y = left + right
                }
                return Float(min(max(y / 255, 0), 1))
            }
        }
    }

    // MARK: - Cor

    static let hueRange: Float = 30
    static let bands = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"]
    static let centers: [Float] = [0, 30, 60, 120, 180, 240, 270, 300, 360]

    /** Faixa de cor do HSL do Lightroom em que o matiz cai, a seguinte e a posição entre as duas. */
    static func band(_ hue: Float) -> (Int, Int, Float) {
        let h = (hue.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        var i = 0
        while h >= centers[i + 1] { i += 1 }
        let t = (h - centers[i]) / (centers[i + 1] - centers[i])
        return (i, (i + 1) % 8, t)
    }
}

@inline(__always) func clamp(_ v: Float) -> Float { min(max(v, 0), 1) }

func linear(_ c: Float) -> Float { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }

func gamma(_ c0: Float) -> Float {
    let c = max(c0, 0)
    return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1 / 2.4) - 0.055
}

func smoothstep(_ a: Float, _ b: Float, _ x: Float) -> Float {
    let t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}

func rgbToHsl(_ r: Float, _ g: Float, _ b: Float) -> (Float, Float, Float) {
    let mx = max(r, g, b)
    let mn = min(r, g, b)
    let l = (mx + mn) / 2
    if mx - mn < 1e-6 { return (0, 0, l) }
    let d = mx - mn
    let s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    var h: Float
    if mx == r {
        h = (g - b) / d + (g < b ? 6 : 0)
    } else if mx == g {
        h = (b - r) / d + 2
    } else {
        h = (r - g) / d + 4
    }
    h *= 60
    return (h, s, l)
}

func hslToRgb(_ h0: Float, _ s: Float, _ l: Float) -> (Float, Float, Float) {
    if s <= 0 { return (l, l, l) }
    let h = (h0.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 360
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s
    let p = 2 * l - q
    func channel(_ t0: Float) -> Float {
        var t = t0
        if t < 0 { t += 1 }
        if t > 1 { t -= 1 }
        if t < 1 / 6 { return p + (q - p) * 6 * t }
        if t < 0.5 { return q }
        if t < 2 / 3 { return p + (q - p) * (2 / 3 - t) * 6 }
        return p
    }
    return (channel(h + 1 / 3), channel(h), channel(h - 1 / 3))
}
