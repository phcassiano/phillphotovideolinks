import Foundation

/**
 * Câmera Sony no modo "PC Remoto": extensões SDIO do PTP (as mesmas do Imaging Edge, do
 * libgphoto2 e do app Android, SonyCamera.kt). A cada disparo, a foto fica esperando no objeto
 * 0xFFFFC001, e o ajuste 0xD215 diz quantas há (acima de 0x8000).
 */
public enum SonyProtocol {
    public static let usbVendor = 0x054C

    public static let ocSdioConnect: UInt16 = 0x9201
    public static let ocSdioGetExtDeviceInfo: UInt16 = 0x9202
    public static let ocGetAllPropData: UInt16 = 0x9209

    public static let propObjectInMemory = 0xD215
    public static let handleShot: UInt32 = 0xFFFF_C001

    public struct Prop: Equatable {
        public let code: Int
        public let type: Int
        public let current: Int64
    }

    /** Há foto esperando para baixar? */
    public static func hasPendingShot(_ props: [Int: Prop]) -> Bool {
        (props[propObjectInMemory]?.current ?? 0) > 0x8000
    }

    /**
     * As câmeras mais novas (protocolo 3) mandam duas listas de valores por ajuste, as antigas
     * uma só. Lê do dois jeitos e fica com o que fecha certinho com a contagem declarada.
     */
    public static func parseAllProps(_ data: Data) -> [Int: Prop] {
        guard data.count > 8, let declared = try? PtpReader(data).u32() else { return [:] }
        let attempts = [parse(data, twoLists: false), parse(data, twoLists: true)]
        if let best = attempts.first(where: { $0.complete && $0.props.count == Int(declared) }) { return best.props }
        if let complete = attempts.first(where: { $0.complete }) { return complete.props }
        return attempts.max { $0.props.count < $1.props.count }?.props ?? [:]
    }

    private static func parse(_ data: Data, twoLists: Bool) -> (props: [Int: Prop], complete: Bool) {
        let r = PtpReader(data, at: 8)
        var out: [Int: Prop] = [:]
        do {
            while r.remaining > 0 {
                let p = try readProp(r, twoLists: twoLists)
                out[p.code] = p
            }
            return (out, true)
        } catch {
            return (out, false)
        }
    }

    private static func readProp(_ r: PtpReader, twoLists: Bool) throws -> Prop {
        let code = Int(try r.u16())
        let type = Int(try r.u16())
        _ = try r.u8() // get/set
        _ = try r.u8() // ligado
        _ = try readValue(r, type) // padrão de fábrica
        let current = try readValue(r, type)
        let form = try r.u8()
        switch form {
        case 0: break
        case 1: for _ in 0..<3 { _ = try readValue(r, type) } // mínimo, máximo, passo
        case 2:
            for _ in 0..<Int(try r.u16()) { _ = try readValue(r, type) }
            if twoLists { for _ in 0..<Int(try r.u16()) { _ = try readValue(r, type) } }
        default: throw PtpError("Formato de ajuste desconhecido: \(form)")
        }
        return Prop(code: code, type: type, current: current)
    }

    private static func readValue(_ r: PtpReader, _ type: Int) throws -> Int64 {
        switch type {
        case 1: return Int64(Int8(bitPattern: try r.u8()))
        case 2: return Int64(try r.u8())
        case 3: return Int64(Int16(bitPattern: try r.u16()))
        case 4: return Int64(try r.u16())
        case 5: return Int64(Int32(bitPattern: try r.u32()))
        case 6: return Int64(try r.u32())
        case 7, 8: return Int64(bitPattern: try r.u64())
        case 9, 10:
            try r.skip(16)
            return 0
        case 0xFFFF:
            _ = try r.string()
            return 0
        default:
            if type & 0x4000 == 0 { throw PtpError("Tipo de dado desconhecido: \(type)") }
            let count = Int(try r.u32())
            if count > r.remaining { throw PtpError("Lista grande demais") }
            for _ in 0..<count { _ = try readValue(r, type & 0x3FFF) }
            return 0
        }
    }
}

/** Nomes de arquivo das fotos (o que vale baixar) e das pastas de sessão. */
public enum PhotoFiles {
    public static let photoExtensions: Set<String> = ["jpg", "jpeg", "arw", "srf", "sr2", "cr2", "cr3", "crw", "nef", "nrw", "dng", "raf", "orf", "rw2", "hif", "heif", "heic", "tif", "tiff"]
    public static let rawExtensions: Set<String> = ["arw", "srf", "sr2", "cr2", "cr3", "crw", "nef", "nrw", "dng", "raf", "orf", "rw2"]

    public static func isPhoto(_ name: String) -> Bool { photoExtensions.contains(ext(name)) }
    public static func isRaw(_ name: String) -> Bool { rawExtensions.contains(ext(name)) }

    static func ext(_ name: String) -> String { (name as NSString).pathExtension.lowercased() }

    /** "Maria Júlia" → "Maria_Julia": seguro em qualquer app e sistema para onde a foto for. */
    public static func prefix(_ name: String) -> String {
        let ascii = name.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "pt_BR"))
        let parts = ascii.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
        let joined = String(parts.joined(separator: "_").prefix(40))
        return joined.isEmpty ? "Foto" : joined
    }

    public static func fileName(prefix: String, number: Int, extension e: String) -> String {
        "\(prefix)_\(String(format: "%03d", number)).\(e.lowercased())"
    }
}
