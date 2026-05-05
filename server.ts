import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import sharp from 'sharp';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { Pool } from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Infrastructure Clients
let rawRedisUrl = process.env.REDIS_URL || '';
// Extract URL if the user accidentally pasted the entire redis-cli command
let parsedRedisUrl = rawRedisUrl.match(/redis(?:s)?:\/\/[^\s]+/)?.[0] || rawRedisUrl;

const redisOpts: any = {
  maxRetriesPerRequest: 3,
};

// Upstash and --tls require TLS configuration
if (parsedRedisUrl && (parsedRedisUrl.includes('upstash.io') || rawRedisUrl.includes('--tls') || parsedRedisUrl.startsWith('rediss://'))) {
  redisOpts.tls = { rejectUnauthorized: false };
}

const redis = parsedRedisUrl ? new Redis(parsedRedisUrl, redisOpts) : null;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

if (pool) {
  // Initialize simple tracking table if not exists
  pool.query(`
    CREATE TABLE IF NOT EXISTS click_tracking (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      session_id TEXT,
      source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(err => console.error('Postgres tracking init error:', err));

  pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      image_url TEXT,
      price NUMERIC,
      original_price NUMERIC,
      currency TEXT,
      rating NUMERIC,
      review_count INTEGER,
      specs JSONB,
      affiliate_url TEXT,
      campaign_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(err => console.error('Postgres products init error:', err));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Impact.com credentials (REQUIRED)
  // Support comma-separated SIDs/Tokens for "all partners" request
  const SIDs = (process.env.IMPACT_ACCOUNT_SID || '').split(',').map(s => s.trim()).filter(Boolean);
  const TOKENS = (process.env.IMPACT_AUTH_TOKEN || '').split(',').map(s => s.trim()).filter(Boolean);
  const PROGRAM_IDS = (process.env.IMPACT_PROGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

  // Optional/Configurable
  const IMPACT_ACTION_ID = '15219';
  const IMPACT_PARTNER_PROPERTY_ID = '6988584';

  const hasImpactCreds = SIDs.length > 0 && TOKENS.length > 0;

  function getAuth(index: number) {
    let sid = SIDs[index] || SIDs[0];
    let token = TOKENS[index] || TOKENS[0];
    // Auto-swap if they accidentally put the Token in the SID field
    if (sid && token && sid.length > 20 && token.length < 15) {
      const temp = sid;
      sid = token;
      token = temp;
    }
    return { sid, token, header: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` };
  }

  function normalizeProduct(raw: any, sid: string) {
    const price = parseFloat(raw.Price || raw.CurrentPrice || '0');
    const originalPrice = raw.OriginalPrice ? parseFloat(raw.OriginalPrice) : null;
    
    const campaignId = raw.CatalogId || PROGRAM_IDS[0] || '1236776';
    const actionId = IMPACT_ACTION_ID;
    
    // Use the tracking URL if provided, otherwise manually construct
    const destUrl = raw.TrackingUrl || raw.TrackingLink || raw.ProductUrl || raw.Url || 'https://www.buybestgear.com';
    
    let affiliateUrl = destUrl;
    if (!affiliateUrl.includes('/c/') && !affiliateUrl.includes('sjv.io') && !affiliateUrl.includes('impact.com')) {
      affiliateUrl = `https://buybestgear.sjv.io/c/${sid}/${campaignId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${IMPACT_PARTNER_PROPERTY_ID}`;
    }

    return {
      id: String(raw.Id || raw.ProductId || Math.random().toString(36).substring(7)),
      name: String(raw.Name || raw.ProductName || 'Premium Gear'),
      category: String(raw.Category || 'Discovery'),
      imageUrl: String(raw.ImageUri || raw.ImageLink || raw.ImageUrl || ''),
      price,
      originalPrice: (originalPrice && originalPrice > price) ? originalPrice : null,
      currency: String(raw.Currency || 'USD'),
      rating: raw.Rating ? parseFloat(raw.Rating) : 4.8,
      reviewCount: raw.ReviewCount ? parseInt(raw.ReviewCount) : Math.floor(Math.random() * 2000),
      specs: raw.Description ? raw.Description.split('.').slice(0, 2).map((s: string) => s.trim()).filter(Boolean) : ['High Performance', 'Minimalist Design'],
      affiliateUrl,
      campaignId
    };
  }

  let isSyncing = false;
  async function syncImpactProducts() {
    if (!pool || !hasImpactCreds || isSyncing) return;
    isSyncing = true;
    console.log('Background Sync: Fetching products from Impact API...');

    try {
      for (let i = 0; i < SIDs.length; i++) {
        const { sid, header } = getAuth(i);
        const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
          headers: { 'Accept': 'application/json', 'Authorization': header }
        }).catch(() => null);

        if (!catRes || !catRes.data || !catRes.data.Catalogs) continue;
        const catalogs = catRes.data.Catalogs;
        const activeCatalogs = (catalogs as any[]).sort(() => Math.random() - 0.5).slice(0, 5);

        for (const cat of activeCatalogs) {
          const cid = cat.Id || cat.CatalogId;
          if (!cid) continue;
          
          let itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/Items`, {
            headers: { 'Accept': 'application/json', 'Authorization': header },
            params: { PageSize: 50, Page: 1 }
          }).catch(() => null);

          if (!itemsRes) {
             itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch`, {
                headers: { 'Accept': 'application/json', 'Authorization': header },
                params: { CatalogId: cid, PageSize: 50, Page: 1, QueryString: '*' }
             }).catch(() => null);
          }

          if (!itemsRes || !itemsRes.data) continue;
          const items = itemsRes.data.Items || itemsRes.data.Products || [];

          for (const raw of items) {
             const p = normalizeProduct(raw, sid);
             if (!p.imageUrl || p.price === 0) continue; // Skip bad data
             
             await pool.query(`
               INSERT INTO products (id, name, category, image_url, price, original_price, currency, rating, review_count, specs, affiliate_url, campaign_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, image_url = EXCLUDED.image_url, affiliate_url = EXCLUDED.affiliate_url
             `, [
               p.id, p.name, p.category, p.imageUrl, p.price, p.originalPrice, p.currency, p.rating, p.reviewCount, JSON.stringify(p.specs), p.affiliateUrl, p.campaignId
             ]).catch(() => {});
          }
        }
      }
      console.log('Background Sync: Completed');
    } catch (e: any) {
      console.error('Background Sync: Failed', e.message);
    } finally {
      isSyncing = false;
    }
  }

  // API Routes
  app.get('/api/feed', async (req, res) => {
    try {
      if (pool) {
        let count = 0;
        try {
           const c = await pool.query('SELECT COUNT(*) FROM products');
           count = parseInt(c.rows[0].count, 10);
        } catch (e) {}

        if (count < 100 || Math.random() < 0.2) {
          syncImpactProducts(); // Fire and forget background sync
        }

        if (count > 0) {
          const result = await pool.query('SELECT * FROM products ORDER BY RANDOM() LIMIT 20');
          const products = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            category: row.category,
            imageUrl: row.image_url,
            price: parseFloat(row.price),
            originalPrice: row.original_price ? parseFloat(row.original_price) : null,
            currency: row.currency,
            rating: row.rating ? parseFloat(row.rating) : 4.8,
            reviewCount: row.review_count,
            specs: typeof row.specs === 'string' ? JSON.parse(row.specs) : (row.specs || []),
            affiliateUrl: row.affiliate_url,
            campaignId: row.campaign_id
          }));
          return res.json(products);
        }
      }
      
      const mock = generateMockProducts(20, Math.floor(Math.random() * 100));
      return res.json(mock);
    } catch (error: any) {
      res.json(generateMockProducts(20, Math.floor(Math.random() * 100)));
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.json([]);

      if (pool) {
         try {
           const result = await pool.query(`
             SELECT * FROM products 
             WHERE name ILIKE $1 OR category ILIKE $1 OR specs::text ILIKE $1
             ORDER BY RANDOM() LIMIT 20
           `, [`%${query}%`]);

           if (result.rows.length > 0) {
              const products = result.rows.map(row => ({
                id: row.id,
                name: row.name,
                category: row.category,
                imageUrl: row.image_url,
                price: parseFloat(row.price),
                originalPrice: row.original_price ? parseFloat(row.original_price) : null,
                currency: row.currency,
                rating: row.rating ? parseFloat(row.rating) : 4.8,
                reviewCount: row.review_count,
                specs: typeof row.specs === 'string' ? JSON.parse(row.specs) : (row.specs || []),
                affiliateUrl: row.affiliate_url,
                campaignId: row.campaign_id
              }));
              return res.json(products);
           }
         } catch (e) {}
      }

      if (hasImpactCreds) {
        const partnerRequests = SIDs.map(async (rawSid, index) => {
          const { sid, header } = getAuth(index);
          try {
            // First get all catalogs for this partner
            const catResponse = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
              headers: { 'Accept': 'application/json', 'Authorization': header }
            });
            const catalogs = catResponse.data.Catalogs || [];
            
            const cids = (catalogs as any[]).slice(0, 3).map(c => c.Id || c.CatalogId).filter(Boolean);
            if (cids.length === 0) cids.push('');

            const searchPromises = cids.map(cid => 
              axios.get(
                `https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch`,
                {
                  headers: { 
                    'Accept': 'application/json',
                    'Authorization': header
                  },
                  params: {
                    QueryString: query, // Using QueryString as it's common, fallback to Keywords
                    PageSize: 10,
                    Page: 1,
                    ...(cid ? { CatalogId: cid } : {})
                  }
                }
              ).catch(e => {
                // Silently skip
                return null;
              })
            );

            const responses = await Promise.all(searchPromises);
            const allItems = responses.flatMap(r => {
              if (!r || !r.data || r.data.Status === 'ERROR') return [];
              return (r.data.Items || r.data.Products || []).map((p: any) => normalizeProduct(p, sid));
            });

            return allItems;
          } catch (e: any) {
            // Silently skip search errors
            return [];
          }
        });

        const results = await Promise.all(partnerRequests);
        const products = results.flat();
        return res.json(products);
      }
      
      const products = generateMockProducts(10, 0).filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.category.toLowerCase().includes(query.toLowerCase())
      );
      res.json(products);
    } catch (error) {
      res.json([]);
    }
  });

  app.get('/api/image', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) return res.status(400).send('URL required');

      // Use Redis for image metadata caching
      const imgCacheKey = `img:meta:${Buffer.from(imageUrl).toString('base64').substring(0, 100)}`;
      if (redis) {
        const cached = await redis.get(imgCacheKey);
        if (cached) return res.json(JSON.parse(cached));
      }

      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const stats = await image.stats();
      
      const dominant = stats.channels.map(c => Math.round(c.mean));
      const isWhiteBg = dominant.every(v => v > 240);
      
      const result = {
        hasBg: !isWhiteBg,
        dominantColor: `rgb(${dominant[0]}, ${dominant[1]}, ${dominant[2]})`,
        aspectRatio: (metadata.width || 1) / (metadata.height || 1)
      };

      if (redis) await redis.set(imgCacheKey, JSON.stringify(result), 'EX', 86400 * 7); // 7 days cache
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Image processing failed' });
    }
  });

  app.post('/api/track', async (req, res) => {
    const { productId, source, sessionId } = req.body;
    console.log('Tracking click:', req.body);
    
    if (pool) {
      await pool.query(
        'INSERT INTO click_tracking (product_id, source, session_id) VALUES ($1, $2, $3)',
        [productId, source, sessionId || null]
      ).catch(err => console.error('Tracking db error:', err));
    }

    res.status(202).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving logic
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

function generateMockProducts(count: number, page: number): any[] {
  const categories = ['Audio', 'Tech', 'Gaming', 'Cameras', 'Home', 'Fitness', 'Outdoor'];
  const images = [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=1000',
  ];

  return Array.from({ length: count }).map((_, i) => {
    const id = `mock-${page}-${i}`;
    const name = `Premium ${categories[i % categories.length]} Gear ${i + page * 20}`;
    const category = categories[i % categories.length].toUpperCase();
    const imageUrl = images[i % images.length];
    const price = Math.floor(Math.random() * 500) + 99;
    
    const campaignId = '1236776';
    const actionId = '15219';
    const partnerId = '6988584';
    const destUrl = `https://www.buybestgear.com/products/${id}`;
    const affiliateUrl = `https://buybestgear.sjv.io/c/6183063/${campaignId}/${actionId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${partnerId}`;

    return {
      id,
      name,
      category,
      imageUrl,
      price,
      originalPrice: Math.random() > 0.5 ? price + 100 : null,
      currency: 'USD',
      rating: (Math.random() * 1 + 4).toFixed(1),
      reviewCount: Math.floor(Math.random() * 5000),
      specs: ['Pro Performance', 'Sleek Design'],
      affiliateUrl
    };
  });
}
