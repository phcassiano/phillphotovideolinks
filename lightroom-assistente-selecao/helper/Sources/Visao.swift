// Detecção de rostos (com contorno dos olhos) e de pose do corpo usando o Vision da Apple.
// Só existe no macOS; converte tudo para as estruturas simples de Pessoas.swift.

#if canImport(Vision)
import CoreGraphics
import CoreImage
import Foundation
import Vision

@available(macOS 11.0, *)
enum Visao {
    static let confiancaMinima: Float = 0.3

    static let nomes: [(VNHumanBodyPoseObservation.JointName, String)] = [
        (.nose, "nariz"), (.leftEye, "olhoE"), (.rightEye, "olhoD"), (.leftEar, "orelhaE"), (.rightEar, "orelhaD"),
        (.neck, "pescoco"), (.leftShoulder, "ombroE"), (.rightShoulder, "ombroD"),
        (.leftElbow, "cotoveloE"), (.rightElbow, "cotoveloD"), (.leftWrist, "pulsoE"), (.rightWrist, "pulsoD"),
        (.leftHip, "quadrilE"), (.rightHip, "quadrilD"), (.leftKnee, "joelhoE"), (.rightKnee, "joelhoD"),
        (.leftAnkle, "tornozeloE"), (.rightAnkle, "tornozeloD"),
    ]

    /// Criar um CIDetector é caro (monta um contexto gráfico): cada thread cria o seu uma vez só.
    static func detectorDaThread() -> CIDetector? {
        let chave = "assistente.ciDetector"
        if let pronto = Thread.current.threadDictionary[chave] as? CIDetector { return pronto }
        let contexto = CIContext(options: [.useSoftwareRenderer: false])
        let novo = CIDetector(ofType: CIDetectorTypeFace, context: contexto,
                              options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
        Thread.current.threadDictionary[chave] = novo
        return novo
    }

    /// Sorrisos pelo detector do Core Image: lista de (retângulo do rosto em pixels, origem no
    /// canto superior esquerdo; está sorrindo?).
    static func sorrisosCoreImage(_ imagem: CGImage) -> [(CGRect, Bool)] {
        guard let detector = detectorDaThread() else { return [] }
        let altura = CGFloat(imagem.height)
        let rostos = detector.features(in: CIImage(cgImage: imagem), options: [CIDetectorSmile: true])
        return rostos.compactMap { f in
            guard let face = f as? CIFaceFeature else { return nil }
            let b = face.bounds
            return (CGRect(x: b.minX, y: altura - b.maxY, width: b.width, height: b.height), face.hasSmile)
        }
    }

    /// Roda as detecções na mesma imagem.
    static func detectar(_ imagem: CGImage, comSorriso: Bool = true) throws -> (rostos: [Rosto], pessoas: [Pessoa]) {
        let largura = Double(imagem.width), altura = Double(imagem.height)
        let tamanho = CGSize(width: largura, height: altura)

        let pedidoRostos = VNDetectFaceLandmarksRequest()
        let pedidoCorpos = VNDetectHumanBodyPoseRequest()
        let manipulador = VNImageRequestHandler(cgImage: imagem, orientation: .up, options: [:])
        try manipulador.perform([pedidoRostos, pedidoCorpos])

        // Vision usa origem no canto inferior esquerdo; aqui convertemos para o superior esquerdo.
        func converter(_ p: CGPoint) -> Ponto { Ponto(x: Double(p.x), y: altura - Double(p.y)) }

        let sorrisos = comSorriso ? sorrisosCoreImage(imagem) : []

        var rostos: [Rosto] = []
        for face in pedidoRostos.results ?? [] {
            let caixa = face.boundingBox
            let alturaRosto = Double(caixa.height) * altura
            let marcas = face.landmarks
            var rosto = Rosto(
                altura: alturaRosto,
                olhoEsquerdo: marcas?.leftEye?.pointsInImage(imageSize: tamanho).map(converter) ?? [],
                olhoDireito: marcas?.rightEye?.pointsInImage(imageSize: tamanho).map(converter) ?? [])
            rosto.largura = Double(caixa.width) * largura
            rosto.labiosExternos = marcas?.outerLips?.pointsInImage(imageSize: tamanho).map(converter) ?? []
            rosto.labiosInternos = marcas?.innerLips?.pointsInImage(imageSize: tamanho).map(converter) ?? []
            rosto.giro = face.yaw?.doubleValue

            // Associa o rosto do Core Image cujo centro cai dentro deste rosto do Vision
            let retangulo = CGRect(x: Double(caixa.minX) * largura, y: (1 - Double(caixa.maxY)) * altura,
                                   width: Double(caixa.width) * largura, height: alturaRosto)
            if let par = sorrisos.first(where: { retangulo.contains(CGPoint(x: $0.0.midX, y: $0.0.midY)) }) {
                rosto.sorrisoDetector = par.1
            }
            rostos.append(rosto)
        }

        var pessoas: [Pessoa] = []
        for corpo in pedidoCorpos.results ?? [] {
            guard let pontos = try? corpo.recognizedPoints(.all) else { continue }
            var juntas: [String: Ponto] = [:]
            for (junta, nome) in nomes {
                guard let p = pontos[junta], p.confidence >= confiancaMinima else { continue }
                juntas[nome] = Ponto(x: Double(p.location.x) * largura, y: (1 - Double(p.location.y)) * altura)
            }
            pessoas.append(Pessoa(juntas: juntas))
        }
        return (rostos, pessoas)
    }
}
#endif
