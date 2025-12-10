import express from 'express';
import cors from 'cors';

import { env } from './config/env';
import router from './routes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true });
});

app.use('/v1', router);

app.listen(env.port, () => {
  console.log(`Server is running on port ${env.port}`);
});
