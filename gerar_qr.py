import sys
import json
import qrcode
import qrcode.image.svg

def gerar_qr_svg(conteudo, caminho_saida):
    factory = qrcode.image.svg.SvgPathImage  # Gera QR Code vetorial
    img = qrcode.make(conteudo, image_factory=factory)
    img.save(caminho_saida)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERRO: Argumentos insuficientes. Uso: python gerar_qr.py <json_path>")
        sys.exit(1)

    json_path = sys.argv[1]

    try:
        # Lê os dados do JSON
        with open(json_path, "r", encoding="utf-8") as f:
            dados = json.load(f)

        # Converte JSON para string compacta
        conteudo_qr = json.dumps(dados, separators=(',', ':'))

        # Define o caminho do arquivo SVG
        caminho_svg = json_path.replace(".json", ".svg")

        # Gera o QR Code
        gerar_qr_svg(conteudo_qr, caminho_svg)

        print(f"OK:{caminho_svg}")  # Retorna caminho do SVG para JSX
    except Exception as e:
        print(f"ERRO: {str(e)}")
