import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.get("/", (_req, res) => res.send("OK"));

app.get("/colonies", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM colony ORDER BY id");
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/inspections", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      colony_id,
      inspection_date,
      strength,
      temperament,
      activity,
      food_stores,
      notes,
      frames = [],
    } = req.body;

    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO inspection
        (colony_id, inspection_date, strength, temperament, activity, food_stores, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        colony_id,
        inspection_date,
        strength,
        temperament,
        activity,
        food_stores,
        notes,
      ]
    );
    const inspectionId = ins.rows[0].id;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f && f !== "empty") {
        await client.query(
          `INSERT INTO inspection_frames (inspection_id, frame_index, frame_content)
           VALUES ($1,$2,$3)`,
          [inspectionId, i + 1, f]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ id: inspectionId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(400).json({ error: String(e.message || e) });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port", PORT));
