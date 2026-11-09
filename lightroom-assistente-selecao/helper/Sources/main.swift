// assistente-analise: programa auxiliar chamado pelo plugin do Lightroom.
//
// Uso:
//   assistente-analise --lista <arquivo com um caminho por linha> --saida <arquivo.tsv> [--visao] [--margem 0.02]
//   assistente-analise <foto1.jpg> <foto2.jpg> ...      (resultado na saída padrão)
//   assistente-analise --versao
//
// --visao  liga rostos/olhos e pose do corpo (só macOS)
// --margem distância da borda, em fração do lado maior, que conta como "encostado na borda"
//
// Saída (TSV, uma linha por foto, na mesma ordem da entrada):
//   caminho media sombras estouro nitidez rostos abertura_olhos pessoas cortadas partes erro
// (rostos..partes ficam vazios quando --visao não foi usado)

import Foundation
#if canImport(ImageIO)
import CoreGraphics
import ImageIO
#endif

let versao = "0.2.0"
/// Lado maior usado na análise. As medidas de nitidez dependem do tamanho,
/// por isso toda foto é reduzida para o mesmo tamanho antes de medir.
let ladoAnalise = 1024

enum ErroLeitura: Error, CustomStringConvertible {
    case naoAbriu(String)
    case formato(String)
    var description: String {
        switch self {
        case .naoAbriu(let s): return "nao abriu: \(s)"
        case .formato(let s): return "formato: \(s)"
        }
    }
}

// MARK: - Leitura de imagens

/// PGM binário (P5). Usado nos testes, em qualquer sistema.
func lerPGM(_ caminho: String) throws -> ImagemCinza {
    guard let dados = FileManager.default.contents(atPath: caminho) else { throw ErroLeitura.naoAbriu(caminho) }
    let bytes = [UInt8](dados)
    var pos = 0
    func token() -> String {
        while pos < bytes.count {
            if bytes[pos] == UInt8(ascii: "#") {
                while pos < bytes.count && bytes[pos] != 10 { pos += 1 }
            } else if bytes[pos] == 32 || bytes[pos] == 10 || bytes[pos] == 13 || bytes[pos] == 9 {
                pos += 1
            } else { break }
        }
        let inicio = pos
        while pos < bytes.count && !(bytes[pos] == 32 || bytes[pos] == 10 || bytes[pos] == 13 || bytes[pos] == 9) { pos += 1 }
        return String(decoding: bytes[inicio..<pos], as: UTF8.self)
    }
    guard token() == "P5", let w = Int(token()), let h = Int(token()), let maximo = Int(token()), maximo == 255 else {
        throw ErroLeitura.formato("PGM invalido")
    }
    pos += 1
    guard bytes.count - pos >= w * h else { throw ErroLeitura.formato("PGM curto") }
    return ImagemCinza(largura: w, altura: h, pixels: Array(bytes[pos..<(pos + w * h)]))
}

#if canImport(ImageIO)
func abrirFonte(_ caminho: String) throws -> CGImageSource {
    let url = URL(fileURLWithPath: caminho) as CFURL
    guard let fonte = CGImageSourceCreateWithURL(url, nil) else { throw ErroLeitura.naoAbriu(caminho) }
    return fonte
}

/// Imagem colorida, já na orientação certa, com no máximo `lado` pixels no lado maior.
func lerColorida(_ fonte: CGImageSource, lado: Int) throws -> CGImage {
    let opcoes: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceThumbnailMaxPixelSize: lado,
    ]
    guard let cg = CGImageSourceCreateThumbnailAtIndex(fonte, 0, opcoes as CFDictionary) else {
        throw ErroLeitura.formato("nao decodificou")
    }
    return cg
}

/// JPEG/HEIC/PNG/TIFF via ImageIO, já reduzida e convertida para cinza.
func lerImagemApple(_ fonte: CGImageSource) throws -> ImagemCinza {
    let cg = try lerColorida(fonte, lado: ladoAnalise)
    let w = cg.width, h = cg.height
    var pixels = [UInt8](repeating: 0, count: w * h)
    let ok = pixels.withUnsafeMutableBytes { buf -> Bool in
        guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
        ctx.interpolationQuality = .high
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return true
    }
    guard ok else { throw ErroLeitura.formato("contexto grafico") }
    return ImagemCinza(largura: w, altura: h, pixels: pixels)
}
#endif

func lerImagem(_ caminho: String) throws -> ImagemCinza {
    if caminho.lowercased().hasSuffix(".pgm") { return try lerPGM(caminho) }
    #if canImport(ImageIO)
    return try lerImagemApple(try abrirFonte(caminho))
    #else
    throw ErroLeitura.formato("so PGM fora do macOS")
    #endif
}

struct Opcoes {
    var visao = false
    var margem = 0.02
}

/// Rostos e pessoas da foto. Usa a imagem inteira (até 2048 px), não a versão reduzida.
func detectarPessoas(_ caminho: String, _ opcoes: Opcoes) throws -> (ResultadoRostos, ResultadoPessoas) {
    #if canImport(Vision)
    guard #available(macOS 11.0, *) else { throw ErroLeitura.formato("precisa do macOS 11 ou superior") }
    let imagem = try lerColorida(try abrirFonte(caminho), lado: 2048)
    let (rostos, pessoas) = try Visao.detectar(imagem)
    return (Regras.avaliarRostos(rostos),
            Regras.avaliarPessoas(pessoas, largura: Double(imagem.width), altura: Double(imagem.height), margem: opcoes.margem))
    #else
    throw ErroLeitura.formato("deteccao de rostos so no macOS")
    #endif
}

// MARK: - Execução

func formatar(_ v: Double) -> String { String(format: "%.5f", v) }

func linhaResultado(_ caminho: String, _ opcoes: Opcoes) -> String {
    do {
        let m = Analise.medir(try lerImagem(caminho))
        var campos = [caminho, formatar(m.media), formatar(m.sombras), formatar(m.estouro), formatar(m.nitidez)]
        var erro = ""
        if opcoes.visao {
            do {
                let (r, p) = try detectarPessoas(caminho, opcoes)
                campos += [String(r.rostos), r.menorAbertura.map(formatar) ?? "", String(p.pessoas),
                           String(p.cortadas), p.partes.sorted().joined(separator: ",")]
            } catch {
                campos += ["", "", "", "", ""]
                erro = "visao: \(error)"
            }
        } else {
            campos += ["", "", "", "", ""]
        }
        return (campos + [limpar(erro)]).joined(separator: "\t")
    } catch {
        return [caminho, "", "", "", "", "", "", "", "", "", limpar("\(error)")].joined(separator: "\t")
    }
}

func limpar(_ s: String) -> String {
    s.replacingOccurrences(of: "\t", with: " ").replacingOccurrences(of: "\n", with: " ")
}

final class Resultados: @unchecked Sendable {
    private var linhas: [String]
    private let trava = NSLock()
    init(_ n: Int) { linhas = [String](repeating: "", count: n) }
    func guardar(_ i: Int, _ s: String) { trava.lock(); linhas[i] = s; trava.unlock() }
    var todas: [String] { trava.lock(); defer { trava.unlock() }; return linhas }
}

func principal() -> Int32 {
    var args = Array(CommandLine.arguments.dropFirst())
    var arquivoLista: String?
    var arquivoSaida: String?
    var caminhos: [String] = []
    var opcoes = Opcoes()

    while !args.isEmpty {
        let a = args.removeFirst()
        switch a {
        case "--versao", "--version":
            print("assistente-analise \(versao)")
            return 0
        case "--lista":
            guard !args.isEmpty else { fputs("--lista precisa de um arquivo\n", stderr); return 2 }
            arquivoLista = args.removeFirst()
        case "--saida":
            guard !args.isEmpty else { fputs("--saida precisa de um arquivo\n", stderr); return 2 }
            arquivoSaida = args.removeFirst()
        case "--visao":
            opcoes.visao = true
        case "--margem":
            guard !args.isEmpty, let v = Double(args.removeFirst()) else { fputs("--margem precisa de um numero\n", stderr); return 2 }
            opcoes.margem = v
        default:
            caminhos.append(a)
        }
    }

    if let lista = arquivoLista {
        guard let texto = try? String(contentsOfFile: lista, encoding: .utf8) else {
            fputs("nao li a lista \(lista)\n", stderr); return 1
        }
        caminhos += texto.split(whereSeparator: { $0 == "\n" || $0 == "\r" }).map(String.init).filter { !$0.isEmpty }
    }
    guard !caminhos.isEmpty else {
        fputs("uso: assistente-analise --lista arquivo.txt --saida resultado.tsv\n", stderr); return 2
    }

    let resultados = Resultados(caminhos.count)
    DispatchQueue.concurrentPerform(iterations: caminhos.count) { i in
        resultados.guardar(i, linhaResultado(caminhos[i], opcoes))
    }
    let texto = "caminho\tmedia\tsombras\testouro\tnitidez\trostos\tabertura_olhos\tpessoas\tcortadas\tpartes\terro\n" + resultados.todas.joined(separator: "\n") + "\n"

    if let saida = arquivoSaida {
        do { try texto.write(toFile: saida, atomically: true, encoding: .utf8) } catch {
            fputs("nao gravei \(saida): \(error)\n", stderr); return 1
        }
    } else {
        print(texto, terminator: "")
    }
    return 0
}

exit(principal())
