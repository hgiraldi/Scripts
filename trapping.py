import sys
import json

def calcular_luminosidade(c, m, y, k):
    # Simples fórmula de luminosidade invertida (quanto maior o K, mais escuro)
    return 100 - (0.3 * c + 0.59 * m + 0.11 * y + k)

def cor_para_string(cor):
    if "nome" in cor:
        return f"{cor['nome']} ({cor['tipo']})"
    else:
        return f"{cor['tipo']}"

def main():
    if len(sys.argv) < 2:
        print("Erro: Caminho do JSON não fornecido.")
        return

    caminho_json = sys.argv[1]

    try:
        with open(caminho_json, "r") as f:
            data = json.load(f)
    except Exception as e:
        print("Erro ao ler o JSON:", e)
        return

    cores = data.get("cores", [])
    if len(cores) != 2:
        print("Erro: Precisamos exatamente de duas cores para comparar.")
        return

    cor1 = cores[0]
    cor2 = cores[1]

    try:
        l1 = calcular_luminosidade(cor1["c"], cor1["m"], cor1["y"], cor1["k"])
        l2 = calcular_luminosidade(cor2["c"], cor2["m"], cor2["y"], cor2["k"])
    except KeyError as e:
        print("Erro ao acessar os canais CMYK:", e)
        return

    if l1 > l2:
        mais_clara = cor1
    else:
        mais_clara = cor2

    nome = cor_para_string(mais_clara)
    print("OK:Mais clara é", nome)

if __name__ == "__main__":
    main()