import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: "15mb" }));

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } else {
    console.warn("GEMINI_API_KEY is not set or has placeholder value.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini SDK:", error);
}

// 1. Text-to-Chart AI Query endpoint
app.post("/api/query-to-chart", async (req, res) => {
  try {
    const { query, revenueClosures = [], expenses = [] } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Gemini AI Service is not configured. Please add GEMINI_API_KEY to your Secrets.",
      });
    }

    // Prepare a concise summarized text context of user's financial dataset to keep token usage small & safe
    const summaryDataContext = {
      closuresCount: revenueClosures.length,
      expensesCount: expenses.length,
      recentClosures: revenueClosures.map((c: any) => ({
        customer: c.customerName,
        packageCost: c.packageCost,
        cashPaid: c.cashPaid,
        remaining: c.remainingAmount,
        paymentType: c.paymentType,
        date: c.closureDate,
        packageDetails: c.packageDetails,
      })),
      recentExpenses: expenses.map((e: any) => ({
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.date,
      })),
    };

    const systemInstruction = `You are an expert senior financial analyst and data visualization assistant.
Your goal is to parse natural language financial queries from the user and match/aggregate their financial data (provided as JSON in the prompt) into a highly structured CustomChartPayload to render interactive charts on the client dashboard.

Guidelines:
1. Interpret the user's plain-text query (e.g., "Show me a comparison of marketing costs vs sales closures for this year" or "payment type breakdown").
2. Query and process the raw local financial data context passed to you. Highlight trends, categories, dates, or payment methods as requested.
3. If user requests categories comparison (e.g. Marketing vs Salaries vs Operations), group expenses accordingly.
4. Output a consistent and strict JSON representation using the configured schema.
5. Provide beautiful, professional Tailwind/HEX hex-color pairings in the 'series' output. For example:
   - Revenue / Profits: Green hues ('#10b981', '#059669', '#34d399')
   - Expenses / Costs: Crimson or Coral hues ('#ef4444', '#f43f5e', '#fb7185')
   - Neutral Series: Blue, Indigo, Amber ('#3b82f6', '#4f46e5', '#f59e0b', '#8b5cf6')
6. Set the 'chartType' field to one of: 'bar' | 'line' | 'pie' | 'composed' | 'radar'.
   - Use 'pie' or 'bar' for categories breakdown.
   - Use 'line' or 'composed' or 'bar' for timeline trends.
7. Under the 'data' array, make sure every object contains 'name' (the label) and numerical keys (e.g., 'revenue', 'expense', 'value', 'outstanding' etc.) which MUST match the keys declared in your 'series' array.
8. Calculate total values properly. Do not guess; use math on the entries.`;

    const promptText = `
User Data Context:
${JSON.stringify(summaryDataContext, null, 2)}

User Request Query:
"${query}"

Answer the request by returning a JSON-format chart data payload representing the correct aggregation of the user's data matching the query.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A descriptive title for the chart reflecting the requested user query.",
            },
            chartType: {
              type: Type.STRING,
              description: "The chart type mapping to render. Options: bar, line, pie, composed, radar.",
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "X-axis label value (e.g., Month, Category, Name).",
                  },
                  value: { type: Type.NUMBER },
                  revenue: { type: Type.NUMBER },
                  expense: { type: Type.NUMBER },
                  outstanding: { type: Type.NUMBER },
                },
                required: ["name"],
              },
              description: "Aggregated chart entries.",
            },
            xAxisKey: {
              type: Type.STRING,
              description: "Default key for X-Axis, normally 'name'.",
            },
            series: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description: "Data metric key (value, revenue, expense, or outstanding) matching data properties.",
                  },
                  name: {
                    type: Type.STRING,
                    description: "Linguistic name label of this series plotted on the chart (e.g., 'Total Expense', 'Marketing ads').",
                  },
                  color: {
                    type: Type.STRING,
                    description: "HEX color string for style.",
                  },
                },
                required: ["key", "name", "color"],
              },
            },
            explanation: {
              type: Type.STRING,
              description: "1-2 sentence professional P&L trend annotation.",
            },
          },
          required: ["title", "chartType", "data", "xAxisKey", "series", "explanation"],
        },
      },
    });

    const outputText = response.text || "{}";
    const chartPayload = JSON.parse(outputText);
    return res.json(chartPayload);
  } catch (error: any) {
    console.error("AI Chart generating failure:", error);
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Configure Vite or production static server middleware
const setupServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`P&L Financial Tracker running at http://localhost:${PORT}`);
  });
};

setupServer().catch((err) => {
  console.error("Server failure setup:", err);
});
