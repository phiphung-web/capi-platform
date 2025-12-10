import { Router } from 'express';
import { processPendingDeliveries } from '../services/deliveryService';

const adminRouter = Router();

adminRouter.post('/process-deliveries', async (req, res) => {
  const token = req.header('x-admin-token');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  const processed = await processPendingDeliveries();
  return res.json({ success: true, processed });
});

export default adminRouter;
