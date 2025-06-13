import { Hono } from "hono";
import { supabaseClient } from "@/app/api/utils";

const saveHtmlApp = new Hono();

saveHtmlApp.post("/", async (c) => {
  try {
    const { htmlId, htmlContent } = await c.req.json();

    if (!htmlId || !htmlContent) {
      return c.json({ error: "Missing htmlId or htmlContent" }, 400);
    }

    const { data, error } = await supabaseClient
      .from("next_eval_user_htmls")
      .insert([{ id: htmlId, html: htmlContent }]);

    if (error) {
      console.error("Supabase error:", error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data }, 200);
  } catch (error) {
    console.error("Save HTML API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return c.json({ error: errorMessage }, 500);
  }
});

export default saveHtmlApp;
