// Núcleo da análise: só aritmética sobre uma imagem em tons de cinza.
// Não depende de nenhum framework da Apple, então pode ser testado em qualquer sistema.

import Foundation

/// Imagem em tons de cinza, 8 bits por pixel, linha a linha.
struct ImagemCinza {
    let largura: Int
    let altura: Int
    let pixels: [UInt8]
}

/// Medidas brutas de uma foto. A decisão (escura / clara / sem foco) fica no plugin,
/// para que os limites possam ser ajustados sem reanalisar nada.
struct Medidas {
    /// Brilho médio, de 0 (preto) a 1 (branco).
    var media: Double
    /// Fração dos pixels quase pretos (valor <= 12 de 255).
    var sombras: Double
    /// Fração dos pixels estourados (valor >= 250 de 255).
    var estouro: Double
    /// Nitidez das regiões mais nítidas da foto. Quanto maior, mais nítida.
    var nitidez: Double
    /// Indício de tremido (0 = nada; ~0,12+ = provável). Ver medirTremor.
    var tremor: Double
    /// "Impressão digital" da imagem (dHash 64 bits, 16 caracteres hex) para achar duplicadas.
    var assinatura: String
}

enum Analise {
    /// Limite do que conta como "quase preto" e "estourado".
    static let limiteSombra = 12
    static let limiteEstouro = 250

    static func medir(_ img: ImagemCinza) -> Medidas {
        let w = img.largura, h = img.altura, n = w * h
        guard n > 0 else { return Medidas(media: 0, sombras: 0, estouro: 0, nitidez: 0, tremor: 0, assinatura: "") }

        // Histograma e média
        var hist = [Int](repeating: 0, count: 256)
        var soma = 0
        img.pixels.withUnsafeBufferPointer { p in
            for v in p {
                hist[Int(v)] += 1
                soma += Int(v)
            }
        }
        let media = Double(soma) / Double(n) / 255.0
        let sombras = Double(hist[0...limiteSombra].reduce(0, +)) / Double(n)
        let estouro = Double(hist[limiteEstouro...255].reduce(0, +)) / Double(n)

        let nitidez = medirNitidez(img, hist: hist)
        return Medidas(media: media, sombras: sombras, estouro: estouro, nitidez: nitidez,
                       tremor: medirTremor(img, hist: hist), assinatura: assinatura(img))
    }

    /// Tabela que estica o contraste entre os percentis 1% e 99% (mínimo de 48 níveis).
    static func tabelaContraste(_ hist: [Int], _ n: Int) -> [Float] {
        func percentil(_ q: Double) -> Int {
            let alvo = Int(Double(n) * q)
            var acumulado = 0
            for i in 0..<256 {
                acumulado += hist[i]
                if acumulado > alvo { return i }
            }
            return 255
        }
        let baixo = percentil(0.01)
        let faixa = Double(max(percentil(0.99) - baixo, 48))
        return (0..<256).map { i in Float(min(max(Double(i - baixo) / faixa * 255.0, 0), 255)) }
    }

    /// Nitidez = desvio padrão do Laplaciano nos blocos mais nítidos da imagem.
    ///
    /// - Antes, o contraste é normalizado (percentis 1% e 99%), para que uma foto escura
    ///   mas focada não pareça "sem foco" só por ter pouco contraste.
    /// - A imagem é dividida em blocos e só os ~10% mais nítidos contam. Assim um fundo
    ///   desfocado de propósito (bokeh) não derruba a nota de quem está em foco.
    static func medirNitidez(_ img: ImagemCinza, hist: [Int]) -> Double {
        let w = img.largura, h = img.altura, n = w * h
        guard w >= 8, h >= 8 else { return 0 }
        let tabela = tabelaContraste(hist, n)

        let lado = max(16, max(w, h) / 16)
        let blocosX = (w - 2 + lado - 1) / lado
        let blocosY = (h - 2 + lado - 1) / lado
        var somaB = [Double](repeating: 0, count: blocosX * blocosY)
        var somaQ = [Double](repeating: 0, count: blocosX * blocosY)
        var contB = [Int](repeating: 0, count: blocosX * blocosY)

        img.pixels.withUnsafeBufferPointer { p in
            tabela.withUnsafeBufferPointer { t in
                for y in 1..<(h - 1) {
                    let linha = y * w
                    let by = (y - 1) / lado
                    var somaLinhaB = [Double](repeating: 0, count: blocosX)
                    var somaLinhaQ = [Double](repeating: 0, count: blocosX)
                    var contLinha = [Int](repeating: 0, count: blocosX)
                    for x in 1..<(w - 1) {
                        let i = linha + x
                        let c = t[Int(p[i])]
                        let lap = 4 * c - t[Int(p[i - 1])] - t[Int(p[i + 1])] - t[Int(p[i - w])] - t[Int(p[i + w])]
                        let bx = (x - 1) / lado
                        let l = Double(lap)
                        somaLinhaB[bx] += l
                        somaLinhaQ[bx] += l * l
                        contLinha[bx] += 1
                    }
                    for bx in 0..<blocosX {
                        let k = by * blocosX + bx
                        somaB[k] += somaLinhaB[bx]
                        somaQ[k] += somaLinhaQ[bx]
                        contB[k] += contLinha[bx]
                    }
                }
            }
        }

        // Variância por bloco (ignora blocos de borda muito pequenos)
        let minimo = (lado * lado) / 4
        var variancias: [Double] = []
        variancias.reserveCapacity(somaB.count)
        for k in 0..<somaB.count where contB[k] >= minimo {
            let c = Double(contB[k])
            let m = somaB[k] / c
            variancias.append(max(somaQ[k] / c - m * m, 0))
        }
        guard !variancias.isEmpty else { return 0 }
        variancias.sort(by: >)
        let topo = min(variancias.count, max(3, variancias.count / 10))
        let mediaTopo = variancias[0..<topo].reduce(0, +) / Double(topo)
        return mediaTopo.squareRoot()
    }

    /// Tremido: o borrão de movimento tira detalhe numa direção só, a mesma na foto inteira.
    ///
    /// Para cada direção (0°, 45°, 90°, 135°) compara a energia das diferenças entre pixels
    /// vizinhos (distância 1) com a de pixels a distância 2, nos 25% de blocos com mais textura.
    /// - Num borrão, a diferença a 1 px cai mais que a 2 px *só na direção do movimento*.
    ///   Desfoque comum afeta todas as direções igualmente e não conta como tremido.
    /// - Somamos um segundo indício: as direções mais fracas de cada bloco concordarem entre si.
    static func medirTremor(_ img: ImagemCinza, hist: [Int]) -> Double {
        let w = img.largura, h = img.altura
        guard w >= 16, h >= 16 else { return 0 }
        let tabela = tabelaContraste(hist, w * h)
        let direcoes = [(0, 1), (-1, 1), (1, 0), (1, 1)] // (dy, dx): 0°, 45°, 90°, 135°
        let lado = max(16, max(w, h) / 16)
        let bx = (w - 4) / lado, by = (h - 4) / lado
        guard bx > 0, by > 0 else { return 0 }
        // e1[bloco*4 + d]: distância 1;  e2[bloco*4 + d]: distância 2
        var e1 = [Double](repeating: 0, count: bx * by * 4)
        var e2 = [Double](repeating: 0, count: bx * by * 4)

        img.pixels.withUnsafeBufferPointer { p in
            tabela.withUnsafeBufferPointer { t in
                for y in 2..<(2 + by * lado) {
                    let bloY = (y - 2) / lado
                    for x in 2..<(2 + bx * lado) {
                        let k = (bloY * bx + (x - 2) / lado) * 4
                        let c = t[Int(p[y * w + x])]
                        for d in 0..<4 {
                            let (dy, dx) = direcoes[d]
                            let v1 = t[Int(p[(y + dy) * w + x + dx])] - c
                            let v2 = t[Int(p[(y + 2 * dy) * w + x + 2 * dx])] - c
                            e1[k + d] += Double(v1 * v1)
                            e2[k + d] += Double(v2 * v2)
                        }
                    }
                }
            }
        }

        let blocos = bx * by
        func textura(_ b: Int) -> Double { e2[b * 4] + e2[b * 4 + 1] + e2[b * 4 + 2] + e2[b * 4 + 3] }
        let topo = (0..<blocos).sorted { textura($0) > textura($1) }.prefix(max(3, blocos / 4))

        // Indício 1: razão (1 px / 2 px) por direção, somada nos blocos de textura
        var s1 = [Double](repeating: 0, count: 4), s2 = [Double](repeating: 0, count: 4)
        // Indício 2: concordância das direções fracas entre os blocos
        var somaA = 0.0, somaB = 0.0
        for k in topo {
            for d in 0..<4 { s1[d] += e1[k * 4 + d]; s2[d] += e2[k * 4 + d] }
            somaA += (e1[k * 4] - e1[k * 4 + 2]) / (e1[k * 4] + e1[k * 4 + 2] + 1e-9)
            somaB += (e1[k * 4 + 1] - e1[k * 4 + 3]) / (e1[k * 4 + 1] + e1[k * 4 + 3] + 1e-9)
        }
        guard s2.allSatisfy({ $0 > 0 }) else { return 0 }
        let r = (0..<4).map { s1[$0] / s2[$0] }
        let a = (r[0] - r[2]) / (r[0] + r[2]), b = (r[1] - r[3]) / (r[1] + r[3])
        let indicio1 = (a * a + b * b).squareRoot()
        let n = Double(topo.count)
        let indicio2 = ((somaA / n) * (somaA / n) + (somaB / n) * (somaB / n)).squareRoot()
        return indicio1 + 0.2 * indicio2
    }

    /// dHash: reduz a foto a 9×8 (média por área) e compara cada ponto com o vizinho da direita.
    /// Fotos quase iguais diferem em poucos dos 64 bits.
    static func assinatura(_ img: ImagemCinza) -> String {
        let w = img.largura, h = img.altura
        guard w >= 9, h >= 8 else { return "" }
        var media = [Double](repeating: 0, count: 9 * 8)
        img.pixels.withUnsafeBufferPointer { p in
            for gy in 0..<8 {
                let y0 = gy * h / 8, y1 = (gy + 1) * h / 8
                for gx in 0..<9 {
                    let x0 = gx * w / 9, x1 = (gx + 1) * w / 9
                    var soma = 0
                    for y in y0..<y1 { for x in x0..<x1 { soma += Int(p[y * w + x]) } }
                    media[gy * 9 + gx] = Double(soma) / Double(max((y1 - y0) * (x1 - x0), 1))
                }
            }
        }
        var bits: UInt64 = 0
        for gy in 0..<8 {
            for gx in 0..<8 where media[gy * 9 + gx] < media[gy * 9 + gx + 1] {
                bits |= UInt64(1) << UInt64(gy * 8 + gx)
            }
        }
        return String(format: "%016llx", bits)
    }
}
