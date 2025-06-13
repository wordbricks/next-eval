import { Hono } from 'hono';

const fetchApp = new Hono();

fetchApp.post('/', async (c) => {
  try {
    const { url } = await c.req.json();
    
    if (!url || typeof url !== 'string') {
      return c.json({ error: 'Missing or invalid URL.' }, 400);
    }
    
    if (!/^https?:\/\//i.test(url)) {
      return c.json({ error: 'URL must start with http:// or https://.' }, 400);
    }
    
    const response = await fetch(url, { 
      method: 'GET', 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NextEvalBot/1.0)' } 
    });
    
    if (!response.ok) {
      return c.json({ 
        error: `Failed to fetch URL: ${response.status} ${response.statusText}` 
      }, 500);
    }
    
    const html = await response.text();
    return c.json({ html });
  } catch (error: any) {
    return c.json({ 
      error: error?.message || 'Unknown error.' 
    }, 500);
  }
});

export default fetchApp;