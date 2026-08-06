const fs = require('fs');
let code = fs.readFileSync('src/pages/AuthScreen.tsx', 'utf8');

const stateTarget = /const \[isForgotPassword, setIsForgotPassword\] = useState\(false\);/;
const stateReplacement = `const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');`;

code = code.replace(stateTarget, stateReplacement);

fs.writeFileSync('src/pages/AuthScreen.tsx', code);
