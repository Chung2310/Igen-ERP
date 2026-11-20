import { CompanyModel } from "../../../../model/company.model.ts";

function normalizedCompanyCode(companyCode: string) {
  const code = String(companyCode || "").trim().toUpperCase();
  if (!code) throw new Error("Tài khoản chưa được gắn mã doanh nghiệp.");
  return code;
}

async function findCompany(companyCode: string) {
  const company = await CompanyModel.findOne({ code: normalizedCompanyCode(companyCode) })
    .select("+heygenConfig.apiKey");
  if (!company) throw new Error("Không tìm thấy doanh nghiệp.");
  return company;
}

function publicConfig(company: Awaited<ReturnType<typeof findCompany>>) {
  const hasCompanyApiKey = Boolean(String(company.get("heygenConfig.apiKey") || "").trim());
  return {
    companyCode: company.code,
    companyName: company.name,
    hasCompanyApiKey,
    hasEnvironmentKey: !hasCompanyApiKey && Boolean(String(process.env.HEYGEN_API_KEY || "").trim()),
  };
}

export const companyHeyGenService = {
  async getConfig(companyCode: string) {
    return publicConfig(await findCompany(companyCode));
  },

  async updateConfig(companyCode: string, apiKey: string) {
    const normalizedApiKey = String(apiKey || "").trim();
    if (!normalizedApiKey) throw new Error("Nhập API Key HeyGen trước khi lưu.");
    const company = await findCompany(companyCode);
    company.set("heygenConfig.apiKey", normalizedApiKey);
    await company.save();
    return publicConfig(company);
  },

  async clearConfig(companyCode: string) {
    const company = await findCompany(companyCode);
    company.set("heygenConfig.apiKey", "");
    await company.save();
    return publicConfig(company);
  },
};