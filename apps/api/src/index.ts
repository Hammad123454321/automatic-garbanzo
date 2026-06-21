import http from 'http';
import { Server as SocketIO } from 'socket.io';
import app from './app';
import { config } from './config/env';
import { prisma } from './config/prisma';

const server = http.createServer(app);

// Socket.io for real-time LAN sync between stations
const io = new SocketIO(server, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  const { storeId } = socket.handshake.query;
  if (storeId) {
    socket.join(`store:${storeId}`);
    console.log(`Device connected to store:${storeId}`);
  }

  // Broadcast order updates to all terminals in store
  socket.on('order:update', (data) => {
    socket.to(`store:${data.storeId}`).emit('order:update', data);
  });

  // Broadcast table status updates
  socket.on('table:update', (data) => {
    socket.to(`store:${data.storeId}`).emit('table:update', data);
  });

  // Broadcast menu/product updates
  socket.on('catalog:update', (data) => {
    socket.to(`store:${data.storeId}`).emit('catalog:update', data);
  });

  // KDS (Kitchen Display System) — new order notification
  socket.on('kds:order', (data) => {
    socket.to(`store:${data.storeId}`).emit('kds:order', data);
  });

  // Customer display sync
  socket.on('customer-display:update', (data) => {
    socket.to(`store:${data.storeId}`).emit('customer-display:update', data);
  });

  socket.on('disconnect', () => {
    console.log(`Device disconnected from store:${storeId}`);
  });
});

// Export io for use in routes
export { io };

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    process.exit(1);
  }

  server.listen(config.port, () => {
    console.log(`✓ POS API running on http://localhost:${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}`);
  });
}

bootstrap();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
