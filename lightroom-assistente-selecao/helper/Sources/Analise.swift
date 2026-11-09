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
}

enum Analise {
    /// Limite do que conta como "quase preto" e "estourado".
    static let limiteSombra = 12
    static let limiteEstouro = 250

    static func medir(_ img: ImagemCinza) -> Medidas {
        let w = img.largura, h = img.altura, n = w * h
        guard n > 0 else { return Medidas(media: 0, sombras: 0, estouro: 0, nitidez: 0) }

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
        return Medidas(media: media, sombras: sombras, estouro: estouro, nitidez: nitidez)
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
        let alto = percentil(0.99)
        // Faixa mínima: imagens realmente sem contraste não são "esticadas" demais.
        let faixa = Double(max(alto - baixo, 48))
        var tabela = [Float](repeating: 0, count: 256)
        for i in 0..<256 {
            tabela[i] = Float(min(max(Double(i - baixo) / faixa * 255.0, 0), 255))
        }

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
}
