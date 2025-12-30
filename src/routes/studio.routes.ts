import { Router, Request, Response } from 'express';

const router = Router();

router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Studio route working' });
});

export default router;
