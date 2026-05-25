export function test() {
  console.log("This is a test function in the middleware folder.");
}


// write post request to check the result sent by ai 

//write api endpoint to receive the post request and log the results to the console
import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
  const message = req.body.message;
  console.log(req.headers);
  console.log("Received AI chat message:", message);
  res.status(200).send({ message: "AI chat message received successfully." });
});

router.post('/api/scan-results', (req, res) => {
  const results = req.body.results;
  console.log("Received scan results:", results);
  res.status(200).send({ message: "Scan results received successfully." });
});

export default router;