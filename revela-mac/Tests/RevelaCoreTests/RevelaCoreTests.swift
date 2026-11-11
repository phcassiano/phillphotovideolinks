import XCTest
@testable import RevelaCore

final class PresetTests: XCTestCase {
    let xmp = """
    <x:xmpmeta xmlns:x="adobe:ns:meta/">
     <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
       crs:Version="15.0" crs:Exposure2012="+0.50" crs:Contrast2012="+20" crs:Clarity2012="+10"
       crs:WhiteBalance="As Shot" crs:Temperature="6500" crs:SplitToningShadowHue="220"
       crs:SplitToningShadowSaturation="15">
       <crs:Name><rdf:Alt><rdf:li xml:lang="x-default">Casamento Quente</rdf:li></rdf:Alt></crs:Name>
       <crs:ToneCurvePV2012>
        <rdf:Seq><rdf:li>0, 20</rdf:li><rdf:li>128, 128</rdf:li><rdf:li>255, 240</rdf:li></rdf:Seq>
       </crs:ToneCurvePV2012>
      </rdf:Description>
     </rdf:RDF>
    </x:xmpmeta>
    """

    let lrtemplate = """
    s = {
        id = "ABC",
        title = "Filme Antigo",
        type = "Develop",
        value = {
            settings = {
                Exposure2012 = -0.3,
                Saturation = -25,
                ToneCurvePV2012 = { 0, 30, 255, 255, },
                WhiteBalance = "Custom",
            },
        },
    }
    """

    func testReadsXmpPreset() throws {
        let p = try XCTUnwrap(Preset.parse(fileName: "quente.xmp", data: Data(xmp.utf8)))
        XCTAssertEqual(p.name, "Casamento Quente")
        XCTAssertEqual(p.n("Exposure2012"), 0.5, accuracy: 1e-9)
        XCTAssertEqual(p.n("Contrast2012"), 20, accuracy: 1e-9)
        XCTAssertEqual(p.texts["WhiteBalance"], "As Shot")
        let curve = try XCTUnwrap(p.curves["ToneCurvePV2012"])
        XCTAssertEqual(curve.map { $0.0 }, [0, 128, 255])
        XCTAssertEqual(curve.map { $0.1 }, [20, 128, 240])
    }

    func testReadsLrtemplatePreset() throws {
        let p = try XCTUnwrap(Preset.parse(fileName: "x.lrtemplate", data: Data(lrtemplate.utf8)))
        XCTAssertEqual(p.name, "Filme Antigo")
        XCTAssertEqual(p.n("Exposure2012"), -0.3, accuracy: 1e-9)
        XCTAssertEqual(p.n("Saturation"), -25, accuracy: 1e-9)
        XCTAssertEqual(p.curves["ToneCurvePV2012"]?.map { $0.1 }, [30, 255])
    }

    func testRejectsOtherFiles() {
        XCTAssertNil(Preset.parse(fileName: "foto.txt", data: Data("nada aqui".utf8)))
    }

    private func look(_ values: [String: Double], amount: Float = 1) -> PresetLook {
        PresetLook(preset: Preset(name: "t", numbers: values), amount: amount)
    }

    func testEmptyPresetKeepsColors() {
        let l = look([:])
        for c in [(0.1, 0.5, 0.9), (0.7, 0.2, 0.3), (0.5, 0.5, 0.5)] as [(Float, Float, Float)] {
            let out = l.lookup(c.0, c.1, c.2)
            XCTAssertEqual(out.0, c.0, accuracy: 0.01)
            XCTAssertEqual(out.1, c.1, accuracy: 0.01)
            XCTAssertEqual(out.2, c.2, accuracy: 0.01)
        }
    }

    func testAdjustmentsGoTheRightWay() {
        let grey: Float = 0.5
        XCTAssertGreaterThan(look(["Exposure2012": 1]).lookup(grey, grey, grey).0, 0.6)
        XCTAssertLessThan(look(["Exposure2012": -1]).lookup(grey, grey, grey).0, 0.4)
        let warm = look(["IncrementalTemperature": 50]).lookup(grey, grey, grey)
        XCTAssertGreaterThan(warm.0, warm.2)
        let desat = look(["Saturation": -100]).lookup(0.8, 0.3, 0.1)
        XCTAssertLessThan(abs(desat.0 - desat.2), 0.02)
        let contrast = look(["Contrast2012": 80])
        XCTAssertLessThan(contrast.lookup(0.2, 0.2, 0.2).0, 0.2)
        XCTAssertGreaterThan(contrast.lookup(0.8, 0.8, 0.8).0, 0.8)
    }

    func testIntensityBlendsWithOriginal() {
        let full = look(["Exposure2012": 1]).lookup(0.4, 0.4, 0.4).0
        let half = look(["Exposure2012": 1], amount: 0.5).lookup(0.4, 0.4, 0.4).0
        XCTAssertEqual(half, (0.4 + full) / 2, accuracy: 0.01)
    }

    func testCurveLiftsBlacks() {
        let p = Preset(name: "c", numbers: [:], curves: ["ToneCurvePV2012": [(0, 40), (255, 255)]])
        XCTAssertEqual(PresetLook(preset: p, amount: 1).lookup(0, 0, 0).0, 40 / 255, accuracy: 0.01)
    }

    func testCubeDataHasTheSizeCoreImageExpects() {
        let l = look(["Exposure2012": 0.3])
        XCTAssertEqual(l.cubeData.count, 33 * 33 * 33 * 4 * MemoryLayout<Float>.size)
        XCTAssertEqual(l.effects.vignette, 0)
    }
}

final class PtpTests: XCTestCase {
    final class Packet {
        var data = Data()
        @discardableResult func u8(_ v: Int) -> Packet { data.append(UInt8(truncatingIfNeeded: v)); return self }
        @discardableResult func u16(_ v: Int) -> Packet { u8(v); return u8(v >> 8) }
        @discardableResult func u32(_ v: Int) -> Packet { u16(v); return u16(v >> 16) }
        @discardableResult func u64(_ v: Int) -> Packet { u32(v); return u32(v >> 32) }
    }

    /** F-number com lista, velocidade sem lista e fotos pendentes; [twoLists] imita o protocolo 3. */
    private func allProps(twoLists: Bool) -> Data {
        let p = Packet().u64(3)
        p.u16(0x5007).u16(4).u8(1).u8(1).u16(400).u16(400).u8(2)
        p.u16(3).u16(280).u16(400).u16(560)
        if twoLists { p.u16(3).u16(280).u16(400).u16(560) }
        p.u16(0xD20D).u16(6).u8(1).u8(1).u32(0x000100FA).u32(0x000100FA).u8(0)
        p.u16(0xD215).u16(4).u8(0).u8(1).u16(0).u16(0x8001).u8(1).u16(0).u16(0xFFFF).u16(1)
        return p.data
    }

    func testParsesBothSonyProtocols() {
        for two in [false, true] {
            let props = SonyProtocol.parseAllProps(allProps(twoLists: two))
            XCTAssertEqual(props.count, 3)
            XCTAssertEqual(props[0x5007]?.current, 400)
            XCTAssertEqual(props[0xD20D]?.current, 0x000100FA)
            XCTAssertTrue(SonyProtocol.hasPendingShot(props))
        }
    }

    func testCommandAndResponseBlocks() {
        let cmd = Ptp.command(0x9201, transaction: 7, params: [1, 0, 0])
        XCTAssertEqual([UInt8](cmd), [24, 0, 0, 0, 1, 0, 0x01, 0x92, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        let resp = Packet().u32(16).u16(3).u16(0x2001).u32(7).u32(42).data
        XCTAssertEqual(Ptp.response(resp), Ptp.Response(code: 0x2001, params: [42]))
        XCTAssertNil(Ptp.response(Data([1, 2, 3])))
    }

    func testDataPhaseHeaderIsRemovedOnlyWhenPresent() {
        let body = Data([9, 8, 7])
        let wrapped = Packet().u32(15).u16(2).u16(0x1009).u32(1).data + body
        XCTAssertEqual(Ptp.payload(wrapped, code: 0x1009), body)
        XCTAssertEqual(Ptp.payload(body, code: 0x1009), body)
    }

    func testObjectNameFromObjectInfo() {
        var info = Data(count: 52)
        let name = "DSC01234.ARW"
        info.append(UInt8(name.count + 1))
        for u in name.utf16 { info.appendLE(u) }
        info.appendLE(UInt16(0))
        XCTAssertEqual(Ptp.objectName(info), name)
        XCTAssertNil(Ptp.objectName(Data(count: 52) + Data([0])))
    }

    func testFileNames() {
        XCTAssertEqual(PhotoFiles.prefix("Maria Júlia & Cia"), "Maria_Julia_Cia")
        XCTAssertEqual(PhotoFiles.prefix("!!!"), "Foto")
        XCTAssertEqual(PhotoFiles.fileName(prefix: "Ana", number: 7, extension: "ARW"), "Ana_007.arw")
        XCTAssertTrue(PhotoFiles.isRaw("DSC1.ARW"))
        XCTAssertFalse(PhotoFiles.isPhoto("CLIP.MP4"))
    }
}
