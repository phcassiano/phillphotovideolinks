-- Analisa as fotos selecionadas e marca as problemáticas com cor de rótulo,
-- palavras-chave e coleções em "Assistente de Seleção". No final, agrupa as
-- quase-duplicadas e aponta a melhor de cada sequência.

local LrApplication = import 'LrApplication'
local LrDate = import 'LrDate'
local LrDialogs = import 'LrDialogs'
local LrExportSession = import 'LrExportSession'
local LrFileUtils = import 'LrFileUtils'
local LrFunctionContext = import 'LrFunctionContext'
local LrPathUtils = import 'LrPathUtils'
local LrProgressScope = import 'LrProgressScope'
local LrTasks = import 'LrTasks'
local LrLogger = import 'LrLogger'

local Comum = require 'Comum'

local log = LrLogger('AssistenteSelecao')
log:enable('logfile')

local LOTE = 50             -- fotos por rodada (miniaturas -> análise -> catálogo)
local TAREFAS_PARALELAS = 4 -- pedidos de miniatura simultâneos
local ESPERA_MAXIMA = 15    -- segundos por miniatura (depois disso, a foto vai para a exportação)

-- Pede ao Lightroom a miniatura (já com a revelação aplicada) e grava em disco.
-- O Lightroom pode chamar a resposta mais de uma vez: primeiro sem imagem (prévia ainda não
-- pronta) e depois com ela. Só desiste quando o tempo acaba.
local function gravarMiniatura(foto, destino, tamanho)
    local dados, erro = nil, nil
    local pedido = foto:requestJpegThumbnail(tamanho, tamanho, function(jpeg, msg)
        if jpeg and not dados then dados = jpeg end
        if msg then erro = msg end
    end)
    local inicio = LrDate.currentTime()
    while not dados and LrDate.currentTime() - inicio < ESPERA_MAXIMA do
        LrTasks.sleep(0.05)
    end
    pedido = nil -- o pedido precisa ficar referenciado até aqui
    if not dados then
        return false, erro or 'o Lightroom não entregou a miniatura'
    end
    local f = io.open(destino, 'wb')
    if not f then return false, 'não gravou arquivo temporário' end
    f:write(dados)
    f:close()
    return true
end

-- Gera as miniaturas de um lote com algumas tarefas em paralelo.
local function gravarMiniaturas(itens, tamanho, progresso, contagem)
    local proximo, terminadas = 1, 0
    local function trabalhador()
        while proximo <= #itens and not progresso:isCanceled() do
            local item = itens[proximo]
            proximo = proximo + 1
            local ok, resultado, erro = pcall(gravarMiniatura, item.foto, item.arquivo, tamanho)
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

-- Plano B: fotos sem miniatura são exportadas como JPEG pequeno (mais lento, mas sempre funciona).
local function exportarFaltantes(itens, pasta, tamanho, progresso)
    local faltantes, porFoto = {}, {}
    for _, item in ipairs(itens) do
        if not item.temMiniatura then
            faltantes[#faltantes + 1] = item.foto
            porFoto[item.foto] = item
        end
    end
    if #faltantes == 0 then return end
    log:info(#faltantes .. ' foto(s) sem miniatura; exportando')
    progresso:setCaption('Gerando ' .. #faltantes .. ' imagem(ns) por exportação')

    local destino = LrPathUtils.child(pasta, 'exportadas')
    LrFileUtils.createAllDirectories(destino)
    local sessao = LrExportSession {
        photosToExport = faltantes,
        exportSettings = {
            LR_export_destinationType = 'specificFolder',
            LR_export_destinationPathPrefix = destino,
            LR_export_useSubfolder = false,
            LR_collisionHandling = 'rename',
            LR_format = 'JPEG',
            LR_jpeg_quality = 0.85,
            LR_export_colorSpace = 'sRGB',
            LR_size_doConstrain = true,
            LR_size_resizeType = 'wh',
            LR_size_maxWidth = tamanho,
            LR_size_maxHeight = tamanho,
            LR_size_units = 'pixels',
            LR_size_doNotEnlarge = true,
            LR_outputSharpeningOn = false,
            LR_minimizeEmbeddedMetadata = true,
            LR_removeLocationMetadata = true,
            LR_includeVideoFiles = false,
            LR_useWatermark = false,
            LR_reimportExportedPhoto = false,
            LR_export_postProcessing = 'doNothing',
        },
    }
    for _, rendicao in sessao:renditions() do
        if progresso:isCanceled() then break end
        local ok, caminhoOuErro = rendicao:waitForRender()
        local item = porFoto[rendicao.photo]
        if item then
            if ok then
                item.arquivo = caminhoOuErro
                item.temMiniatura = true
                item.erro = nil
            else
                item.erro = 'exportação: ' .. tostring(caminhoOuErro)
            end
        end
    end
end

local function lerArquivo(caminho)
    local f = io.open(caminho, 'r')
    if not f then return '' end
    local texto = f:read('*a') or ''
    f:close()
    return texto
end

-- Roda o programa auxiliar e devolve uma tabela arquivo -> medidas.
local function analisar(itens, pasta, rodada, p)
    local lista = LrPathUtils.child(pasta, 'lista-' .. rodada .. '.txt')
    local saida = LrPathUtils.child(pasta, 'resultado-' .. rodada .. '.tsv')
    local erros = LrPathUtils.child(pasta, 'erros-' .. rodada .. '.txt')
    local quantas = 0
    local f = assert(io.open(lista, 'w'))
    for _, item in ipairs(itens) do
        if item.temMiniatura then
            f:write(item.arquivo, '\n')
            quantas = quantas + 1
        end
    end
    f:close()
    if quantas == 0 then return {} end

    local comando = Comum.aspas(Comum.caminhoAuxiliar()) .. ' --lista ' .. Comum.aspas(lista)
        .. ' --saida ' .. Comum.aspas(saida)
    if Comum.usaVisao(p) then
        comando = comando .. ' --visao --margem ' .. string.format('%.4f', (p.margemBorda or 2) / 100):gsub(',', '.')
    end
    local status = LrTasks.execute(comando .. ' 2> ' .. Comum.aspas(erros))
    if status ~= 0 then
        local detalhe = lerArquivo(erros)
        log:error('auxiliar falhou (' .. tostring(status) .. '): ' .. comando .. '\n' .. detalhe)
        error('O programa de análise falhou (código ' .. tostring(status) .. ').\n\n'
            .. (detalhe ~= '' and detalhe or 'Sem mensagem.') .. '\n\nComando: ' .. comando)
    end

    -- Colunas: caminho media sombras estouro nitidez tremor assinatura
    --          rostos abertura_olhos pessoas cortadas partes sorriso expressao erro
    local medidas = {}
    local primeira = true
    for linha in io.lines(saida) do
        if primeira then
            primeira = false
        elseif linha ~= '' then
            local c = {}
            for campo in (linha .. '\t'):gmatch('([^\t]*)\t') do c[#c + 1] = campo end
            local media = tonumber(c[2])
            local erro = (c[15] or '') ~= '' and c[15] or nil
            if media then
                medidas[c[1]] = {
                    media = media,
                    sombras = tonumber(c[3]),
                    estouro = tonumber(c[4]),
                    nitidez = tonumber(c[5]),
                    tremor = tonumber(c[6]),
                    assinatura = (c[7] or '') ~= '' and c[7] or nil,
                    rostos = tonumber(c[8]),
                    abertura = tonumber(c[9]),
                    pessoas = tonumber(c[10]),
                    cortadas = tonumber(c[11]),
                    partes = c[12] or '',
                    sorriso = tonumber(c[13]),
                    expressao = tonumber(c[14]),
                    aviso = erro,
                }
            else
                medidas[c[1]] = { erro = erro or 'falha na análise' }
            end
        end
    end
    return medidas
end

local function numeroBR(v, casas)
    if v == nil then return '' end
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

    local info = catalogo:batchGetRawMetadata(alvo,
        { 'isVideo', 'keywords', 'colorNameForLabel', 'pickStatus', 'dateTimeOriginal' })
    -- O texto do rótulo só existe como metadado formatado
    local nomes = catalogo:batchGetFormattedMetadata(alvo, { 'fileName', 'label' })
    local fotos = {}
    for _, foto in ipairs(alvo) do
        if not info[foto].isVideo then fotos[#fotos + 1] = foto end
    end
    if #fotos == 0 then
        LrDialogs.message('Assistente de Seleção', 'Só há vídeos na seleção.')
        return
    end

    local onde = {}
    if p.aplicarRotulos then onde[#onde + 1] = 'cor de rótulo' end
    if p.aplicarPalavrasChave then onde[#onde + 1] = 'palavras-chave' end
    if p.criarColecoes then onde[#onde + 1] = 'coleções em "' .. Comum.palavraPai .. '"' end
    local escolha = LrDialogs.confirm('Analisar ' .. #fotos .. ' fotos?',
        'As fotos com problema vão receber: ' .. (#onde > 0 and table.concat(onde, ', ') or 'nada (só relatório)') .. '.',
        'Analisar', 'Cancelar')
    if escolha ~= 'ok' then return end

    local pasta = LrPathUtils.child(LrPathUtils.getStandardFilePath('temp'),
        'AssistenteSelecao-' .. tostring(math.floor(LrDate.currentTime())))
    LrFileUtils.createAllDirectories(pasta)
    contexto:addCleanupHandler(function() LrFileUtils.delete(pasta) end)

    -- Palavras-chave e coleções são criadas antes, numa transação separada.
    local destino
    catalogo:withWriteAccessDo('Assistente de Seleção – preparar', function()
        destino = Comum.prepararCatalogo(catalogo, p.criarColecoes)
    end, { timeout = 60 })

    -- Olhos e cortes precisam de mais resolução que brilho e nitidez.
    local tamanho = Comum.usaVisao(p) and 1600 or 1024

    local progresso = LrProgressScope { title = 'Assistente de Seleção', functionContext = contexto }
    local inicio = LrDate.currentTime()
    log:info(string.format('início: %d fotos, miniaturas de %d px, rostos: %s', #fotos, tamanho,
        tostring(Comum.usaVisao(p))))
    -- Progresso: cada foto conta 2 passos (miniatura; análise + catálogo)
    local contagem = { feitas = 0, total = #fotos * 2 }
    local totais = { normais = 0, falhas = 0, ignoradas = 0, analisadas = 0, grupos = 0, duplicadas = 0 }
    for _, k in ipairs(Comum.ordem) do totais[k] = 0 end
    local relatorio = {}           -- linhas na ordem da análise
    local registros = {}           -- para agrupar duplicadas no final
    local primeiraFalha, primeiroAviso = nil, nil

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
                indice = i,
                arquivo = LrPathUtils.child(pasta, string.format('%06d.jpg', i)),
            }
        end
        local t0 = LrDate.currentTime()
        gravarMiniaturas(itens, tamanho, progresso, contagem)
        if progresso:isCanceled() then break end
        local comMiniatura = 0
        for _, item in ipairs(itens) do if item.temMiniatura then comMiniatura = comMiniatura + 1 end end
        log:info(string.format('lote %d: %d/%d miniaturas em %.1f s', rodada, comMiniatura, #itens,
            LrDate.currentTime() - t0))
        t0 = LrDate.currentTime()
        exportarFaltantes(itens, pasta, tamanho, progresso)
        if progresso:isCanceled() then break end
        if comMiniatura < #itens then
            log:info(string.format('lote %d: exportação de %d foto(s) em %.1f s', rodada, #itens - comMiniatura,
                LrDate.currentTime() - t0))
        end

        progresso:setCaption(string.format('Analisando %d–%d de %d', inicioLote, fimLote, #fotos))
        t0 = LrDate.currentTime()
        local medidas = analisar(itens, pasta, rodada, p)
        log:info(string.format('lote %d: análise em %.1f s', rodada, LrDate.currentTime() - t0))
        t0 = LrDate.currentTime()
        progresso:setCaption(string.format('Gravando no catálogo %d–%d de %d', inicioLote, fimLote, #fotos))

        catalogo:withWriteAccessDo('Assistente de Seleção', function()
            -- Fotos a pôr / tirar de cada coleção neste lote
            local entrar, sair = {}, {}
            if destino.colecoes then
                for _, k in ipairs(Comum.ordem) do entrar[k], sair[k] = {}, {} end
                entrar.revisar, sair.revisar = {}, {}
            end

            for _, item in ipairs(itens) do
                local foto = item.foto
                local m = item.temMiniatura and medidas[item.arquivo] or nil
                local nome = nomes[foto] and nomes[foto].fileName or '?'

                if not m or m.erro then
                    totais.falhas = totais.falhas + 1
                    local motivo = (m and m.erro) or item.erro or 'sem miniatura'
                    primeiraFalha = primeiraFalha or (nome .. ': ' .. motivo)
                    log:warn(nome .. ': ' .. motivo)
                    relatorio[#relatorio + 1] = { nome = nome, resultado = 'falha: ' .. motivo }
                else
                    if m.aviso then
                        primeiroAviso = primeiroAviso or (nome .. ': ' .. m.aviso)
                        log:warn(nome .. ': ' .. m.aviso)
                    end
                    totais.analisadas = totais.analisadas + 1
                    local r, principal = Comum.classificar(m, p)
                    local corAtual = info[foto].colorNameForLabel
                    local textoRotulo = nomes[foto] and nomes[foto].label
                    local marcadaAntes = Comum.temMarcacao(info[foto].keywords)

                    -- Palavras-chave e coleções: uma por problema, refeitas a cada análise
                    for _, k in ipairs(Comum.ordem) do
                        if p.aplicarPalavrasChave then
                            foto:removeKeyword(destino.palavras[k])
                            if r[k] then foto:addKeyword(destino.palavras[k]) end
                        end
                        if destino.colecoes then
                            table.insert(r[k] and entrar[k] or sair[k], foto)
                        end
                    end
                    if destino.colecoes then
                        table.insert(principal and entrar.revisar or sair.revisar, foto)
                    end

                    if principal then
                        totais[principal] = totais[principal] + 1
                        if p.aplicarRotulos then
                            local semRotulo = (corAtual == nil or corAtual == '' or corAtual == 'none')
                                and (textoRotulo == nil or textoRotulo == '')
                            if p.sobrescreverRotulos or semRotulo or marcadaAntes then
                                Comum.definirCor(foto, Comum.corDe(principal, p), principal)
                            else
                                totais.ignoradas = totais.ignoradas + 1
                            end
                        end
                    else
                        totais.normais = totais.normais + 1
                        -- Reanálise com outros limites: tira a cor que o próprio assistente tinha posto
                        if p.aplicarRotulos and marcadaAntes and Comum.ehCorDoAssistente(corAtual, textoRotulo, p) then
                            Comum.definirCor(foto, 'none')
                        end
                    end

                    local problemas = {}
                    for _, k in ipairs(Comum.ordem) do
                        if r[k] then
                            local texto = Comum.nomes[k]
                            if k == 'cortada' then
                                local partes = {}
                                for _, parte in ipairs(Comum.partesQueContam(m, p)) do
                                    partes[#partes + 1] = Comum.nomesPartes[parte] or parte
                                end
                                texto = texto .. ' (' .. table.concat(partes, ', ') .. ')'
                            end
                            problemas[#problemas + 1] = texto
                        end
                    end
                    local linha = {
                        nome = nome, m = m,
                        resultado = #problemas > 0 and table.concat(problemas, ' + ') or 'Normal',
                    }
                    relatorio[#relatorio + 1] = linha
                    registros[#registros + 1] = {
                        foto = foto, indice = item.indice, linha = linha,
                        tempo = info[foto].dateTimeOriginal,
                        assinatura = m.assinatura,
                        pontuacao = Comum.pontuacao(m, r),
                        expressao = m.expressao,
                    }
                end
            end

            if destino.colecoes then
                for chave, lista in pairs(sair) do
                    if #lista > 0 then destino.colecoes[chave]:removePhotos(lista) end
                end
                for chave, lista in pairs(entrar) do
                    if #lista > 0 then destino.colecoes[chave]:addPhotos(lista) end
                end
            end
        end, { timeout = 120 })
        log:info(string.format('lote %d: catálogo em %.1f s', rodada, LrDate.currentTime() - t0))
        contagem.feitas = contagem.feitas + #itens
        progresso:setPortionComplete(contagem.feitas, contagem.total)

        for _, item in ipairs(itens) do LrFileUtils.delete(item.arquivo) end
    end

    -- Duplicadas: só depois de ter todas as fotos, porque uma sequência pode cruzar lotes.
    if p.detectarDuplicadas and not progresso:isCanceled() and #registros > 1 then
        progresso:setCaption('Procurando fotos repetidas')
        local peso = p.usarExpressao and (p.pesoExpressao or 50) / 100 or 0
        local grupos = Comum.agruparDuplicadas(registros, p.duplicadaSegundos, p.duplicadaDiferenca, peso)
        local papel = {} -- foto -> 'melhor' | 'duplicada'
        for n, g in ipairs(grupos) do
            totais.grupos = totais.grupos + 1
            for _, r in ipairs(g) do
                local melhor = (r == g.melhor)
                papel[r.foto] = melhor and 'melhor' or 'duplicada'
                r.linha.grupo = n
                r.linha.nota = r.nota
                r.linha.papel = melhor and 'Melhor da sequência' or 'Duplicada'
                if not melhor then totais.duplicadas = totais.duplicadas + 1 end
            end
        end

        for inicioLote = 1, #registros, 500 do
            catalogo:withWriteAccessDo('Assistente de Seleção – duplicadas', function()
                local entrar = { duplicada = {}, melhor = {} }
                local sair = { duplicada = {}, melhor = {} }
                for i = inicioLote, math.min(inicioLote + 499, #registros) do
                    local foto = registros[i].foto
                    local agora = papel[foto]
                    local antes = (Comum.temPalavra(info[foto].keywords, Comum.nomes.duplicada) and 'duplicada')
                        or (Comum.temPalavra(info[foto].keywords, Comum.nomes.melhor) and 'melhor') or nil
                    local bandeira = info[foto].pickStatus

                    for _, k in ipairs(Comum.extras) do
                        if p.aplicarPalavrasChave then
                            foto:removeKeyword(destino.palavras[k])
                            if agora == k then foto:addKeyword(destino.palavras[k]) end
                        end
                        table.insert(agora == k and entrar[k] or sair[k], foto)
                    end

                    -- Bandeiras: só mexe nas que o próprio assistente pôs
                    if agora == 'duplicada' and p.rejeitarDuplicadas then
                        foto:setRawMetadata('pickStatus', -1)
                    elseif agora == 'melhor' and p.escolherMelhor then
                        foto:setRawMetadata('pickStatus', 1)
                    elseif antes ~= agora then
                        if (antes == 'duplicada' and bandeira == -1) or (antes == 'melhor' and bandeira == 1) then
                            foto:setRawMetadata('pickStatus', 0)
                        end
                    end
                end
                if destino.colecoes then
                    for _, k in ipairs(Comum.extras) do
                        if #sair[k] > 0 then destino.colecoes[k]:removePhotos(sair[k]) end
                        if #entrar[k] > 0 then destino.colecoes[k]:addPhotos(entrar[k]) end
                    end
                end
            end, { timeout = 120 })
        end
    end

    progresso:done()
    local segundos = LrDate.currentTime() - inicio

    local caminhoRelatorio = nil
    if p.salvarRelatorio and #relatorio > 0 then
        local nomeArquivo = 'Assistente de Seleção ' .. LrDate.timeToUserFormat(LrDate.currentTime(), '%Y-%m-%d %Hh%M') .. '.csv'
        caminhoRelatorio = LrPathUtils.child(LrPathUtils.getStandardFilePath('desktop'), nomeArquivo)
        local f = io.open(caminhoRelatorio, 'w')
        if f then
            f:write('arquivo;nitidez;tremor;abertura_olhos_%;sorriso_%;expressao_%;rostos;pessoas;partes_cortadas;'
                .. 'brilho_medio_%;sombras_%;estourado_%;assinatura;sequencia;nota_na_sequencia_%;resultado\n')
            for _, l in ipairs(relatorio) do
                local m = l.m
                local resultado = l.resultado .. (l.papel and (' | ' .. l.papel) or '')
                if m then
                    f:write(table.concat({
                        l.nome, numeroBR(m.nitidez, 1), numeroBR(m.tremor and m.tremor * 100, 0),
                        numeroBR(m.abertura and m.abertura * 100, 0),
                        numeroBR(m.sorriso and m.sorriso * 100, 0), numeroBR(m.expressao and m.expressao * 100, 0),
                        m.rostos and tostring(m.rostos) or '', m.pessoas and tostring(m.pessoas) or '', m.partes or '',
                        numeroBR(m.media * 100, 1), numeroBR(m.sombras * 100, 1), numeroBR(m.estouro * 100, 1),
                        m.assinatura or '', l.grupo and tostring(l.grupo) or '',
                        numeroBR(l.nota and l.nota * 100, 0), resultado,
                    }, ';'), '\n')
                else
                    f:write(l.nome, ';;;;;;;;;;;;;;;', resultado, '\n')
                end
            end
            f:close()
        else
            caminhoRelatorio = nil
        end
    end

    local nomeCor = { white = 'Branco' }
    for _, c in ipairs(Comum.cores) do nomeCor[c.value] = nomeCor[c.value] or c.title end
    local linhas = {
        string.format('Analisadas: %d de %d em %d s', totais.analisadas, #fotos, math.floor(segundos + 0.5)), '',
    }
    local desligadas = {
        tremida = not p.detectarTremidas, olhos = not p.detectarOlhos, cortada = not p.detectarCortadas,
    }
    for _, k in ipairs(Comum.ordem) do
        if not desligadas[k] then
            local cor = Comum.corDe(k, p)
            linhas[#linhas + 1] = string.format('%s: %d (%s)', Comum.nomes[k], totais[k], nomeCor[cor] or cor)
        end
    end
    linhas[#linhas + 1] = 'Normais: ' .. totais.normais
    linhas[#linhas + 1] = 'Falhas: ' .. totais.falhas
    if p.detectarDuplicadas then
        linhas[#linhas + 1] = ''
        linhas[#linhas + 1] = string.format('Sequências repetidas: %d (%d duplicadas para descartar)',
            totais.grupos, totais.duplicadas)
    end
    if totais.ignoradas > 0 then
        linhas[#linhas + 1] = ''
        linhas[#linhas + 1] = totais.ignoradas .. ' foto(s) já tinham rótulo e não foram alteradas.'
    end
    if primeiraFalha then
        linhas[#linhas + 1] = ''
        linhas[#linhas + 1] = 'Primeira falha: ' .. primeiraFalha
    end
    if primeiroAviso then
        linhas[#linhas + 1] = ''
        linhas[#linhas + 1] = 'Aviso (olhos/cortes): ' .. primeiroAviso
    end
    if caminhoRelatorio then
        linhas[#linhas + 1] = ''
        linhas[#linhas + 1] = 'Relatório salvo na Mesa: ' .. LrPathUtils.leafName(caminhoRelatorio)
    end
    LrDialogs.message('Assistente de Seleção – Concluído', table.concat(linhas, '\n'), 'info')
end)
