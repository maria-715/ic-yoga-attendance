import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());

app.listen(8080, () => {
      console.log("server listening on port 8080");
})


const BASE_URL = "https://eactivities.union.ic.ac.uk/API/csp/130";
const API_KEY = process.env.EACTIVITIES_API_KEY;

//console.log(`The API key is --${API_KEY}--`);

app.get("/proxy/members", async (req, res) => {

  const year = req.query.year;
  const url = `${BASE_URL}/reports/members?year=${year}`;

  //console.log(`Fetching ${url}`);

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!response.ok) {
      res.status(response.status).send("Failed to fetch members");
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error fetching members");
  }
});
  

app.get("/proxy/products", async (req, res) => {

  const year = req.query.year;
  const url = `${BASE_URL}/reports/products?year=${year}`;

  //console.log(`Fetching ${url}`);

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!response.ok) {
      res.status(response.status).send("Failed to fetch products");
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error fetching products");
  }
});
  

app.get("/proxy/products/:id/sales", async (req, res) => {

  const { id } = req.params;
  const url = `${BASE_URL}/products/${id}/sales`;

  //console.log(`Fetching ${url}`);

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch sales for product ${id}`);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error fetching sales");
  }
});
