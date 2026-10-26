"use server";

import { runForm, type FormState } from "@/lib/actions";
import { companySchema, parse } from "@/lib/validation";

export async function saveCompany(_: FormState, fd: FormData) {
  return runForm("configuracoes", async (db) => {
    const d = parse(companySchema, fd);
    await db.exec(
      "update company_settings set legal_name=$1, trade_name=$2, document=$3, address=$4, city=$5, state=$6, email=$7, phone=$8, website=$9, instagram=$10, bank_info=$11, proposal_footer=$12 where id = 1",
      [d.legal_name, d.trade_name, d.document, d.address, d.city, d.state?.toUpperCase() ?? null, d.email, d.phone, d.website, d.instagram, d.bank_info, d.proposal_footer],
    );
    return { message: "Dados da empresa salvos." };
  });
}
