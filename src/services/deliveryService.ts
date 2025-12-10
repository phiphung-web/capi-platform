import prisma from '../config/database';
import { sendFacebookEvent } from '../adapters/facebookAdapter';

export async function processPendingDeliveries(limit = 50): Promise<number> {
  const logs = await prisma.deliveryLog.findMany({
    where: {
      status: { in: ['pending', 'retrying'] }
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      event: true,
      destination: true
    }
  });

  for (const log of logs) {
    const { destination, event } = log;
    let status: 'success' | 'retrying' | 'failed' = 'failed';
    let lastResponse: any = null;
    let lastError: string | null = null;

    if (destination.type === 'facebook') {
      const adapterResult = await sendFacebookEvent(event, destination);
      lastResponse = adapterResult.response ?? null;
      lastError = adapterResult.errorMessage ?? null;

      if (adapterResult.status === 'success') {
        status = 'success';
      } else if (adapterResult.status === 'retry') {
        status = 'retrying';
      } else {
        status = 'failed';
      }
    } else {
      status = 'failed';
      lastError = 'unsupported_destination_type';
    }

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: {
        status,
        attempts: log.attempts + 1,
        lastResponse,
        lastError
      }
    });
  }

  return logs.length;
}
