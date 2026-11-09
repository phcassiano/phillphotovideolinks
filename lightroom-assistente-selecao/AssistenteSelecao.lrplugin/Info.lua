return {
    LrSdkVersion = 10.0,
    LrSdkMinimumVersion = 6.0,
    LrToolkitIdentifier = 'com.phillcassiano.assistenteselecao',
    LrPluginName = 'Assistente de Seleção',

    -- Biblioteca > Extras do plug-in
    LrLibraryMenuItems = {
        { title = 'Analisar fotos selecionadas…', file = 'Analisar.lua' },
        { title = 'Limpar marcações do assistente', file = 'Limpar.lua' },
        { title = 'Configurações…', file = 'Configuracoes.lua' },
    },
    -- Arquivo > Extras do plug-in
    LrExportMenuItems = {
        { title = 'Analisar fotos selecionadas…', file = 'Analisar.lua' },
        { title = 'Limpar marcações do assistente', file = 'Limpar.lua' },
        { title = 'Configurações…', file = 'Configuracoes.lua' },
    },

    VERSION = { major = 0, minor = 2, revision = 0 },
}
