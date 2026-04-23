import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('focus_stats.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS focus_stats (
    date TEXT PRIMARY KEY,
    duration INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS focus_timer_state (
    user_id TEXT PRIMARY KEY,
    is_active INTEGER DEFAULT 0,
    start_time INTEGER,
    last_updated INTEGER
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  app.use(express.json());

  // Timer State Helpers
  const getTimerState = (userId: string) => {
    const row: any = db.prepare('SELECT * FROM focus_timer_state WHERE user_id = ?').get(userId);
    if (!row) {
      return { is_active: false, start_time: null };
    }
    return { 
      is_active: row.is_active === 1, 
      start_time: row.start_time 
    };
  };

  const updateTimerState = (userId: string, is_active: boolean, start_time: number | null) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO focus_timer_state (user_id, is_active, start_time, last_updated) VALUES (?, ?, ?, ?)');
    stmt.run(userId, is_active ? 1 : 0, start_time, Date.now());
  };

  // API Routes for Focus Stats
  app.get('/api/focus-stats', (req, res) => {
    try {
      const stats = db.prepare('SELECT * FROM focus_stats').all();
      // Convert array to object mapping
      const statsMap = stats.reduce((acc: any, curr: any) => {
        acc[curr.date] = curr.duration;
        return acc;
      }, {});
      res.json(statsMap);
    } catch (error) {
      console.error('Error fetching focus stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/focus-stats', (req, res) => {
    const { date, duration } = req.body;
    if (!date || typeof duration !== 'number') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO focus_stats (date, duration) VALUES (?, ?)');
      stmt.run(date, duration);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating focus stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Socket.io Events
  io.on('connection', (socket) => {
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(userId);
        // Send current state to the client that just joined
        socket.emit('timer_sync', getTimerState(userId));
      }
    });

    socket.on('timer_toggle', (data) => {
      // data: { userId: string, is_active: boolean, start_time: number | null }
      if (data.userId) {
        updateTimerState(data.userId, data.is_active, data.start_time);
        // Broadcast to all other devices in the same user room
        socket.to(data.userId).emit('timer_sync', {
          is_active: data.is_active,
          start_time: data.start_time
        });
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database connected and focus_timer_state table initialized.`);
  });
}

startServer();
