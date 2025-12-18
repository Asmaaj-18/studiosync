import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Charger .env
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de test
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    message: "StudioSync API is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes API
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/studios", require("./routes/studio.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.use("/api/equipment", require("./routes/equipment.routes"));

// Gestion des erreurs 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Gestion des erreurs globales
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS allowed origin: ${process.env.CLIENT_URL}`);
});

export default app;
