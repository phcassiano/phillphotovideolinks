-- Analisa as fotos selecionadas e marca as problemáticas com cor de rótulo
-- e palavras-chave em "Assistente de Seleção".

local LrApplication = import 'LrApplication'
local LrDate = import 'LrDate'
local LrDialogs = import 'LrDialogs'
local LrFileUtils = import 'LrFileUtils'
local LrFunctionContext = import 'LrFunctionContext'
local LrPathUtils = import 'LrPathUtils'
local LrProgressScope = import 'LrProgressScope'
local LrTasks = import 'LrTasks'
local LrLogger = import 'LrLogger'

local Comum = require 'Comum'

local log = LrLogger('AssistenteSelecao')
log:enable('logfile')

local TAMANHO_MINIATURA = 1024
local LOTE = 200            -- fotos por rodada (miniaturas -> análise -> catálogo)
local TAREFAS_PARALELAS = 4 -- pedidos de miniatura simultâneos
local ESPERA_MAXIMA = 60    -- segundos por miniatura

-- Pede ao Lightroom a miniatura (já com a revelação aplicada) e grava em disco.
local function gravarMiniatura(foto, destino)
    local pronto, dados, erro = false, nil, nil
    local pedido = foto:requestJpegThumbnail(TAMANHO_MINIATURA, TAMANHO_MINIATURA, function(jpeg, msg)
        if not pronto then
            dados, erro, pronto = jpeg, msg, true
        end
    end)
    local inicio = LrDate.currentTime()
    while not pronto and LrDate.currentTime() - inicio < ESPERA_MAXIMA do
        LrTasks.sleep(0.02)
    end
    pedido = nil -- o pedido precisa ficar referenciado até aqui
    if not dados then
        return false, erro or 'sem miniatura'
    end
    local f = io.open(destino, 'wb')
    if not f then return false, 'não gravou arquivo temporário' end
    f:write(dados)
    f:close()
    return true
end

-- Gera as miniaturas de um lote com algumas tarefas em paralelo.
local function gravarMiniaturas(itens, progresso, contagem)
    local proximo, terminadas = 1, 0
    local function trabalhador()
        while proximo <= #itens and not progresso:isCanceled() do
            local item = itens[proximo]
            proximo = proximo + 1
            local ok, resultado, erro = pcall(gravarMiniatura, item.foto, item.arquivo)
            item.temMiniatura = ok and resultado
            item.erro = (not ok and tostring(resultado)) or erro
            contagem.feitas = contagem.feitas + 1
            progresso:setPortionComplete(contagem.feitas, contagem.total)
        end
        terminadas = terminadas + 1
    end
    for _ = 1, TAREFAS_PARALELAS do
        LrTasks.startAsyncTask(trabalhador)
    end
    while terminadas < TAREFAS_PARALELAS do
        LrTasks.sleep(0.05)
    end
end

-- Roda o programa auxiliar e devolve uma tabela arquivo -> medidas.
local function analisar(itens, pasta, rodada)
    local lista = LrPathUtils.child(pasta, 'lista-' .. rodada .. '.txt')
    local saida = LrPathUtils.child(pasta, 'resultado-' .. rodada .. '.tsv')
    local f = assert(io.open(lista, 'w'))
    for _, item in ipairs(itens) do
        if item.temMiniatura then f:write(item.arquivo, '\n') end
    end
    f:close()

    local comando = Comum.aspas(Comum.caminhoAuxiliar()) .. ' --lista ' .. Comum.aspas(lista)
        .. ' --saida ' .. Comum.aspas(saida)
    local status = LrTasks.execute(comando)
    if status ~= 0 then
        error('O programa de análise falhou (código ' .. tostring(status) .. ').\n' .. comando)
    end

    local medidas = {}
    local primeira = true
    for linha in io.lines(saida) do
        if primeira then
            primeira = false
        elseif linha ~= '' then
            local c = {}
            for campo in (linha .. '\t'):gmatch('([^\t]*)\t') do c[#c + 1] = campo end
            local media = tonumber(c[2])
            if media then
                medidas[c[1]] = {
                    media = media,
                    sombras = tonumber(c[3]),
                    estouro = tonumber(c[4]),
                    nitidez = tonumber(c[5]),
                }
            else
                medidas[c[1]] = { erro = c[6] ~= '' and c[6] or 'falha na análise' }
            end
        end
    end
    return medidas
end

local function numeroBR(v, casas)
    return (string.format('%.' .. casas .. 'f', v):gsub('%.', ','))
end

LrFunctionContext.postAsyncTaskWithContext('AssistenteSelecao', function(contexto)
    LrDialogs.attachErrorDialogToFunctionContext(contexto)

    local p = Comum.prefs()
    local catalogo = LrApplication.activeCatalog()

    if not Comum.auxiliarExiste() then
        LrDialogs.message('Assistente de Seleção',
            'O programa de análise não foi encontrado em:\n' .. Comum.caminhoAuxiliar()
            .. '\n\nRode o script helper/compilar.sh (veja o LEIAME).', 'critical')
        return
    end

    local alvo = catalogo:getTargetPhotos()
    if #alvo == 0 then
        LrDialogs.message('Assistente de Seleção', 'Nenhuma foto selecionada.')
        return
    end

    local info = catalogo:batchGetRawMetadata(alvo, { 'isVideo', 'keywords', 'colorNameForLabel' })
    local nomes = catalogo:batchGetFormattedMetadata(alvo, { 'fileName' })
    local fotos = {}
    for _, foto in ipairs(alvo) do
        if not info[foto].isVideo then fotos[#fotos + 1] = foto end
    end
    if #fotos == 0 then
        LrDialogs.message('Assistente de Seleção', 'Só há vídeos na seleção.')
        return
    end

    local escolha = LrDialogs.confirm('Analisar ' .. #fotos .. ' fotos?',
        'As fotos com problema vão receber cor de rótulo'
        .. (p.aplicarPalavrasChave and ' e palavras-chave em "' .. Comum.palavraPai .. '"' or '') .. '.',
        'Analisar', 'Cancelar')
    if escolha ~= 'ok' then return end

    local pasta = LrPathUtils.child(LrPathUtils.getStandardFilePath('temp'),
        'AssistenteSelecao-' .. tostring(math.floor(LrDate.currentTime())))
    LrFileUtils.createAllDirectories(pasta)
    contexto:addCleanupHandler(function() LrFileUtils.delete(pasta) end)

    local progresso = LrProgressScope { title = 'Assistente de Seleção', functionContext = contexto }
    local inicio = LrDate.currentTime()
    local contagem = { feitas = 0, total = #fotos }
    local totais = { escura = 0, clara = 0, foco = 0, normais = 0, falhas = 0, ignoradas = 0, analisadas = 0 }
    local relatorio = {}
    local primeiraFalha = nil

    local rodada = 0
    for inicioLote = 1, #fotos, LOTE do
        if progresso:isCanceled() then break end
        rodada = rodada + 1
        local fimLote = math.min(inicioLote + LOTE - 1, #fotos)
        progresso:setCaption(string.format('Lendo miniaturas %d–%d de %d', inicioLote, fimLote, #fotos))

        local itens = {}
        for i = inicioLote, fimLote do
            itens[#itens + 1] = {
                foto = fotos[i],
                arquivo = LrPathUtils.child(pasta, string.format('%06d.jpg', i)),
            }
        end
        gravarMiniaturas(itens, progresso, contagem)
        if progresso:isCanceled() then break end

        progresso:setCaption(string.format('Analisando %d–%d de %d', inicioLote, fimLote, #fotos))
        local medidas = analisar(itens, pasta, rodada)

        catalogo:withWriteAccessDo('Assistente de Seleção', function()
            local palavras = p.aplicarPalavrasChave and Comum.palavrasChave(catalogo) or nil
            for _, item in ipairs(itens) do
                local foto = item.foto
                local m = item.temMiniatura and medidas[item.arquivo] or nil
                local nome = nomes[foto] and nomes[foto].fileName or '?'

                if not m or m.erro then
                    totais.falhas = totais.falhas + 1
                    local motivo = (m and m.erro) or item.erro or 'sem miniatura'
                    primeiraFalha = primeiraFalha or (nome .. ': ' .. motivo)
                    log:warn(nome .. ': ' .. motivo)
                    relatorio[#relatorio + 1] = { nome, nil, 'falha: ' .. motivo }
                else
                    totais.analisadas = totais.analisadas + 1
                    local r, principal = Comum.classificar(m, p)
                    local corAtual = info[foto].colorNameForLabel
                    local marcadaAntes = Comum.temMarcacao(info[foto].keywords)

                    if palavras then
                        for _, k in ipairs(Comum.ordem) do
                            foto:removeKeyword(palavras[k])
                            if r[k] then foto:addKeyword(palavras[k]) end
                        end
                    end

                    if principal then
                        totais[principal] = totais[principal] + 1
                        if p.aplicarRotulos then
                            local semRotulo = corAtual == nil or corAtual == '' or corAtual == 'none'
                            if p.sobrescreverRotulos or semRotulo or marcadaAntes then
                                Comum.definirCor(foto, Comum.corDe(principal, p))
                            else
                                totais.ignoradas = totais.ignoradas + 1
                            end
                        end
                    else
                        totais.normais = totais.normais + 1
                        -- Reanálise com outros limites: tira a cor que o próprio assistente tinha posto
                        if p.aplicarRotulos and marcadaAntes and Comum.ehCorDoAssistente(corAtual, p) then
                            Comum.definirCor(foto, 'none')
                        end
                    end

                    local problemas = {}
                    for _, k in ipairs(Comum.ordem) do
                        if r[k] then problemas[#problemas + 1] = Comum.nomes[k] end
                    end
                    relatorio[#relatorio + 1] = {
                        nome, m, #problemas > 0 and table.concat(problemas, ' + ') or 'Normal',
                    }
                end
            end
        end, { timeout = 120 })

        for _, item in ipairs(itens) do LrFileUtils.delete(item.arquivo) end
    end

    progresso:done()
    local segundos = LrDate.currentTime() - inicio

    local caminhoRelatorio = nil
    if p.salvarRelatorio and #relatorio > 0 then
        local nomeArquivo = 'Assistente de Seleção ' .. LrDate.timeToUserFormat(LrDate.currentTime(), '%Y-%m-%d %Hh%M') .. '.csv'
        caminhoRelatorio = LrPathUtils.child(LrPathUtils.getStandardFilePath('desktop'), nomeArquivo)
        local f = io.open(caminhoRelatorio, 'w')
        if f then
            f:write('arquivo;brilho_medio_%;sombras_%;estourado_%;nitidez;resultado\n')
            for _, l in ipairs(relatorio) do
                local m = l[2]
                if m then
                    f:write(l[1], ';', numeroBR(m.media * 100, 1), ';', numeroBR(m.sombras * 100, 1), ';',
                        numeroBR(m.estouro * 100, 1), ';', numeroBR(m.nitidez, 1), ';', l[3], '\n')
                else
                    f:write(l[1], ';;;;;', l[3], '\n')
                end
            end
            f:close()
        else
            caminhoRelatorio = nil
        end
    end

    local cor = {}
    for _, c in ipairs(Comum.cores) do cor[c.value] = c.title end
    local texto = string.format(
        'Analisadas: %d de %d em %d s\n\n'
        .. 'Muito escuras: %d (%s)\n'
        .. 'Muito claras: %d (%s)\n'
        .. 'Sem foco: %d (%s)\n'
        .. 'Normais: %d\n'
        .. 'Falhas: %d',
        totais.analisadas, #fotos, math.floor(segundos + 0.5),
        totais.escura, cor[p.corEscura] or p.corEscura,
        totais.clara, cor[p.corClara] or p.corClara,
        totais.foco, cor[p.corFoco] or p.corFoco,
        totais.normais, totais.falhas)
    if totais.ignoradas > 0 then
        texto = texto .. '\n\n' .. totais.ignoradas .. ' foto(s) já tinham rótulo e não foram alteradas.'
    end
    if primeiraFalha then
        texto = texto .. '\n\nPrimeira falha: ' .. primeiraFalha
    end
    if caminhoRelatorio then
        texto = texto .. '\n\nRelatório salvo na Mesa:\n' .. LrPathUtils.leafName(caminhoRelatorio)
    end
    LrDialogs.message('Assistente de Seleção – Concluído', texto, 'info')
end)
