import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter, mlRouter } from './src/server/routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRouter);
app.use('/ml', mlRouter);

// Serve static build assets if available
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Land Acquisition Risk Assessment Platform - Dev / Production Mode');
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Land Acquisition Platform running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
