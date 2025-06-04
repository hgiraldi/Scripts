#target illustrator

// Função para carregar o script remoto do Google APIs e avaliar seu conteúdo
function loadGoogleAPIs() {
    // Caminho para o arquivo JSON com suas credenciais de autenticação
    var keyFilePath = "~/Desktop/Teste Inteligencia/chaveAPI.json";

    // URL do script remoto do Google APIs
    var googleScriptURL = "https://www.gstatic.com/charts/loader.js";

    // Criar uma nova tag de script
    var scriptTag = document.createElement("script");

    // Definir o atributo src da tag de script como a URL do script remoto
    scriptTag.src = googleScriptURL;

    // Adicionar a tag de script ao documento
    document.body.appendChild(scriptTag);

    // Verificar se o objeto 'google' foi definido corretamente após o carregamento do script
    if (typeof google !== 'undefined') {
        // Configurar as credenciais de autenticação
        var googleAuth = google.auth.GoogleAuth;
        var auth = new googleAuth({
            keyFile: keyFilePath,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        // Criar uma instância do cliente para acessar o Cloud Vision API
        var googleVision = google.vision;
        var vision = googleVision({
            version: 'v1',
            auth: auth
        });

        // Retornar a instância do cliente para uso posterior
        return vision;
    } else {
        alert("Erro ao carregar o script remoto do Google APIs.");
        return null;
    }
}

// Carregar o Google APIs e configurar a autenticação
var visionClient = loadGoogleAPIs();

// Verificar se o objeto 'visionClient' foi criado com sucesso
if (visionClient) {
    // Agora você pode usar a variável 'visionClient' para fazer chamadas à API do Google Cloud Vision
} else {
    alert("Erro ao configurar a autenticação para a API do Google Cloud Vision.");
}
