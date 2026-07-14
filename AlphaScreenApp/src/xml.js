// Alpha Screen - puxa o screening do XML da OS (mesma pasta do Xml_upload)
const fs = require("fs");
const path = require("path");

function folderOS(os) {
  return "\\\\aeserver16\\Engine\\_Jobfolder\\" + os + "\\_xml\\";
}

function latestXml(dir) {
  let files;
  try { files = fs.readdirSync(dir).filter(f => /\.xml$/i.test(f)); } catch (e) { return null; }
  if (!files.length) return null;
  files.sort(); // o mais recente por ultimo (mesmo criterio do Xml_upload: reverse -> [0])
  return path.join(dir, files[files.length - 1]);
}

// retorna { os, produto, inks:[{nome, ang, lpi, dot, tipo, ref, dual, base, book}] }
function pull(os) {
  os = String(os).match(/(\d{6,})/);
  if (!os) return { erro: "Informe a OS." };
  os = os[1];
  const dir = folderOS(os);
  const xmlFile = latestXml(dir);
  if (!xmlFile) return { erro: "Sem XML acessível pra OS " + os + " (" + dir + ")." };

  let txt;
  try { txt = fs.readFileSync(xmlFile, "utf8"); } catch (e) { return { erro: "Não li o XML: " + e.message }; }

  const inks = [];
  const inkRe = /<Ink\b([^>]*)\/?>/g;
  let m;
  while ((m = inkRe.exec(txt)) !== null) {
    const at = m[1];
    const get = (k) => { const r = new RegExp(k + '="([^"]*)"').exec(at); return r ? r[1] : ""; };
    const nome = get("Name");
    if (!nome || nome === "All") continue;
    const dual = nome.slice(0, 2) === "##";
    inks.push({
      nome, ang: get("Angle"), lpi: get("LPI"), dot: get("DotShape"),
      tipo: get("Type"), ref: get("Ref"), book: get("Book"),
      dual, base: dual ? nome.slice(2) : nome
    });
  }
  if (!inks.length) return { erro: "XML da OS " + os + " sem tintas." };
  const prod = (/<Order\b[^>]*Product="([^"]*)"/.exec(txt) || [])[1] || "";
  return { os, produto: prod, inks };
}

module.exports = { pull, folderOS };
