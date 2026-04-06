
import { GoogleGenAI, Type } from "@google/genai";
import type { User, Facility, RouteType } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function optimizeRoute(users: User[], facility: Facility, routeType: RouteType): Promise<string[]> {
  const userList = users.map(u => `- ${u.name}: ${u.address} (希望時間: ${u.desiredTime || '指定なし'})`).join('\n');

  const morningRouteDescription = `
お迎えルート（午前の送迎）の計画です。
ルートの順序は、事業所「${facility.name}」から最も遠い利用者を最初に訪問し、その後、事業所に近づいてくるように他の利用者を順番に訪問する形で構成してください。これにより、全員を乗せたあとの事業所への戻りがスムーズになります。
`;

  const afternoonRouteDescription = `
お送りルート（午後の送迎）の計画です。
ルートの順序は、事業所「${facility.name}」から最も近い利用者を最初に訪問し、その後、事業所から遠ざかっていくように他の利用者を順番に訪問する形で構成してください。これにより、無駄な往復を減らすことができます。
`;

  const routeDescription = routeType === 'morning' ? morningRouteDescription : afternoonRouteDescription;

  const prompt = `
  あなたは日本のデイサービスの送迎ルートを計画する熟練のロジスティクス専門家です。
  あなたの任務は、指定された利用者リストに基づいて、最も効率的な送迎ルートを作成することです。
  ルートは必ず「${facility.name}（住所: ${facility.address}）」から出発し、すべての利用者を訪問した後、事業所に戻る必要があります。

  ${routeDescription}

  上記の訪問順序を基本としつつ、利用者が希望する送迎時間（「希望時間」）も考慮に入れてください。
  希望時間がある利用者は、その時間のできるだけ近くに訪問できるように、全体の順序を多少調整しても構いません。
  しかし、基本的な「遠い順」または「近い順」の原則から大きく逸脱しないようにしてください。

  利用者リスト:
  ${userList}

  指示:
  最適化された訪問順序を、利用者の名前のJSON配列として返してください。
  例: ["佐藤 次郎", "田中 太郎", "鈴木 花子"]
  JSON配列以外のテキストは含めないでください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: '利用者の名前'
          }
        },
      }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    if (Array.isArray(result) && result.every(item => typeof item === 'string')) {
        // Ensure all users from the input are present in the output
        const returnedNames = new Set(result);
        const inputNames = new Set(users.map(u => u.name));
        if (returnedNames.size !== inputNames.size || !users.every(u => returnedNames.has(u.name))) {
            console.warn("Gemini response did not include all users. Falling back to original order.");
            return users.map(u => u.name);
        }
        return result;
    } else {
      throw new Error("API response is not a valid string array.");
    }
  } catch (error) {
    console.error("Error optimizing route with Gemini:", error);
    // Fallback to original order if API fails
    return users.map(u => u.name);
  }
}
