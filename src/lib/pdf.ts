import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { brl, fmtDate, fmtDateTime, fmtPhone } from "./format";

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const INK = rgb(0.04, 0.04, 0.04);
const MUTED = rgb(0.45, 0.43, 0.42);
const LINE = rgb(0.9, 0.89, 0.88);

export type Company = { trade_name: string; legal_name: string; document: string | null; address: string | null; city: string | null; state: string | null; email: string | null; phone: string | null; website: string | null; instagram: string | null; bank_info: string | null; proposal_footer: string | null };

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = 0;
  private cache = new Map<string, boolean>();
  constructor(private company: Company, private docLabel: string) {}

  async init() {
    this.doc = await PDFDocument.create();
    this.doc.setTitle(`${this.docLabel} — ${this.company.trade_name}`);
    this.doc.setProducer("Retrátil Film — Sistema de Gestão Audiovisual");
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  /** Remove caracteres que a fonte padrão (WinAnsi) não consegue codificar. */
  clean(s: string) {
    return Array.from(s.replace(/\t/g, "  ").replace(/[→]/g, "->"))
      .filter((ch) => {
        if (ch === "\n") return true;
        if (!this.cache.has(ch)) {
          try { this.font.encodeText(ch); this.cache.set(ch, true); } catch { this.cache.set(ch, false); }
        }
        return this.cache.get(ch);
      })
      .join("");
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    const [w, h] = A4;
    this.page.drawRectangle({ x: 0, y: h - 64, width: w, height: 64, color: INK });
    this.page.drawText(this.clean(this.company.trade_name.toUpperCase()), { x: M, y: h - 40, size: 15, font: this.bold, color: rgb(1, 1, 1) });
    const right = this.clean(this.docLabel.toUpperCase());
    this.page.drawText(right, { x: w - M - this.bold.widthOfTextAtSize(right, 9), y: h - 38, size: 9, font: this.bold, color: rgb(0.8, 0.8, 0.8) });
    const contact = this.clean([this.company.phone, this.company.email, this.company.instagram, this.company.website].filter(Boolean).join("   ·   "));
    this.page.drawText(contact, { x: M, y: 26, size: 8, font: this.font, color: MUTED });
    const pn = `Página ${this.doc.getPageCount()}`;
    this.page.drawText(pn, { x: w - M - this.font.widthOfTextAtSize(pn, 8), y: 26, size: 8, font: this.font, color: MUTED });
    this.y = h - 64 - 36;
  }

  ensure(space: number) {
    if (this.y - space < 56) this.newPage();
  }

  wrap(text: string, size: number, maxWidth: number, font = this.font) {
    const lines: string[] = [];
    for (const para of this.clean(text).split("\n")) {
      if (!para.trim()) { lines.push(""); continue; }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
        else {
          if (line) lines.push(line);
          line = word;
          while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? M;
    const width = opts.width ?? A4[0] - M - x;
    for (const line of this.wrap(text, size, width, font)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size * 1.45;
    }
    this.y -= opts.gap ?? 0;
  }

  label(t: string) {
    this.ensure(30);
    this.y -= 6;
    this.text(t.toUpperCase(), { size: 8, bold: true, color: MUTED, gap: 2 });
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 10;
  }

  rightText(t: string, xRight: number, y: number, size = 10, bold = false) {
    const f = bold ? this.bold : this.font;
    const c = this.clean(t);
    this.page.drawText(c, { x: xRight - f.widthOfTextAtSize(c, size), y, size, font: f, color: INK });
  }
}

export type ProposalPdf = {
  code: string; title: string; created_at: Date; valid_until: string | null; payment_terms: string | null; notes: string | null;
  subtotal: number; total: number; discount_type: string; discount_value: number; status: string;
  client: { name: string; company: string | null; document: string | null; email: string | null; phone: string | null; city: string | null };
  items: { description: string; quantity: number; unit_price: number }[];
};

export async function proposalPdf(company: Company, p: ProposalPdf): Promise<Uint8Array> {
  const w = new Writer(company, `Proposta ${p.code}`);
  await w.init();
  w.text("PROPOSTA COMERCIAL", { size: 9, bold: true, color: MUTED });
  w.text(p.title, { size: 20, bold: true, gap: 4 });
  w.text(`${p.code}   ·   Emitida em ${fmtDate(p.created_at)}${p.valid_until ? `   ·   Válida até ${fmtDate(p.valid_until)}` : ""}`, { size: 9, color: MUTED, gap: 10 });

  w.label("Cliente");
  w.text(p.client.name + (p.client.company ? ` — ${p.client.company}` : ""), { bold: true });
  const cl = [p.client.document, p.client.email, p.client.phone ? fmtPhone(p.client.phone) : null, p.client.city].filter(Boolean).join("  ·  ");
  if (cl) w.text(cl, { size: 9, color: MUTED });
  w.y -= 10;

  w.label("Serviços");
  const xQ = 350, xU = 450, xT = A4[0] - M; // bordas direitas das colunas Qtd., Unitário e Total
  w.ensure(20);
  w.page.drawText("Descrição", { x: M, y: w.y - 8, size: 8, font: w.bold, color: MUTED });
  w.rightText("Qtd.", xQ, w.y - 8, 8, true);
  w.rightText("Valor unit.", xU, w.y - 8, 8, true);
  w.rightText("Total", xT, w.y - 8, 8, true);
  w.y -= 14;
  w.rule();
  for (const it of p.items) {
    const lines = w.wrap(it.description, 10, xQ - M - 50);
    w.ensure(lines.length * 14 + 8);
    const top = w.y;
    w.rightText(String(it.quantity).replace(".", ","), xQ, top - 10);
    w.rightText(brl(it.unit_price), xU, top - 10);
    w.rightText(brl(it.quantity * it.unit_price), xT, top - 10, 10, true);
    w.text(it.description, { width: xQ - M - 50 });
    w.y -= 4;
    w.rule();
  }
  const discount = p.subtotal - p.total;
  const rows: [string, string, boolean][] = [["Subtotal", brl(p.subtotal), false]];
  if (discount > 0) rows.push([`Desconto${p.discount_type === "percentual" ? ` (${String(p.discount_value).replace(".", ",")}%)` : ""}`, `- ${brl(discount)}`, false]);
  rows.push(["Total", brl(p.total), true]);
  for (const [l, v, b] of rows) {
    w.ensure(18);
    w.rightText(l, xU - 20, w.y - 10, b ? 12 : 10, b);
    w.rightText(v, xT, w.y - 10, b ? 12 : 10, b);
    w.y -= b ? 22 : 16;
  }
  if (p.payment_terms) { w.label("Condições de pagamento"); w.text(p.payment_terms, { gap: 6 }); }
  if (company.bank_info) { w.label("Dados para pagamento"); w.text(company.bank_info, { gap: 6 }); }
  if (p.notes) { w.label("Observações"); w.text(p.notes, { gap: 6 }); }
  if (company.proposal_footer) { w.y -= 6; w.rule(); w.text(company.proposal_footer, { size: 9, color: MUTED }); }
  w.y -= 8;
  w.text(`${company.legal_name}${company.document ? ` · ${company.document}` : ""}${company.city ? ` · ${company.city}${company.state ? "/" + company.state : ""}` : ""}`, { size: 8, color: MUTED });
  w.text(`Documento gerado em ${fmtDateTime(new Date())}.`, { size: 8, color: MUTED });
  return w.doc.save();
}

export async function contractPdf(company: Company, c: { code: string; title: string; body: string; status: string }): Promise<Uint8Array> {
  const w = new Writer(company, `Contrato ${c.code}`);
  await w.init();
  if (c.status === "rascunho") w.text("RASCUNHO — documento sem validade até a emissão", { size: 8, bold: true, color: rgb(0.7, 0.1, 0.1), gap: 6 });
  for (const [i, line] of c.body.split("\n").entries()) {
    const isHeading = /^(CL[ÁA]USULA|CONTRATO)\b/.test(line.trim());
    if (i === 0 && line.trim()) { w.text(line.trim(), { size: 13, bold: true, gap: 8 }); continue; }
    w.text(line || " ", { size: 10, bold: isHeading });
  }
  w.y -= 10;
  w.text(`${c.code} · gerado em ${fmtDateTime(new Date())}. Assinatura digital não integrada: colete as assinaturas manualmente.`, { size: 7, color: MUTED });
  return w.doc.save();
}
