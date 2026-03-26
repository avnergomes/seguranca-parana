Base dos Dados / FBSP
=====================

This dataset requires a Google Cloud billing project.
See: https://basedosdados.org/dataset/br-fbsp-atlas-violencia?bdm_table=municipio

Run:
  pip install basedosdados
  import basedosdados as bd
  df = bd.read_table("br_fbsp_atlas_violencia", "municipio",
                     billing_project_id="SEU_PROJETO")
  df.to_csv("atlas_fbsp.csv", index=False)
