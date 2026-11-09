// Regras de "olhos fechados" e "pessoa cortada".
// Recebe pontos já convertidos para pixels (origem no canto superior esquerdo, y para baixo),
// sem depender do Vision, para poder ser testado em qualquer sistema.

import Foundation

struct Ponto {
    var x: Double
    var y: Double
}

/// Um rosto encontrado: altura do rosto em pixels e o contorno de cada olho.
struct Rosto {
    var altura: Double
    var olhoEsquerdo: [Ponto]
    var olhoDireito: [Ponto]
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
        for rosto in principais {
            let olhos = [abertura(rosto.olhoEsquerdo), abertura(rosto.olhoDireito)].compactMap { $0 }
            guard !olhos.isEmpty else { continue }
            let media = olhos.reduce(0, +) / Double(olhos.count)
            r.menorAbertura = min(r.menorAbertura ?? media, media)
        }
        return r
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
