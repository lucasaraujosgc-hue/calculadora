const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const resetOld = `    const users = await getUsers();
    const userIndex = users.findIndex((u: any) => u.resetToken === token);
    
    if (userIndex === -1) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);
    
    users[userIndex].passwordHash = newPasswordHash;
    users[userIndex].resetToken = null; // consume token
    await saveUsers(users);`;

const resetNew = `    const users = await getUsers();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const userIndex = users.findIndex((u: any) => u.resetTokenHash === tokenHash && u.resetTokenExpiresAt > Date.now());
    
    if (userIndex === -1) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);
    
    users[userIndex].passwordHash = newPasswordHash;
    users[userIndex].resetTokenHash = undefined;
    users[userIndex].resetTokenExpiresAt = undefined;
    await saveUsers(users);`;

code = code.replace(resetOld, resetNew);
fs.writeFileSync('server.ts', code);
