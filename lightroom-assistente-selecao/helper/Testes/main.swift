// Testes das regras (rodam em qualquer sistema):
//   swiftc Sources/Analise.swift Sources/Pessoas.swift Testes/main.swift -o /tmp/testes && /tmp/testes
import Foundation

var falhas = 0
func confere(_ nome: String, _ ok: Bool, _ detalhe: String = "") {
    print((ok ? "OK    " : "FALHA ") + nome + (detalhe.isEmpty ? "" : "  (\(detalhe))"))
    if !ok { falhas += 1 }
}

// Olho como elipse com 8 pontos
func olho(cx: Double, cy: Double, largura: Double, abertura: Double) -> [Ponto] {
    (0..<8).map { i in
        let a = Double(i) / 8 * 2 * .pi
        return Ponto(x: cx + cos(a) * largura / 2, y: cy + sin(a) * largura * abertura / 2)
    }
}
func rosto(altura: Double, abertura: Double) -> Rosto {
    Rosto(altura: altura, olhoEsquerdo: olho(cx: 0, cy: 0, largura: altura / 5, abertura: abertura),
          olhoDireito: olho(cx: 40, cy: 0, largura: altura / 5, abertura: abertura))
}

// Rostos
var r = Regras.avaliarRostos([rosto(altura: 120, abertura: 0.35)])
confere("olhos abertos", r.rostos == 1 && abs(r.menorAbertura! - 0.35) < 0.05, "\(r.menorAbertura!)")
r = Regras.avaliarRostos([rosto(altura: 120, abertura: 0.35), rosto(altura: 110, abertura: 0.08)])
confere("um de dois com olho fechado -> menor abertura baixa", r.rostos == 2 && r.menorAbertura! < 0.12)
r = Regras.avaliarRostos([rosto(altura: 200, abertura: 0.35), rosto(altura: 40, abertura: 0.05)])
confere("rosto pequeno ao fundo é ignorado", r.rostos == 1 && r.menorAbertura! > 0.3)
r = Regras.avaliarRostos([rosto(altura: 15, abertura: 0.05)])
confere("rosto minúsculo não conta", r.rostos == 0 && r.menorAbertura == nil)

// Pessoas: imagem 1000x1500 (retrato), corpo inteiro centralizado
let W = 1000.0, H = 1500.0
func corpoInteiro(dx: Double = 0, dy: Double = 0, escala: Double = 1) -> [String: Ponto] {
    let base: [String: (Double, Double)] = [
        "nariz": (500, 300), "olhoE": (515, 285), "olhoD": (485, 285), "orelhaE": (530, 295), "orelhaD": (470, 295),
        "pescoco": (500, 380), "ombroE": (580, 390), "ombroD": (420, 390),
        "cotoveloE": (610, 560), "cotoveloD": (390, 560), "pulsoE": (620, 720), "pulsoD": (380, 720),
        "quadrilE": (550, 760), "quadrilD": (450, 760), "joelhoE": (560, 1020), "joelhoD": (440, 1020),
        "tornozeloE": (565, 1280), "tornozeloD": (435, 1280),
    ]
    return base.mapValues { Ponto(x: 500 + ($0.0 - 500) * escala + dx, y: 300 + ($0.1 - 300) * escala + dy) }
}
func avaliar(_ j: [String: Ponto]...) -> ResultadoPessoas {
    Regras.avaliarPessoas(j.map { Pessoa(juntas: $0) }, largura: W, altura: H, margem: 0.02)
}

var p = avaliar(corpoInteiro())
confere("corpo inteiro: nada cortado", p.pessoas == 1 && p.cortadas == 0, "\(p.partes)")

p = avaliar(corpoInteiro(dy: -240))
confere("topo da cabeça fora do quadro", p.partes == ["cabeca"], "\(p.partes)")

var j = corpoInteiro(dy: -340)
for k in ["nariz", "olhoE", "olhoD", "orelhaE", "orelhaD"] { j[k] = nil }
p = avaliar(j)
confere("cabeça inteira fora (só pescoço no alto)", p.partes.contains("cabeca"), "\(p.partes)")

j = corpoInteiro(); j["pulsoE"] = Ponto(x: 990, y: 600)
p = avaliar(j)
confere("mão encostada na borda direita", p.partes == ["braco"], "\(p.partes)")

j = corpoInteiro(); j["cotoveloE"] = Ponto(x: 850, y: 450); j["pulsoE"] = nil
p = avaliar(j)
confere("antebraço sumiu indo para fora", p.partes == ["braco"], "\(p.partes)")

j = corpoInteiro(); j["pulsoD"] = nil
p = avaliar(j)
confere("mão escondida atrás do corpo não conta", p.cortadas == 0, "\(p.partes)")

j = corpoInteiro(dy: 300)
j["tornozeloE"] = nil; j["tornozeloD"] = nil
p = avaliar(j)
confere("pés cortados embaixo", p.partes == ["perna"], "\(p.partes)")

p = avaliar(corpoInteiro(dx: -430))
confere("corpo saindo pela esquerda", p.partes.contains("tronco"), "\(p.partes)")

p = avaliar(corpoInteiro(), corpoInteiro(dx: -480, escala: 0.3))
confere("pessoa pequena ao fundo cortada é ignorada", p.pessoas == 1 && p.cortadas == 0, "\(p.partes)")

p = avaliar(corpoInteiro(dx: -150, escala: 0.9), corpoInteiro(dx: 420, escala: 0.9))
confere("duas pessoas, a da direita cortada", p.pessoas == 2 && p.cortadas == 1, "\(p.partes)")

print(falhas == 0 ? "\nTodos os testes passaram." : "\n\(falhas) falha(s).")
exit(falhas == 0 ? 0 : 1)
