// Regras de "olhos fechados", "pessoa cortada" e da expressão (sorriso etc.).
// Recebe pontos já convertidos para pixels (origem no canto superior esquerdo, y para baixo),
// sem depender do Vision, para poder ser testado em qualquer sistema.

import Foundation

struct Ponto {
    var x: Double
    var y: Double
}

/// Um rosto encontrado: tamanho em pixels, contorno dos olhos e da boca, e para onde está virado.
struct Rosto {
    var altura: Double
    var olhoEsquerdo: [Ponto]
    var olhoDireito: [Ponto]
    /// Largura do rosto em pixels (0 = desconhecida).
    var largura: Double = 0
    /// Contorno externo e interno dos lábios.
    var labiosExternos: [Ponto] = []
    var labiosInternos: [Ponto] = []
    /// Rotação para os lados, em radianos (0 = de frente para a câmera). nil = desconhecida.
    var giro: Double? = nil
    /// Resposta do detector de sorriso da Apple (Core Image). nil = não avaliado.
    var sorrisoDetector: Bool? = nil
}

/// Uma pessoa: articulações encontradas com confiança suficiente.
/// Nomes: nariz, olhoE, olhoD, orelhaE, orelhaD, pescoco, ombroE, ombroD, cotoveloE, cotoveloD,
/// pulsoE, pulsoD, quadrilE, quadrilD, joelhoE, joelhoD, tornozeloE, tornozeloD
struct Pessoa {
    var juntas: [String: Ponto]
}

struct ResultadoRostos {
    var rostos: Int = 0
    /// Menor abertura média dos olhos entre os rostos principais (altura / largura do olho). nil = sem rosto medível.
    var menorAbertura: Double?
    /// Sorriso médio dos rostos principais, de 0 a 1. nil = sem rosto medível.
    var sorriso: Double?
    /// Nota de expressão média dos rostos principais, de 0 a 1 (olhos abertos, sorriso, de frente,
    /// sem careta). nil = sem rosto medível.
    var expressao: Double?
}

/// Medidas da boca de um rosto.
struct Boca {
    /// Quanto os cantos estão acima do centro dos lábios, em fração da largura da boca.
    /// Sorriso ≈ 0,05–0,15; neutro ≈ 0; tristeza/careta < 0.
    var elevacaoCantos: Double
    /// Largura da boca ÷ largura do rosto. Neutro ≈ 0,35–0,40; sorriso largo ≈ 0,45+.
    var larguraRelativa: Double?
    /// Abertura (altura dos lábios internos ÷ largura da boca). Fechada ≈ 0; gritando ≈ 0,5+.
    var abertura: Double
}

struct ResultadoPessoas {
    var pessoas: Int = 0
    var cortadas: Int = 0
    /// Partes cortadas, entre: cabeca, braco, tronco, perna
    var partes: Set<String> = []
}

enum Regras {
    /// Rostos menores que isso (em pixels) não têm olhos confiáveis.
    static let rostoMinimo = 24.0
    /// Só contam rostos/pessoas com pelo menos esta fração do tamanho do maior (os personagens principais).
    static let fracaoPrincipalRosto = 0.4
    static let fracaoPrincipalPessoa = 0.35

    /// Abertura de um olho: altura / largura do contorno. Aberto ~0,25–0,40; fechado ~0,05–0,15.
    static func abertura(_ pontos: [Ponto]) -> Double? {
        guard pontos.count >= 4 else { return nil }
        let xs = pontos.map(\.x), ys = pontos.map(\.y)
        let largura = xs.max()! - xs.min()!
        let altura = ys.max()! - ys.min()!
        guard largura > 1 else { return nil }
        return altura / largura
    }

    static func avaliarRostos(_ rostos: [Rosto]) -> ResultadoRostos {
        var r = ResultadoRostos()
        let validos = rostos.filter { $0.altura >= rostoMinimo }
        guard let maior = validos.map(\.altura).max() else { return r }
        let principais = validos.filter { $0.altura >= maior * fracaoPrincipalRosto }
        r.rostos = principais.count
        var sorrisos: [Double] = [], expressoes: [Double] = []
        for rosto in principais {
            let olhos = [abertura(rosto.olhoEsquerdo), abertura(rosto.olhoDireito)].compactMap { $0 }
            let mediaOlhos = olhos.isEmpty ? nil : olhos.reduce(0, +) / Double(olhos.count)
            if let m = mediaOlhos { r.menorAbertura = min(r.menorAbertura ?? m, m) }
            if let e = expressao(rosto, aberturaOlhos: mediaOlhos) {
                sorrisos.append(e.sorriso)
                expressoes.append(e.nota)
            }
        }
        if !expressoes.isEmpty {
            r.sorriso = sorrisos.reduce(0, +) / Double(sorrisos.count)
            r.expressao = expressoes.reduce(0, +) / Double(expressoes.count)
        }
        return r
    }

    static func medirBoca(_ rosto: Rosto) -> Boca? {
        let externos = rosto.labiosExternos
        guard externos.count >= 6 else { return nil }
        guard let esquerdo = externos.min(by: { $0.x < $1.x }), let direito = externos.max(by: { $0.x < $1.x }) else { return nil }
        let largura = direito.x - esquerdo.x
        guard largura > 2 else { return nil }
        // Centro vertical da boca (y cresce para baixo: cantos "acima" têm y menor).
        // Usa o contorno interno: numa boca aberta de esforço o lábio de baixo desce, mas o centro
        // da abertura acompanha, e os cantos só ficam acima dele se estiverem de fato levantados.
        let referencia = rosto.labiosInternos.count >= 4 ? rosto.labiosInternos : externos
        let centroY = referencia.map(\.y).reduce(0, +) / Double(referencia.count)
        let cantosY = (esquerdo.y + direito.y) / 2
        let elevacao = (centroY - cantosY) / largura
        var aberturaBoca = 0.0
        if rosto.labiosInternos.count >= 4 {
            let ys = rosto.labiosInternos.map(\.y)
            aberturaBoca = (ys.max()! - ys.min()!) / largura
        }
        let relativa = rosto.largura > 0 ? largura / rosto.largura : nil
        return Boca(elevacaoCantos: elevacao, larguraRelativa: relativa, abertura: aberturaBoca)
    }

    static func limitar(_ v: Double) -> Double { min(max(v, 0), 1) }

    /// Sorriso (0–1) e nota de expressão (0–1) de um rosto. nil se não há boca nem olhos medíveis.
    static func expressao(_ rosto: Rosto, aberturaOlhos: Double?) -> (sorriso: Double, nota: Double)? {
        let boca = medirBoca(rosto)
        guard boca != nil || aberturaOlhos != nil else { return nil }

        // Sorriso pela geometria: cantos levantados e boca mais larga que o normal
        var sorriso = 0.0
        if let b = boca {
            let pelosCantos = limitar(b.elevacaoCantos / 0.10)
            if let rel = b.larguraRelativa {
                sorriso = 0.6 * pelosCantos + 0.4 * limitar((rel - 0.38) / 0.10)
            } else {
                sorriso = pelosCantos
            }
        }
        // O detector da Apple, quando disponível, vale metade da nota
        if let detector = rosto.sorrisoDetector {
            sorriso = 0.5 * sorriso + 0.5 * (detector ? 1 : 0)
        }

        let olhos = aberturaOlhos.map { limitar(($0 - 0.10) / 0.18) } ?? 0.7
        let frente = rosto.giro.map { max(0.3, 1 - abs($0) / (Double.pi / 3)) } ?? 0.8
        var nota = 0.45 * olhos + 0.35 * sorriso + 0.20 * frente
        // Careta: boca muito aberta sem sorriso (esforço, grito)
        if let b = boca, b.abertura > 0.45, sorriso < 0.3 { nota *= 0.75 }
        return (sorriso, limitar(nota))
    }

    static func avaliarPessoas(_ pessoas: [Pessoa], largura: Double, altura: Double, margem: Double) -> ResultadoPessoas {
        var r = ResultadoPessoas()
        let m = margem * max(largura, altura)

        func alturaCorpo(_ p: Pessoa) -> Double {
            let ys = p.juntas.values.map(\.y)
            guard let a = ys.min(), let b = ys.max() else { return 0 }
            return b - a
        }
        let candidatas = pessoas.filter { $0.juntas.count >= 4 }
        guard let maior = candidatas.map(alturaCorpo).max(), maior > 0 else { return r }
        let principais = candidatas.filter { alturaCorpo($0) >= maior * fracaoPrincipalPessoa }
        r.pessoas = principais.count

        func perto(_ p: Ponto) -> Bool {
            p.x < m || p.y < m || p.x > largura - m || p.y > altura - m
        }
        func fora(_ p: Ponto) -> Bool {
            p.x < 0 || p.y < 0 || p.x > largura || p.y > altura
        }
        // Extremidade de um membro (ex.: ombro -> cotovelo -> pulso)
        func membroCortado(_ j: [String: Ponto], _ raiz: String, _ meio: String, _ ponta: String) -> Bool {
            if let pt = j[ponta] { return perto(pt) }
            if let me = j[meio] {
                if perto(me) { return true }
                if let ra = j[raiz] {
                    // Ponta sumiu: estima onde ela estaria prolongando o segmento anterior
                    let estimada = Ponto(x: me.x + (me.x - ra.x), y: me.y + (me.y - ra.y))
                    return fora(estimada)
                }
                return false
            }
            if let ra = j[raiz] { return perto(ra) }
            return false
        }

        for pessoa in principais {
            let j = pessoa.juntas
            var partes: Set<String> = []

            // Cabeça: estima o topo da cabeça a partir dos olhos e do pescoço
            let cabeca = ["nariz", "olhoE", "olhoD", "orelhaE", "orelhaD"].compactMap { j[$0] }
            if let pescoco = j["pescoco"] {
                if cabeca.isEmpty {
                    if pescoco.y < altura * 0.25 { partes.insert("cabeca") }
                } else {
                    let olhos = [j["olhoE"], j["olhoD"]].compactMap { $0 }
                    let referencia = olhos.isEmpty ? cabeca : olhos
                    let yOlhos = referencia.map(\.y).reduce(0, +) / Double(referencia.count)
                    let distancia = pescoco.y - yOlhos
                    if distancia > 0 && yOlhos - 0.7 * distancia < 0 { partes.insert("cabeca") }
                }
            } else if cabeca.contains(where: perto) && (cabeca.map(\.y).min() ?? altura) < m {
                partes.insert("cabeca")
            }

            if membroCortado(j, "ombroE", "cotoveloE", "pulsoE") || membroCortado(j, "ombroD", "cotoveloD", "pulsoD") {
                partes.insert("braco")
            }
            if membroCortado(j, "quadrilE", "joelhoE", "tornozeloE") || membroCortado(j, "quadrilD", "joelhoD", "tornozeloD") {
                partes.insert("perna")
            }
            for nome in ["ombroE", "ombroD", "quadrilE", "quadrilD"] {
                if let p = j[nome], p.x < m || p.x > largura - m { partes.insert("tronco") }
            }

            if !partes.isEmpty {
                r.cortadas += 1
                r.partes.formUnion(partes)
            }
        }
        return r
    }
}
