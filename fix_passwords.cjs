const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// CHANGE PASSWORD FIX
const changePasswordOld = `app.post("/api/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email);`;

const changePasswordNew = `app.post("/api/change-password", requireUser, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const email = req.currentUser.email; // get email from authenticated user
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u: any) => u.email === email);`;

code = code.replace(changePasswordOld, changePasswordNew);

// FORGOT PASSWORD FIX
const forgotPasswordOld = `    const resetToken = crypto.randomBytes(20).toString('hex');
    users[userIndex].resetToken = resetToken;
    await saveUsers(users);`;

const forgotPasswordNew = `    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    users[userIndex].resetTokenHash = resetTokenHash;
    users[userIndex].resetTokenExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
    await saveUsers(users);`;

code = code.replace(forgotPasswordOld, forgotPasswordNew);

fs.writeFileSync('server.ts', code);
