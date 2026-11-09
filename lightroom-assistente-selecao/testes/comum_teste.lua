-- Testes das regras do plugin, fora do Lightroom:
--   lua5.1 testes/comum_teste.lua AssistenteSelecao.lrplugin
function import() return { prefsForPlugin=function() return {} end } end
package.path = arg[1] .. '/?.lua;' .. package.path
local C = require 'Comum'
local p = C.prefs()
local falhas = 0
local function ok(nome, cond, extra)
  if not cond then falhas = falhas + 1 end
  print(cond and 'OK  ' or 'ERRO', nome, extra or '')
end
local function cls(m)
  local base = {media=.45, sombras=.05, estouro=.01, nitidez=40, tremor=.05, abertura=.32, partes=''}
  for k,v in pairs(m) do base[k]=v end
  local r, pr = C.classificar(base, p); return tostring(pr), r
end
ok('normal', cls{} == 'nil')
ok('tremida', cls{tremor=.20} == 'tremida')
ok('tremor no limite (15) conta', cls{tremor=.15} == 'tremida')
ok('foco vence tremida', cls{tremor=.3, nitidez=5} == 'foco')
ok('tremida vence olhos', cls{tremor=.3, abertura=.05} == 'tremida')
ok('tremor sem dado', cls{tremor=nil} == 'nil')
-- diferença
ok('dif igual', C.diferenca('00000000000000ff','00000000000000ff') == 0)
ok('dif 8 bits', C.diferenca('00000000000000ff','0000000000000000') == 8)
ok('dif total', C.diferenca('ffffffffffffffff','0000000000000000') == 64)
ok('dif misto', C.diferenca('a5a5a5a5a5a5a5a5','5a5a5a5a5a5a5a5a') == 64)
ok('dif inválida', C.diferenca(nil,'00') == 64)
-- agrupamento
local A='0f0f0f0f0f0f0f0f'; local A2='0f0f0f0f0f0f0f0e'; local A3='0f0f0f0f0f0f0f0c'; local B='f0f0f0f0f0f0f0f0'
local regs = {
  {indice=1, tempo=100.0, assinatura=A,  pontuacao=30},
  {indice=2, tempo=100.5, assinatura=A2, pontuacao=50},
  {indice=3, tempo=101.0, assinatura=A3, pontuacao=40},
  {indice=4, tempo=101.2, assinatura=B,  pontuacao=60},  -- cena diferente
  {indice=5, tempo=200.0, assinatura=B,  pontuacao=10},  -- mesma cena, mas muito depois
  {indice=6, tempo=200.4, assinatura=B,  pontuacao=20},
  {indice=7, tempo=nil,   assinatura=A,  pontuacao=5},
}
local g = C.agruparDuplicadas(regs, 3, 10)
ok('2 grupos', #g == 2, #g)
ok('grupo 1 = fotos 1,2,3', #g[1] == 3 and g[1][1].indice == 1 and g[1][3].indice == 3)
ok('melhor do grupo 1 = foto 2', g[1].melhor.indice == 2)
ok('grupo 2 = fotos 5,6 e melhor 6', #g[2] == 2 and g[2].melhor.indice == 6)
-- fora de ordem na seleção, ordenado pelo tempo
local regs2 = { {indice=1,tempo=10,assinatura=A,pontuacao=1}, {indice=2,tempo=50,assinatura=A,pontuacao=1}, {indice=3,tempo=11,assinatura=A2,pontuacao=9} }
local g2 = C.agruparDuplicadas(regs2, 3, 10)
ok('ordena pelo horário', #g2 == 1 and #g2[1] == 2 and g2[1].melhor.indice == 3)
-- sem horário: usa a ordem
local regs3 = { {indice=1,assinatura=A,pontuacao=1}, {indice=2,assinatura=A2,pontuacao=2} }
ok('sem horário agrupa vizinhas', #C.agruparDuplicadas(regs3, 3, 10) == 1)
-- pontuação
local _, r = cls{abertura=.05}
ok('pontuação desconta olhos fechados', C.pontuacao({nitidez=40}, r) == 16)
-- cor branca
ok('branco reconhecido pelo texto', C.ehCorDoAssistente('other', 'Tremida', p))
ok('texto alheio não', not C.ehCorDoAssistente('other', 'Cliente', p))
ok('azul é do assistente', C.ehCorDoAssistente('blue', '', p))
-- melhor da sequência com expressão
local function seq(fotos, peso)
  local regs = {}
  for i, f in ipairs(fotos) do
    regs[i] = {indice=i, tempo=100 + i * 0.3, assinatura=A, pontuacao=f[1], expressao=f[2]}
  end
  local g = C.agruparDuplicadas(regs, 3, 10, peso)
  return g[1] and g[1].melhor.indice
end
ok('sem expressão: vence a mais nítida', seq({{40,.5},{50,.4},{45,.9}}, 0) == 2)
ok('com expressão: sorriso vence nitidez parecida', seq({{40,.5},{50,.4},{45,.9}}, 0.5) == 3)
ok('expressão não salva foto muito pior', seq({{50,.5},{10,.95}}, 0.5) == 1)
ok('grupo sem rostos: só nitidez', seq({{40,nil},{50,nil},{45,nil}}, 0.5) == 2)
ok('foto sem rosto perde para foto com rosto', seq({{50,nil},{48,.8}}, 0.5) == 2)
ok('peso 100%: só expressão', seq({{50,.3},{20,.6}}, 1) == 2)
p.detectarDuplicadas = true; p.usarExpressao = true; p.detectarOlhos = false; p.detectarCortadas = false
ok('expressão liga a análise de rostos', C.usaVisao(p))
p.usarExpressao = false
ok('tudo de rosto desligado: sem análise de rostos', not C.usaVisao(p))

print(falhas == 0 and 'Todos passaram.' or (falhas .. ' falha(s)'))
os.exit(falhas == 0 and 0 or 1)
