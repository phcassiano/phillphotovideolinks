import Foundation

/** Pacotes do protocolo PTP (câmeras pelo USB), em little-endian. */
public enum Ptp {
    public static let ocOpenSession: UInt16 = 0x1002
    public static let ocCloseSession: UInt16 = 0x1003
    public static let ocGetObjectInfo: UInt16 = 0x1008
    public static let ocGetObject: UInt16 = 0x1009

    public static let rcOk: UInt16 = 0x2001
    public static let rcDeviceBusy: UInt16 = 0x2019

    public static let typeCommand: UInt16 = 1
    public static let typeData: UInt16 = 2
    public static let typeResponse: UInt16 = 3

    /** Bloco de comando: tamanho, tipo, código, transação e até 5 parâmetros. */
    public static func command(_ code: UInt16, transaction: UInt32, params: [UInt32] = []) -> Data {
        var d = Data()
        d.appendLE(UInt32(12 + 4 * params.count))
        d.appendLE(typeCommand)
        d.appendLE(code)
        d.appendLE(transaction)
        for p in params { d.appendLE(p) }
        return d
    }

    public struct Response: Equatable {
        public let code: UInt16
        public let params: [UInt32]
        public var ok: Bool { code == Ptp.rcOk }
    }

    /** Lê o bloco de resposta (12 bytes de cabeçalho e os parâmetros). */
    public static func response(_ data: Data) -> Response? {
        let r = PtpReader(data)
        guard data.count >= 12,
              let length = try? r.u32(), let type = try? r.u16(), let code = try? r.u16(), (try? r.u32()) != nil,
              type == typeResponse else { return nil }
        var params: [UInt32] = []
        let end = min(Int(length), data.count)
        while r.pos + 4 <= end, let p = try? r.u32() { params.append(p) }
        return Response(code: code, params: params)
    }

    /**
     * Fase de dados: algumas versões do macOS entregam só o conteúdo, outras com o cabeçalho
     * de 12 bytes do PTP na frente. Tira o cabeçalho quando ele está lá.
     */
    public static func payload(_ data: Data, code: UInt16) -> Data {
        guard data.count >= 12 else { return data }
        let r = PtpReader(data)
        if let length = try? r.u32(), let type = try? r.u16(), let c = try? r.u16(),
           type == typeData, c == code, Int(length) == data.count {
            return data.subdata(in: data.startIndex.advanced(by: 12)..<data.endIndex)
        }
        return data
    }

    /** Nome do arquivo no ObjectInfo (começa no byte 52). */
    public static func objectName(_ info: Data) -> String? {
        let r = PtpReader(info, at: 52)
        guard let name = try? r.string(), !name.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return name
    }
}

public struct PtpError: Error, CustomStringConvertible {
    public let description: String
    public init(_ description: String) { self.description = description }
}

public final class PtpReader {
    private let bytes: [UInt8]
    public var pos: Int

    public init(_ data: Data, at pos: Int = 0) {
        bytes = [UInt8](data)
        self.pos = pos
    }

    public var remaining: Int { bytes.count - pos }

    private func need(_ n: Int) throws {
        if n < 0 || pos + n > bytes.count { throw PtpError("Pacote PTP terminou antes do esperado") }
    }

    public func u8() throws -> UInt8 {
        try need(1)
        defer { pos += 1 }
        return bytes[pos]
    }

    public func u16() throws -> UInt16 {
        try need(2)
        defer { pos += 2 }
        return UInt16(bytes[pos]) | UInt16(bytes[pos + 1]) << 8
    }

    public func u32() throws -> UInt32 {
        try need(4)
        defer { pos += 4 }
        return (0..<4).reduce(UInt32(0)) { $0 | UInt32(bytes[pos + $1]) << (8 * UInt32($1)) }
    }

    public func u64() throws -> UInt64 {
        try need(8)
        defer { pos += 8 }
        return (0..<8).reduce(UInt64(0)) { $0 | UInt64(bytes[pos + $1]) << (8 * UInt64($1)) }
    }

    public func skip(_ n: Int) throws {
        try need(n)
        pos += n
    }

    /** Texto PTP: quantidade de caracteres (com o zero final) e UTF-16LE. */
    public func string() throws -> String {
        let chars = Int(try u8())
        if chars == 0 { return "" }
        try need(chars * 2)
        let units = (0..<chars).map { UInt16(bytes[pos + 2 * $0]) | UInt16(bytes[pos + 2 * $0 + 1]) << 8 }
        pos += chars * 2
        return String(decoding: units, as: UTF16.self).trimmingCharacters(in: CharacterSet(charactersIn: "\u{0}"))
    }
}

extension Data {
    mutating func appendLE<T: FixedWidthInteger>(_ value: T) {
        var v = value.littleEndian
        Swift.withUnsafeBytes(of: &v) { append(contentsOf: $0) }
    }
}
