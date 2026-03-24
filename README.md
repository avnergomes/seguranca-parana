# Seguranca Parana -- DataGeo Parana

Dashboard de inteligencia territorial para seguranca publica do Parana.

Painel interativo que reune indicadores criminais, socioeconomicos e demograficos dos 399 municipios paranaenses, permitindo analise comparativa por municipio, regiao e serie historica.

> **10o painel** do ecossistema [DataGeo Parana](https://github.com/datageo-parana) -- plataforma de paineis tematicos georreferenciados sobre o estado do Parana.

---

## Indicadores

- Homicidios dolosos (taxa por 100 mil hab.)
- Latrocinios e lesoes corporais seguidas de morte
- Roubos e furtos (total e por subtipo)
- Trafico e apreensao de drogas
- Violencia domestica e feminicidios
- Acidentes de transito com vitimas
- Efetivo policial e viaturas por habitante
- IDH, Gini, taxa de desemprego e renda per capita
- Populacao e densidade demografica

---

## Fontes de Dados

| Sigla | Fonte | Descricao |
|-------|-------|-----------|
| SINESP | Sistema Nacional de Informacoes de Seguranca Publica | Ocorrencias criminais agregadas por municipio |
| IPARDES | Instituto Paranaense de Desenvolvimento Economico e Social | Indicadores socioeconomicos e demograficos |
| SESP-PR / CAPE | Secretaria de Seguranca Publica do Parana | Boletins estatisticos e relatorios trimestrais |
| IBGE | Instituto Brasileiro de Geografia e Estatistica | Populacao, PIB municipal, malha geometrica |
| Atlas / IPEA | Atlas do Desenvolvimento Humano / IPEA | IDH-M, Gini, vulnerabilidade social |
| FBSP | Forum Brasileiro de Seguranca Publica | Anuario Brasileiro de Seguranca Publica |

---

## Estrutura do Projeto

```
seguranca-parana/
  .github/workflows/   CI/CD (deploy e pipeline de dados)
  dashboard/            Frontend React + Vite
    src/
      components/       Componentes visuais (mapas, graficos, tabelas)
      hooks/            Hooks customizados
      utils/            Funcoes utilitarias
    public/             Assets estaticos
  data/
    raw/                Dados brutos baixados das fontes
    processed/          Dados limpos prontos para o dashboard
  scripts/              Scripts Python de coleta e preprocessamento
  mun_PR.json           GeoJSON dos municipios do Parana
```

---

## Desenvolvimento

### Pre-requisitos

- Node.js 20+
- Python 3.12+

### Setup

```bash
# Instalar dependencias Python
pip install -r scripts/requirements.txt

# Preprocessar dados
python scripts/preprocess_data.py

# Instalar dependencias do dashboard
cd dashboard
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

O dashboard estara disponivel em `http://localhost:5173`.

---

## Deploy

O deploy e automatico via GitHub Actions. Todo push na branch `main` dispara o workflow que:

1. Preprocessa os dados com Python
2. Compila o dashboard com Vite
3. Publica no GitHub Pages

A atualizacao dos dados brutos ocorre trimestralmente (jan, abr, jul, out) pelo workflow `data-pipeline.yml`.

---

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Graficos:** Recharts + D3.js
- **Mapas:** Leaflet + React-Leaflet
- **Dados:** Python (pandas, openpyxl, pdfplumber)
- **Deploy:** GitHub Pages via GitHub Actions

---

## Aviso sobre Sensibilidade dos Dados

Este painel utiliza dados publicos agregados de seguranca publica. Nenhuma informacao permite a identificacao de vitimas ou suspeitos individuais. Os dados sao apresentados em nivel municipal e destinam-se exclusivamente a analise territorial e formulacao de politicas publicas. O uso indevido das informacoes para fins discriminatorios ou estigmatizantes e de inteira responsabilidade do usuario.
