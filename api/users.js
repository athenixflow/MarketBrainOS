import admin from "../lib/firebaseAdmin.js";

export default async function handler(req, res) {
  const users = await admin.auth().listUsers();
  res.status(200).json({ count: users.users.length });
}