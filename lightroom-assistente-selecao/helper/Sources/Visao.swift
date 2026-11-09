// Detecção de rostos (com contorno dos olhos) e de pose do corpo usando o Vision da Apple.
// Só existe no macOS; converte tudo para as estruturas simples de Pessoas.swift.

#if canImport(Vision)
import CoreGraphics
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

    /// Roda as duas detecções na mesma imagem.
    static func detectar(_ imagem: CGImage) throws -> (rostos: [Rosto], pessoas: [Pessoa]) {
        let largura = Double(imagem.width), altura = Double(imagem.height)
        let tamanho = CGSize(width: largura, height: altura)

        let pedidoRostos = VNDetectFaceLandmarksRequest()
        let pedidoCorpos = VNDetectHumanBodyPoseRequest()
        let manipulador = VNImageRequestHandler(cgImage: imagem, orientation: .up, options: [:])
        try manipulador.perform([pedidoRostos, pedidoCorpos])

        // Vision usa origem no canto inferior esquerdo; aqui convertemos para o superior esquerdo.
        func converter(_ p: CGPoint) -> Ponto { Ponto(x: Double(p.x), y: altura - Double(p.y)) }

        var rostos: [Rosto] = []
        for face in pedidoRostos.results ?? [] {
            let alturaRosto = Double(face.boundingBox.height) * altura
            let olhoE = face.landmarks?.leftEye?.pointsInImage(imageSize: tamanho).map(converter) ?? []
            let olhoD = face.landmarks?.rightEye?.pointsInImage(imageSize: tamanho).map(converter) ?? []
            rostos.append(Rosto(altura: alturaRosto, olhoEsquerdo: olhoE, olhoDireito: olhoD))
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
