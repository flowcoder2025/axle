/**
 * Financial Narrative Service
 *
 * Uses AI to generate a Korean-language financial analysis narrative
 * from ClientFinancial data and computed ratios.
 */

import { prisma } from "@axle/db";
import { completeWithFallback } from "@axle/ai";

const FINANCIAL_PROMPT = `You are a Korean business financial analyst. Given financial data and ratios, write a concise analysis narrative in Korean (3-5 paragraphs). Cover: overall health, profitability, debt structure, and recommendations. Use specific numbers.`;

export async function generateFinancialNarrative(
  clientId: string,
  year: number
): Promise<string> {
  const financial = await prisma.clientFinancial.findFirst({
    where: { clientId, year },
  });

  if (!financial) {
    throw new Error(`No financial data for client ${clientId} year ${year}`);
  }

  const totalEquity = Number(financial.totalEquity) || 0;
  const totalLiabilities = Number(financial.totalLiabilities) || 0;
  const revenue = Number(financial.revenue) || 0;
  const operatingProfit = Number(financial.operatingProfit) || 0;
  const netProfit = Number(financial.netProfit) || 0;

  const ratios = {
    debtRatio:
      totalEquity > 0
        ? ((totalLiabilities / totalEquity) * 100).toFixed(1)
        : "N/A",
    operatingMargin:
      revenue > 0
        ? ((operatingProfit / revenue) * 100).toFixed(1)
        : "N/A",
    netMargin:
      revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "N/A",
    roe:
      totalEquity > 0
        ? ((netProfit / totalEquity) * 100).toFixed(1)
        : "N/A",
  };

  const result = await completeWithFallback("FINANCIAL_ANALYSIS", {
    system: FINANCIAL_PROMPT,
    prompt: JSON.stringify({ year, financial, ratios }),
  });

  return result.text;
}
