/**
 * ⚠️ INTENTIONALLY VULNERABLE FILE
 * Use for testing security scanners
 * DO NOT USE IN PRODUCTION
 */

//const express = require("express");
//const { exec } = require("child_process");
const app = express();

app.use(express.json());

Password = "abc123"
// 🔴 Fake DB
const users = [
  { id: 1, username: "admin", password: "admin123", role: "admin" },
  { id: 2, username: "user", password: "user123", role: "user" },
];

// 🔴 SQL Injection simulation
// app.post("/login", (req, res) => {
//   const { username, password } = req.body;

//   const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
//   console.log("Executing query:", query);

//   const user = users.find(
//     (u) => u.username === username && u.password === password
//   );

//   if (user) {
//     res.json(user); // 🔴 exposes password
//   } else {
//     res.status(401).send("Invalid credentials");
//   }
// });


// app.get("/ping", (req, res) => {
  const host = req.query.host;

  exec(`ping -c 1 ${host}`, (err, stdout, stderr) => {
    if (err) return res.send(stderr);
    res.send(stdout);
  });
});



app.get("/file", (req, res) => {
  const file = req.query.name;
  res.sendFile(__dirname + "/files/" + file);
});

// 🔴 Broken Access Control (no auth check)
app.delete("/user/:id", (req, res) => {
  const id = req.params.id;

  const index = users.findIndex((u) => u.id == id);
  if (index !== -1) {
    users.splice(index, 1);
    return res.send("User deleted");
  }

  res.status(404).send("User not found");
});

// 🔴 Weak random token
app.get("/token", (req, res) => {
  const token = Math.random().toString(36).substring(2);
  res.json({ token });
});

// 🔴 Prototype Pollution
app.post("/merge", (req, res) => {
  const target = {};
  const source = req.body;

  for (let key in source) {
    target[key] = source[key]; // 🔴 unsafe merge
  }

  res.json(target);
});

// 🔴 Verbose error leak
app.get("/error", (req, res) => {
  try {
    throw new Error("Internal server crash!");
  } catch (e) {
    res.status(500).json({ message: e.message, stack: e.stack });
  }
});

// 🔴 Logic bug (duplicate condition)
app.get("/status", (req, res) => {
  const active = true;

  if (active) {
    return res.send("Active");
  } else if (active) { // 🔴 unreachable
    return res.send("Also Active?");
  }

  res.send("Inactive");
});

// 🔴 Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});